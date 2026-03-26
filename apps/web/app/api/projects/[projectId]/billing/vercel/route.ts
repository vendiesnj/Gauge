/**
 * POST /api/projects/:projectId/billing/vercel
 *
 * Accepts { vercelToken, vercelProjectId }, pulls env vars from Vercel API,
 * matches them to known vendors, fetches billing data, and upserts VendorPlan records.
 * The Vercel token is used transiently and never stored.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchBillingForKeys } from "@/lib/billing";

async function assertProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId } } } } },
  });
  return project && project.org.memberships.length > 0 ? project : null;
}

const ENV_VENDOR_PATTERNS: Array<{ re: RegExp; vendorId: string }> = [
  { re: /openai/i, vendorId: "openai" },
  { re: /anthropic/i, vendorId: "anthropic" },
  { re: /stripe/i, vendorId: "stripe" },
  { re: /twilio/i, vendorId: "twilio" },
  { re: /sendgrid/i, vendorId: "sendgrid" },
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await assertProjectAccess(session.user.id, projectId);
  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { vercelToken, vercelProjectId } = await req.json();
  if (!vercelToken || !vercelProjectId)
    return NextResponse.json({ error: "vercelToken and vercelProjectId are required" }, { status: 400 });

  // Fetch env vars from Vercel API — decrypt=1 returns plaintext values
  const vercelRes = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId)}/env?decrypt=true`,
    { headers: { Authorization: `Bearer ${vercelToken}` } }
  );

  if (!vercelRes.ok) {
    const s = vercelRes.status;
    let error = "Vercel API error";
    if (s === 401 || s === 403) {
      error = "Invalid or insufficient Vercel token. Create a personal token at vercel.com/account/tokens with Full Account scope.";
    } else if (s === 404) {
      error = "Vercel project not found. Check the project name matches your Vercel dashboard exactly.";
    }
    return NextResponse.json({ error }, { status: 400 });
  }

  const vercelData = await vercelRes.json();
  const envVars: Array<{ key: string; value: string }> = (vercelData.envs ?? [])
    .filter((e: { type: string; value?: string }) => e.type !== "system" && e.value)
    .map((e: { key: string; value: string }) => ({ key: e.key, value: e.value }));

  // Match env var names to vendor IDs
  const rawKeys: Array<{ vendorId: string; value: string }> = [];
  for (const { key, value } of envVars) {
    for (const { re, vendorId } of ENV_VENDOR_PATTERNS) {
      if (re.test(key) && value.length > 8) {
        rawKeys.push({ vendorId, value });
        break;
      }
    }
  }

  if (rawKeys.length === 0) {
    return NextResponse.json({ updated: 0, vendors: [] });
  }

  // Fetch real billing data
  const billingResults = await fetchBillingForKeys(rawKeys);

  for (const result of billingResults) {
    await db.vendorPlan.upsert({
      where: { projectId_vendorId: { projectId, vendorId: result.vendorId } },
      update: {
        planName: result.planName,
        monthlySpendUsd: result.monthlySpendUsd,
        source: "billing_api",
      },
      create: {
        projectId,
        vendorId: result.vendorId,
        planName: result.planName,
        monthlySpendUsd: result.monthlySpendUsd,
        source: "billing_api",
      },
    });
  }

  return NextResponse.json({
    updated: billingResults.length,
    vendors: billingResults.map((r) => r.vendorId),
  });
}
