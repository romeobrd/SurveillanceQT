// Contrôle périodique de l'application de bureau : le jeton de licence désigne-t-il toujours un abonnement payé ?
import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupDesktopLicence } from "@/lib/db/desktop-licence";
import { verifyLicence } from "@/lib/desktop/licence-token";

const VerificationSchema = z.object({ token: z.string().min(1).max(1000) });

export async function POST(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret)
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  const parsed = VerificationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  const payload = verifyLicence(parsed.data.token, secret);
  if (!payload)
    return NextResponse.json({ status: "revoked" }, { status: 401 });
  const lookup = await lookupDesktopLicence(
    payload.userId,
    new Date(),
    payload.organizationId,
  );
  if (lookup.status !== "active")
    return NextResponse.json({ status: lookup.status }, { status: 403 });
  return NextResponse.json({ status: "active", licence: lookup.licence });
}
