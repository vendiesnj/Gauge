/**
 * GET /api/connect/stripe
 * Redirects to Stripe OAuth. After auth, Stripe redirects to /api/connect/stripe/callback.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Stripe Connect not configured" }, { status: 500 });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/connect/stripe/callback`,
  });

  return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params}`);
}
