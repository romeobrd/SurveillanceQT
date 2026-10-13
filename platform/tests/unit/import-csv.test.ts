// Import CSV : lecture du fichier et validation ligne par ligne.
import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_ROWS,
  normalizeHeader,
  parseAssetImport,
  parseCsv,
  parsePeopleImport,
  parseStockImport,
  templateCsv,
  IMPORT_KINDS,
  parseImport,
} from "@/features/import/csv";

describe("parseCsv", () => {
  it("détecte le séparateur, gère BOM, guillemets et fins de ligne Windows", () => {
    expect(parseCsv('﻿a;b\r\n"x;1";"dit ""bonjour"""\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x;1", 'dit "bonjour"'],
    ]);
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv('a;b\n"ligne\nsur deux";3')).toEqual([
      ["a", "b"],
      ["ligne\nsur deux", "3"],
    ]);
  });

  it("normalise les en-têtes (accents, casse, ponctuation)", () => {
    expect(normalizeHeader(" Prénom ")).toBe("prenom");
    expect(normalizeHeader("Date d'achat")).toBe("date_d_achat");
    expect(normalizeHeader("E-mail professionnel")).toBe(
      "e_mail_professionnel",
    );
  });
});

describe("validation des lignes", () => {
  it("accepte le modèle de fichier de chaque type", () => {
    for (const kind of IMPORT_KINDS) {
      const parsed = parseImport(kind, templateCsv(kind));
      expect(parsed.fileErrors).toEqual([]);
      expect(parsed.lines).toHaveLength(1);
      expect(parsed.lines[0].errors).toEqual([]);
    }
  });

  it("collaborateurs : erreurs par ligne, doublons, e-mail en minuscules", () => {
    const parsed = parsePeopleImport(
      [
        "Prénom;Nom;Email;Poste;Équipe",
        "Léa;Martin;LEA@exemple.fr;Comptable;Finance",
        ";Durand;pas-un-email;Assistant;",
        "Léa;Martin;lea@exemple.fr;Comptable;",
      ].join("\n"),
    );
    expect(parsed.lines[0]).toMatchObject({
      line: 2,
      data: { workEmail: "lea@exemple.fr", team: "Finance" },
    });
    expect(parsed.lines[1].data).toBeNull();
    expect(parsed.lines[1].errors.join(" ")).toMatch(/Prénom.*E-mail/);
    expect(parsed.lines[2].errors).toEqual(["Doublon dans le fichier"]);
  });

  it("refuse un fichier sans colonne obligatoire ou trop long", () => {
    expect(parsePeopleImport("Prénom;Nom\nA;B").fileErrors[0]).toMatch(
      /E-mail/,
    );
    expect(parsePeopleImport("Prénom;Nom;Email;Poste").fileErrors[0]).toMatch(
      /aucune ligne/,
    );
    const long = [
      "Prénom;Nom;Email;Poste",
      ...Array.from(
        { length: MAX_IMPORT_ROWS + 1 },
        (_, i) => `A;B;a${i}@x.fr;C`,
      ),
    ].join("\n");
    expect(parsePeopleImport(long).fileErrors[0]).toMatch(/Trop de lignes/);
  });

  it("matériel : état en français, date française, date invalide refusée", () => {
    const parsed = parseAssetImport(
      [
        "Type;Marque;Modèle;Numéro de série;État;Date d'achat",
        "Écran;Dell;P2422;S1;En panne;05/01/2024",
        "Écran;Dell;P2422;S2;;",
        "Écran;Dell;P2422;S3;Cassé;",
        "Écran;Dell;P2422;S4;;32/13/2024",
      ].join("\n"),
    );
    expect(parsed.lines[0].data).toMatchObject({ state: "BROKEN" });
    expect(
      (parsed.lines[0].data?.purchaseDate as Date).toISOString().slice(0, 10),
    ).toBe("2024-01-05");
    expect(parsed.lines[1].data).toMatchObject({
      state: "IN_SERVICE",
      purchaseDate: null,
    });
    expect(parsed.lines[2].errors[0]).toMatch(/État/);
    expect(parsed.lines[3].errors[0]).toMatch(/Date/);
  });

  it("stock : seuil et quantité facultatifs, nombres négatifs refusés", () => {
    const parsed = parseStockImport(
      [
        "Article,Référence,Unité,Seuil,Quantité",
        "Stylos,ST-1,boîtes,,",
        "Café,CA-1,paquets,-2,3",
      ].join("\n"),
    );
    expect(parsed.lines[0].data).toMatchObject({ threshold: 0, quantity: 0 });
    expect(parsed.lines[1].errors[0]).toMatch(/Seuil/);
  });
});
