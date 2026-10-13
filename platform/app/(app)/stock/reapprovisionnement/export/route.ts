// Export CSV de la liste de réapprovisionnement (articles et quantités : aucune donnée personnelle).
import { NextResponse } from "next/server";
import { toReorderCsv } from "@/features/stock/reorder";
import { readSession } from "@/lib/auth/session";
import { ForbiddenError, getRepositories } from "@/lib/db";

export async function GET() {
  const session = await readSession();
  if (!session || session.mustChangePassword)
    return new NextResponse(null, { status: 401 });
  try {
    const lines = await getRepositories(session).stock.reorderList();
    return new NextResponse(toReorderCsv(lines), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="reapprovisionnement.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return new NextResponse(null, { status: 403 });
    throw error;
  }
}
