// Activation de l'application de bureau : e-mail et mot de passe du compte client, abonnement payé requis.
// Réponse : jeton de licence signé + informations pour préparer l'application. Journalisé.
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCredentials } from "@/lib/auth/credentials";
import {
  lookupDesktopLicence,
  recordDesktopActivation,
} from "@/lib/db/desktop-licence";
import { signLicence } from "@/lib/desktop/licence-token";

const ActivationSchema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret)
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
  const token = signLicence(
    {
      userId: credentials.userId,
      organizationId: lookup.licence.organizationId,
      issuedAt: Math.floor(now.getTime() / 1000),
    },
    secret,
  );
  return NextResponse.json({
    status: "active",
    token,
    licence: lookup.licence,
  });
}
