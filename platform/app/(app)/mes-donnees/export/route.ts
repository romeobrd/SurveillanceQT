// Export JSON des données de la personne connectée (droit d'accès / portabilité), journalisé.
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { ForbiddenError, getRepositories, NotFoundError } from "@/lib/db";

export async function GET() {
  const session = await readSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const data = await getRepositories(session).privacy.exportMyData();
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mes-donnees.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return new NextResponse(null, { status: 403 });
    if (error instanceof NotFoundError)
      return new NextResponse(null, { status: 404 });
    throw error;
  }
}
