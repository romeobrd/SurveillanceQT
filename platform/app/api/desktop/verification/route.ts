// Contrôle périodique de l'application de bureau : l'attestation désigne-t-elle toujours un abonnement payé ?
// Si oui, une nouvelle attestation (14 jours hors ligne) est renvoyée.
import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupDesktopLicence } from "@/lib/db/desktop-licence";
import { verifyGrant } from "@/lib/desktop/licence-grant";
import { issueGrant } from "@/lib/desktop/licence-issue";
import { siteVerifyingKey } from "@/lib/desktop/licence-keys";

const VerificationSchema = z.object({ grant: z.string().min(1).max(4000) });

/** Une attestation plus ancienne n'est plus renouvelée : il faut se reconnecter avec le compte client. */
const MAX_RENEWAL_AGE_MS = 365 * 86_400_000;

export async function POST(request: Request) {
  const key = siteVerifyingKey();
  if (!key)
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const parsed = VerificationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  const now = new Date();
  // Attestation expirée acceptée (l'application revient d'une période hors ligne), mais signée par ce site
  const grant = verifyGrant(parsed.data.grant, key);
  if (!grant || now.getTime() - grant.issuedAt > MAX_RENEWAL_AGE_MS)
    return NextResponse.json({ status: "revoked" }, { status: 401 });
  const lookup = await lookupDesktopLicence(
    grant.userId,
    now,
    grant.licence.organizationId,
  );
  if (lookup.status !== "active")
    return NextResponse.json({ status: lookup.status }, { status: 403 });
  return NextResponse.json({
    status: "active",
    grant: issueGrant(grant.userId, lookup.licence, now),
  });
}
