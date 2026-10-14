// Connexion à une base en ligne : chiffrement et certificat de l'hébergeur traduits pour le pilote pg.
import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import type { PeerCertificate } from "node:tls";
import { pgConnection, pinnedIdentity } from "@/lib/db/connection";
import { OTHER_PEM, PINNED_PEM } from "./fixtures/certificates";

const PINNED = new X509Certificate(PINNED_PEM);
const OTHER = new X509Certificate(OTHER_PEM);

/** Certificat tel que présenté par le serveur lors de la poignée de main. */
function peer(cert: X509Certificate): PeerCertificate {
  return {
    subject: { CN: "clouddb.interne" },
    subjectaltname: "DNS:clouddb.interne",
    fingerprint256: cert.fingerprint256,
  } as unknown as PeerCertificate;
}

const base = "postgresql://spacora:secret@db.exemple.net:35123/spacora";

describe("pgConnection", () => {
  it("base locale : adresse inchangée, sans chiffrement", () => {
    expect(pgConnection(base)).toEqual({ connectionString: base });
    expect(pgConnection(`${base}?sslmode=disable`)).toEqual({
      connectionString: base,
    });
  });

  it("base en ligne : chiffrement avec vérification du certificat, options retirées de l'adresse", () => {
    expect(pgConnection(`${base}?sslmode=require`)).toEqual({
      connectionString: base,
      ssl: { rejectUnauthorized: true },
    });
    const pinned = pgConnection(
      `${base}?sslmode=require&sslaccept=strict`,
      PINNED.toString(),
    );
    expect(pinned.connectionString).toBe(base);
    expect(pinned.ssl).toMatchObject({
      rejectUnauthorized: true,
      ca: PINNED.toString(),
    });
  });

  it("le certificat de l'hébergeur suffit à activer le chiffrement", () => {
    expect(pgConnection(base, PINNED.toString()).ssl).toMatchObject({
      rejectUnauthorized: true,
    });
  });
});

describe("pinnedIdentity", () => {
  const check = pinnedIdentity(PINNED.toString());

  it("nom différent de l'adresse : accepté seulement pour le certificat épinglé", () => {
    expect(check("db.exemple.net", peer(PINNED))).toBeUndefined();
    expect(check("db.exemple.net", peer(OTHER))).toBeInstanceOf(Error);
  });
});
