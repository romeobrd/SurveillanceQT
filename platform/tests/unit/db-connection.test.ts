// Connexion à une base en ligne : chiffrement et certificat de l'hébergeur traduits pour le pilote pg.
import { describe, expect, it } from "vitest";
import { pgConnection } from "@/lib/db/connection";

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
    expect(
      pgConnection(`${base}?sslmode=require&sslaccept=strict`, "CA-PEM"),
    ).toEqual({
      connectionString: base,
      ssl: { rejectUnauthorized: true, ca: "CA-PEM" },
    });
  });

  it("le certificat de l'hébergeur suffit à activer le chiffrement", () => {
    expect(pgConnection(base, "CA-PEM").ssl).toEqual({
      rejectUnauthorized: true,
      ca: "CA-PEM",
    });
  });
});
