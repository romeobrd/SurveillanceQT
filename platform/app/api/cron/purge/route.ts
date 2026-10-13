import { NextResponse } from "next/server";
import { runPurge } from "@/lib/db/purge";
import { checkCronAuthorization } from "@/lib/security/cron-auth";

// Purge nocturne (SPEC §8.2 et §8.6), appelée par une tâche planifiée avec `Authorization: Bearer $CRON_SECRET`.
// Jamais accessible par un navigateur : POST seulement, secret obligatoire, aucune session.
export async function POST(request: Request) {
  const auth = checkCronAuthorization(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  if (auth === "not_configured")
    return NextResponse.json(
      { error: "Purge non configurée" },
      { status: 503 },
    );
  if (auth === "unauthorized")
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const report = await runPurge();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
