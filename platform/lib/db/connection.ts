// Paramètres de connexion à PostgreSQL : code pur, testé.
// Une même adresse (DATABASE_URL) sert à l'application (pilote pg) et aux migrations (Prisma) : les options de
// chiffrement de l'adresse (sslmode=require…) sont lues ici et traduites pour pg, qui les comprend autrement.
import { X509Certificate } from "node:crypto";
import { checkServerIdentity, type PeerCertificate } from "node:tls";

export interface PgConnection {
  connectionString: string;
  /** Connexion chiffrée, certificat du serveur vérifié (autorité fournie par l'hébergeur si besoin). */
  ssl?: {
    rejectUnauthorized: true;
    ca?: string;
    checkServerIdentity?: (
      host: string,
      cert: PeerCertificate,
    ) => Error | undefined;
  };
}

const SSL_PARAMS = [
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslaccept",
  "sslidentity",
  "sslpassword",
];
const SSL_REQUIRED = new Set(["require", "verify-ca", "verify-full", "prefer"]);

/** Empreintes SHA-256 des certificats d'un fichier PEM. */
function fingerprints(pem: string): Set<string> {
  const blocks =
    pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    ) ?? [];
  return new Set(
    blocks.map((block) => new X509Certificate(block).fingerprint256),
  );
}

/**
 * Contrôle du nom du serveur. Certains hébergeurs (OVH Web Cloud Databases) présentent un certificat
 * auto-signé dont le nom diffère de l'adresse de connexion : il est alors accepté uniquement s'il est
 * exactement l'un des certificats du fichier fourni (épinglage), jamais un autre.
 */
export function pinnedIdentity(ca: string) {
  const pinned = fingerprints(ca);
  return (host: string, cert: PeerCertificate): Error | undefined => {
    const error = checkServerIdentity(host, cert);
    if (!error || pinned.has(cert.fingerprint256)) return undefined;
    return error;
  };
}

/**
 * @param url adresse DATABASE_URL
 * @param ca certificat de l'autorité de l'hébergeur (contenu du fichier DATABASE_SSL_CA), facultatif
 */
export function pgConnection(url: string, ca?: string): PgConnection {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode");
  for (const name of SSL_PARAMS) parsed.searchParams.delete(name);
  const connectionString = parsed.toString();
  if (mode === "disable" || (!ca && !(mode && SSL_REQUIRED.has(mode))))
    return { connectionString };
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca, checkServerIdentity: pinnedIdentity(ca) } : {}),
    },
  };
}
