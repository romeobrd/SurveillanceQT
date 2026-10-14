// Application de bureau Spacora (Electron) : fenêtre, menu, sauvegarde des données.
// Le moteur (base intégrée + serveur local) est dans runtime.cjs.
"use strict";
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { startSpacora } = require("./runtime.cjs");

const SITE_URL = "https://www.spacora.tech";
// Carte 3D : sans carte graphique utilisable (machine virtuelle, bureau à distance, pilote bloqué),
// rendu WebGL logiciel au lieu d'une carte vide. Sans risque ici : la fenêtre n'affiche que Spacora.
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
const smokeTest = process.argv.includes("--smoke-test");
// Test de démarrage (construction automatique) : dossier de données jetable
if (smokeTest)
  app.setPath(
    "userData",
    fs.mkdtempSync(path.join(os.tmpdir(), "spacora-test-")),
  );

const dataDir = app.getPath("userData");
const resourcesDir = app.isPackaged
  ? path.join(process.resourcesPath, "spacora")
  : path.join(__dirname, "resources");
const icon = path.join(__dirname, "icons", "icon.png");
const logFile = path.join(dataDir, "spacora.log");

function log(message) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
  if (smokeTest) console.log(message);
}

let runtime = null;
let mainWindow = null;

async function startEngine() {
  runtime = await startSpacora({
    dataDir,
    resourcesDir,
    accountUrl: process.env.SPACORA_ACCOUNT_URL,
    log,
  });
}

async function stopEngine() {
  const current = runtime;
  runtime = null;
  if (current) await current.stop();
}

/** Seules les pages de Spacora s'ouvrent dans la fenêtre ; les autres liens partent dans le navigateur. */
function isAppUrl(url) {
  return runtime !== null && url.startsWith(runtime.url);
}
function openOutside(url) {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: "Spacora",
    icon,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openOutside(url);
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

/** Arrête le moteur, exécute une opération sur les fichiers de données, puis redémarre et recharge. */
async function withEngineStopped(operation) {
  mainWindow?.loadFile(path.join(__dirname, "splash.html"));
  await stopEngine();
  try {
    await operation();
  } finally {
    await startEngine();
    mainWindow?.loadURL(`${runtime.url}/login`);
  }
}

async function backupData() {
  const date = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Sauvegarder les données de Spacora",
    defaultPath: path.join(
      app.getPath("documents"),
      `Spacora-sauvegarde-${date}`,
    ),
    buttonLabel: "Sauvegarder",
  });
  if (canceled || !filePath) return;
  await withEngineStopped(async () => {
    fs.mkdirSync(filePath, { recursive: true });
    fs.cpSync(path.join(dataDir, "database"), path.join(filePath, "database"), {
      recursive: true,
    });
    // Les identifiants de la base sont nécessaires pour la rouvrir lors d'une restauration
    fs.copyFileSync(
      path.join(dataDir, "config.json"),
      path.join(filePath, "config.json"),
    );
  });
  log(`Sauvegarde : ${filePath}`);
  dialog.showMessageBox(mainWindow, {
    type: "info",
    message: "Sauvegarde terminée",
    detail: `Vos données sont sauvegardées dans :\n${filePath}\n\nConservez ce dossier en lieu sûr (clé USB, autre disque…).`,
  });
}

async function restoreData() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Choisir une sauvegarde Spacora",
    properties: ["openDirectory"],
    buttonLabel: "Restaurer",
  });
  if (canceled || !filePaths[0]) return;
  const source = filePaths[0];
  if (
    !fs.existsSync(path.join(source, "database", "PG_VERSION")) ||
    !fs.existsSync(path.join(source, "config.json"))
  ) {
    dialog.showErrorBox(
      "Sauvegarde invalide",
      "Ce dossier n'est pas une sauvegarde de Spacora.",
    );
    return;
  }
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Annuler", "Restaurer"],
    defaultId: 0,
    cancelId: 0,
    message: "Remplacer les données actuelles par cette sauvegarde ?",
    detail:
      "Les données actuelles de Spacora sur ce PC seront remplacées. Cette action est irréversible.",
  });
  if (response !== 1) return;
  await withEngineStopped(async () => {
    fs.rmSync(path.join(dataDir, "database"), { recursive: true, force: true });
    fs.cpSync(path.join(source, "database"), path.join(dataDir, "database"), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(source, "config.json"),
      path.join(dataDir, "config.json"),
    );
  });
  log(`Restauration : ${source}`);
}

function buildMenu() {
  const run = (task) => () =>
    task().catch((error) => {
      log(`Erreur : ${error?.stack ?? String(error)}`);
      dialog.showErrorBox(
        "Spacora",
        `L'opération a échoué : ${error?.message ?? String(error)}`,
      );
    });
  return Menu.buildFromTemplate([
    {
      label: "Fichier",
      submenu: [
        { label: "Sauvegarder les données…", click: run(backupData) },
        { label: "Restaurer une sauvegarde…", click: run(restoreData) },
        {
          label: "Ouvrir le dossier des données",
          click: () => shell.openPath(dataDir),
        },
        { type: "separator" },
        { label: "Quitter", role: "quit" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { label: "Recharger", role: "reload" },
        { type: "separator" },
        { label: "Taille réelle", role: "resetZoom" },
        { label: "Agrandir", role: "zoomIn" },
        { label: "Réduire", role: "zoomOut" },
        { type: "separator" },
        { label: "Plein écran", role: "togglefullscreen" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        { label: "Site Spacora", click: () => shell.openExternal(SITE_URL) },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]);
}

async function runSmokeTest() {
  try {
    await startEngine();
    // Premier lancement : la page d'activation doit s'afficher (serveur, base et migrations opérationnels)
    const response = await fetch(`${runtime.url}/activation`);
    const html = await response.text();
    if (!response.ok || !html.includes("Activer Spacora"))
      throw new Error(`Page inattendue (${response.status} ${response.url})`);
    console.log(`TEST DE DÉMARRAGE RÉUSSI : ${response.url}`);
    await stopEngine();
    app.exit(0);
  } catch (error) {
    console.error(
      `TEST DE DÉMARRAGE ÉCHOUÉ : ${error?.stack ?? String(error)}`,
    );
    await stopEngine().catch(() => {});
    app.exit(1);
  }
}

async function launch() {
  // Aucune autorisation sensible (caméra, micro, position…) pour les pages de l'application
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  Menu.setApplicationMenu(buildMenu());
  const window = createWindow();
  window.loadFile(path.join(__dirname, "splash.html"));
  window.once("ready-to-show", () => window.show());
  try {
    await startEngine();
  } catch (error) {
    log(`Échec du démarrage : ${error?.stack ?? String(error)}`);
    dialog.showErrorBox(
      "Spacora n'a pas pu démarrer",
      `${error?.message ?? String(error)}\n\nJournal : ${logFile}`,
    );
    app.exit(1);
    return;
  }
  window.loadURL(`${runtime.url}/login`);
}

if (!smokeTest && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(smokeTest ? runSmokeTest : launch);
  app.on("window-all-closed", () => app.quit());
  // Arrêt propre de la base avant de quitter (sinon elle se répare au prochain lancement)
  let quitting = false;
  app.on("before-quit", (event) => {
    if (quitting || !runtime) return;
    event.preventDefault();
    quitting = true;
    stopEngine().finally(() => app.quit());
  });
}
