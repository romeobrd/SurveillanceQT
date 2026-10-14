// Activation de l'application de bureau : e-mail et mot de passe du compte client, abonnement payé requis.
// Réponse : attestation de licence signée par le site (offre, entreprise, validité hors ligne). Journalisé.
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/auth/client-ip";
import { checkCredentials } from "@/lib/auth/credentials";
import {
  lookupDesktopLicence,
  recordDesktopActivation,
} from "@/lib/db/desktop-licence";
import { issueGrant } from "@/lib/desktop/licence-issue";
import { siteSigningKey } from "@/lib/desktop/licence-keys";

const ActivationSchema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!siteSigningKey())
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const parsed = ActivationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  const now = new Date();
  const credentials = await checkCredentials(
    parsed.data.email,
    parsed.data.password,
    clientIp(request.headers),
    now,
  );
  if (!credentials.ok)
    return NextResponse.json(
      { status: credentials.reason },
      { status: credentials.reason === "locked" ? 429 : 401 },
    );
  const lookup = await lookupDesktopLicence(credentials.userId, now);
  // Compte non administrateur : même réponse qu'un abonnement absent (rien d'autre n'est révélé)
  if (lookup.status !== "active")
    return NextResponse.json({ status: "no_subscription" }, { status: 403 });
  await recordDesktopActivation(
    lookup.licence.organizationId,
    credentials.userId,
  );
  return NextResponse.json({
    status: "active",
    grant: issueGrant(credentials.userId, lookup.licence, now),
  });
}
