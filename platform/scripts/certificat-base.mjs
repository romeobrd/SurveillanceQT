// Récupère le certificat de la base en ligne (DATABASE_URL du fichier .env) et l'enregistre dans ovh-ca.pem.
// Seule la poignée de main chiffrée a lieu : aucun identifiant ni mot de passe n'est envoyé au serveur.
// Usage : npm run db:certificat
import "dotenv/config";
import { X509Certificate } from "node:crypto";
import { writeFileSync } from "node:fs";
import { connect as connectTcp, isIP } from "node:net";
import { resolve } from "node:path";
import { checkServerIdentity, connect as connectTls } from "node:tls";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est absente du fichier .env.");
  process.exit(1);
}
const { hostname, port } = new URL(url);
const output = resolve("ovh-ca.pem");

/** Demande de chiffrement du protocole PostgreSQL (SSLRequest), puis poignée de main TLS. */
function fetchCertificate() {
  return new Promise((done, fail) => {
    const socket = connectTcp(Number(port || 5432), hostname);
    socket.setTimeout(15_000, () => fail(new Error("délai dépassé")));
    socket.on("error", fail);
    socket.once("connect", () => {
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
    });
    socket.once("data", (answer) => {
      if (answer.toString() !== "S")
        return fail(new Error("le serveur refuse les connexions chiffrées"));
      // Vérification volontairement désactivée : on lit le certificat pour l'épingler, rien d'autre n'est échangé
      const secure = connectTls({
        socket,
        ...(isIP(hostname) ? {} : { servername: hostname }),
        rejectUnauthorized: false,
      });
      secure.on("error", fail);
      secure.once("secureConnect", () => {
        let cert = secure.getPeerCertificate(true);
        // Remonte jusqu'au certificat racine de la chaîne présentée
        while (cert.issuerCertificate && cert.issuerCertificate !== cert)
          cert = cert.issuerCertificate;
        const leaf = secure.getPeerCertificate(false);
        secure.end();
        done({ root: cert, leaf });
      });
    });
  });
}

try {
  const { root, leaf } = await fetchCertificate();
  const pem = new X509Certificate(root.raw).toString();
  writeFileSync(output, pem);
  console.log(`Certificat enregistré : ${output}`);
  console.log(`  Serveur      : ${hostname}:${port}`);
  console.log(`  Délivré à    : ${leaf.subject?.CN ?? "?"}`);
  console.log(`  Délivré par  : ${root.subject?.CN ?? "?"}`);
  console.log(`  Valable jusqu'au : ${leaf.valid_to}`);
  console.log(`  Empreinte SHA-256 : ${leaf.fingerprint256}`);
  console.log(
    checkServerIdentity(hostname, leaf)
      ? "  Nom du certificat différent de l'adresse : accepté uniquement par épinglage."
      : "  Nom du certificat conforme à l'adresse.",
  );
  console.log("");
  console.log("Ajoutez cette ligne au fichier .env :");
  console.log(`DATABASE_SSL_CA="${output.replaceAll("\\", "/")}"`);
} catch (error) {
  console.error(`Impossible de récupérer le certificat : ${error.message}`);
  process.exit(1);
}
