import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { fetchStripeOAuth } from "@/lib/billing";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const savedState = jar.get("oauth_state")?.value;
  const returnedState = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");

  if (!savedState || savedState !== returnedState)
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });

  const projectId = savedState.split(":")[0];

  jar.delete("oauth_state");

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!tokenRes.ok)
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });

  const tokenData = await tokenRes.json();
  const stripeAccountId: string = tokenData.stripe_user_id;

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "stripe" } },
    update: {
      accessToken: stripeAccountId,
      metadata: { stripeAccountId },
    },
    create: {
      orgId: project.orgId,
      vendorId: "stripe",
      accessToken: stripeAccountId,
      metadata: { stripeAccountId },
    },
  });

  // Fetch and store billing data immediately after connecting
  const billing = await fetchStripeOAuth(stripeAccountId);
  if (billing) {
    await db.vendorPlan.upsert({
      where: { projectId_vendorId: { projectId, vendorId: "stripe" } },
      update: { planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
      create: { projectId, vendorId: "stripe", planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
    });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_URL}/projects/${projectId}?connected=stripe`
  );
}
