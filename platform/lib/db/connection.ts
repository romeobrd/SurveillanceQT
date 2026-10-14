// Paramètres de connexion à PostgreSQL : code pur, testé.
// Une même adresse (DATABASE_URL) sert à l'application (pilote pg) et aux migrations (Prisma) : les options de
// chiffrement de l'adresse (sslmode=require…) sont lues ici et traduites pour pg, qui les comprend autrement.

export interface PgConnection {
  connectionString: string;
  /** Connexion chiffrée, certificat du serveur vérifié (autorité fournie par l'hébergeur si besoin). */
  ssl?: { rejectUnauthorized: true; ca?: string };
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
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
