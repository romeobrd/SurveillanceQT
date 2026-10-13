// Modèle de fichier d'import (en-têtes et une ligne d'exemple fictive : aucune donnée personnelle).
import { NextResponse } from "next/server";
import {
  IMPORT_KINDS,
  templateCsv,
  type ImportKind,
} from "@/features/import/csv";
import { readSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const session = await readSession();
  if (!session || session.mustChangePassword)
    return new NextResponse(null, { status: 401 });
  const { type } = await params;
  if (!IMPORT_KINDS.includes(type as ImportKind))
    return new NextResponse(null, { status: 404 });
  return new NextResponse(templateCsv(type as ImportKind), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modele-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
