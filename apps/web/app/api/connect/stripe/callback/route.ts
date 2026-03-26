/**
 * GET /api/connect/stripe/callback
 * Handles Stripe OAuth callback, stores access token.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/projects?error=stripe_connect_failed`, req.url));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY ?? "",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/projects?error=stripe_token_failed", req.url));
  }

  const tokenData = await tokenRes.json();

  // Find user's org
  const membership = await db.orgMembership.findFirst({
    where: { userId: session.user.id },
    orderBy: { id: "asc" },
  });

  if (!membership) {
    return NextResponse.redirect(new URL("/projects?error=no_org", req.url));
  }

  // Store connection
  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: membership.orgId, vendorId: "stripe" } },
    update: {
      accessToken: tokenData.access_token,
      metadata: { stripeAccountId: tokenData.stripe_user_id },
    },
    create: {
      orgId: membership.orgId,
      vendorId: "stripe",
      accessToken: tokenData.access_token,
      metadata: { stripeAccountId: tokenData.stripe_user_id },
    },
  });

  return NextResponse.redirect(new URL("/projects?connected=stripe", req.url));
}
