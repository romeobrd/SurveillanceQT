// Webhook Stripe : authentifié par sa signature (secret partagé), il met à jour l'abonnement de l'entreprise.
import { NextResponse, type NextRequest } from "next/server";
import { toSubscriptionChange } from "@/lib/billing/events";
import { getBillingProvider } from "@/lib/billing/stripe";
import { applySubscriptionChange } from "@/lib/db/billing-core";

export async function POST(request: NextRequest) {
  const provider = getBillingProvider();
  if (!provider) return new NextResponse(null, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse(null, { status: 400 });
  // Le corps brut est indispensable à la vérification de la signature
  const body = await request.text();
  let event: unknown;
  try {
    event = provider.verifyWebhook(body, signature);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const change = toSubscriptionChange(event, provider.prices);
  if (change) await applySubscriptionChange(change);
  return NextResponse.json({ received: true });
}
