// Moteur de l'application de bureau, sans dépendance à Electron (testable avec Node seul) :
// base PostgreSQL intégrée (dans le dossier de données de l'utilisateur), migrations, serveur Spacora local.
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { fork } = require("node:child_process");

/** Port libre sur la boucle locale (jamais exposé au réseau). */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Secrets propres à ce PC, créés au premier lancement (fichier lisible par l'utilisateur seul). */
function loadConfig(dataDir) {
  const file = path.join(dataDir, "config.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const config = {
    dbPassword: crypto.randomBytes(24).toString("hex"),
    authSecret: crypto.randomBytes(32).toString("base64url"),
    cronSecret: crypto.randomBytes(32).toString("base64url"),
  };
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return config;
}

async function startDatabase({ databaseDir, port, password, log }) {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const database = new EmbeddedPostgres({
    databaseDir,
    user: "spacora",
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: (message) => log(`[base] ${message}`),
  });
  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    log("Création de la base de données…");
    await database.initialise();
  }
  await database.start();
  const client = database.getPgClient();
  await client.connect();
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'spacora'",
  );
  if (exists.rowCount === 0) await client.query("CREATE DATABASE spacora");
  await client.end();
  return database;
}

/** Applique dans l'ordre les migrations Prisma pas encore appliquées (mêmes fichiers SQL que le serveur). */
async function migrate(databaseUrl, migrationsDir, log) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_spacora_migrations" (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Set(
      (await client.query('SELECT name FROM "_spacora_migrations"')).rows.map(
        (row) => row.name,
      ),
    );
    const names = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = fs.readFileSync(
        path.join(migrationsDir, name, "migration.sql"),
        "utf8",
      );
      log(`Mise à jour de la base : ${name}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_spacora_migrations" (name) VALUES ($1)',
          [name],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.on("error", retry);
      request.setTimeout(5000, () => request.destroy());
    };
    const retry = () =>
      Date.now() > deadline
        ? reject(new Error(`Le serveur Spacora ne répond pas (${url})`))
        : setTimeout(attempt, 300);
    attempt();
  });
}

/**
 * Démarre Spacora sur ce PC. `resourcesDir` contient server/ (serveur Next autonome) et migrations/.
 * Renvoie l'adresse locale et une fonction d'arrêt.
 */
async function startSpacora({
  dataDir,
  resourcesDir,
  accountUrl,
  log = console.log,
}) {
  const config = loadConfig(dataDir);
  const dbPort = await freePort();
  const database = await startDatabase({
    databaseDir: path.join(dataDir, "database"),
    port: dbPort,
    password: config.dbPassword,
    log,
  });
  const databaseUrl = `postgresql://spacora:${config.dbPassword}@127.0.0.1:${dbPort}/spacora`;
  let server;
  try {
    await migrate(databaseUrl, path.join(resourcesDir, "migrations"), log);
    const appPort = await freePort();
    const url = `http://127.0.0.1:${appPort}`;
    const serverDir = path.join(resourcesDir, "server");
    server = fork(path.join(serverDir, "server.js"), [], {
      cwd: serverDir,
      // Sous Electron, le même exécutable sert de Node pour le serveur
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: String(appPort),
        HOSTNAME: "127.0.0.1",
        DATABASE_URL: databaseUrl,
        AUTH_SECRET: config.authSecret,
        AUTH_URL: url,
        AUTH_TRUST_HOST: "true",
        CRON_SECRET: config.cronSecret,
        SPACORA_EDITION: "desktop",
        SPACORA_DATA_DIR: dataDir,
        ...(accountUrl ? { SPACORA_ACCOUNT_URL: accountUrl } : {}),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    server.stdout.on("data", (chunk) =>
      log(`[serveur] ${String(chunk).trim()}`),
    );
    server.stderr.on("data", (chunk) =>
      log(`[serveur] ${String(chunk).trim()}`),
    );
    await waitForHttp(`${url}/login`, 60_000);
    log(`Spacora est prêt : ${url}`);

    const purge = () =>
      fetch(`${url}/api/cron/purge`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.cronSecret}` },
      }).catch(() => {});
    // Purge RGPD au démarrage puis chaque jour (durées de conservation, comme sur le serveur en ligne)
    purge();
    const timer = setInterval(purge, 24 * 3_600_000);
    timer.unref();

    let stopped = false;
    async function stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      server.kill();
      await database.stop();
    }
    return { url, stop, databaseDir: path.join(dataDir, "database") };
  } catch (error) {
    server?.kill();
    await database.stop();
    throw error;
  }
}

module.exports = { startSpacora, loadConfig, migrate, freePort };
