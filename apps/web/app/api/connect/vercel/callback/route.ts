import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { fetchVercelBilling } from "@/lib/billing";

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

  const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.VERCEL_CLIENT_ID!,
      client_secret: process.env.VERCEL_CLIENT_SECRET!,
      code: code!,
      redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/connect/vercel/callback`,
    }),
  });

  if (!tokenRes.ok)
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;
  const teamId: string | null = tokenData.team_id ?? null;

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "vercel" } },
    update: {
      accessToken,
      metadata: teamId ? { teamId } : {},
    },
    create: {
      orgId: project.orgId,
      vendorId: "vercel",
      accessToken,
      metadata: teamId ? { teamId } : {},
    },
  });

  const billing = await fetchVercelBilling(accessToken, teamId);
  if (billing) {
    await db.vendorPlan.upsert({
      where: { projectId_vendorId: { projectId, vendorId: "vercel" } },
      update: { planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
      create: { projectId, vendorId: "vercel", planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
    });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_URL}/projects/${projectId}?connected=vercel`
  );
}
