// Liste de réapprovisionnement : calculs purs (quantité conseillée, export CSV lisible par un tableur).
import { isBelowThreshold } from "./quantity";

/** Quantité conseillée : de quoi revenir à deux fois le seuil (0 si l'article n'est pas sous le seuil). */
export function suggestedReorder(quantity: number, threshold: number): number {
  return isBelowThreshold(quantity, threshold)
    ? 2 * threshold - Math.max(0, quantity)
    : 0;
}

export interface ReorderLine {
  name: string;
  reference: string;
  zone: string | null;
  quantity: number;
  threshold: number;
  unit: string;
  suggested: number;
}

const HEADERS = [
  "Article",
  "Référence",
  "Zone",
  "Quantité",
  "Seuil",
  "Unité",
  "À commander",
];

/** Échappe une cellule CSV ; neutralise les formules (=, +, -, @) pour éviter l'injection dans le tableur. */
function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV au format français (séparateur « ; », BOM UTF-8 pour Excel). */
export function toReorderCsv(lines: readonly ReorderLine[]): string {
  const rows = [
    HEADERS,
    ...lines.map((line) => [
      line.name,
      line.reference,
      line.zone ?? "",
      line.quantity,
      line.threshold,
      line.unit,
      line.suggested,
    ]),
  ];
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
