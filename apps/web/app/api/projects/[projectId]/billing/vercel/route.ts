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

  // Fetch env var names from Vercel (no decrypt — personal tokens can't decrypt values)
  const vercelRes = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId)}/env`,
    { headers: { Authorization: `Bearer ${vercelToken}` } }
  );

  if (!vercelRes.ok) {
    const s = vercelRes.status;
    let error = "Vercel API error";
    if (s === 401 || s === 403) {
      error = "Invalid Vercel token. Go to vercel.com/account/tokens and create a new one with Full Account scope.";
    } else if (s === 404) {
      error = "Vercel project not found. Use the exact project name from your Vercel dashboard URL.";
    }
    return NextResponse.json({ error }, { status: 400 });
  }

  const vercelData = await vercelRes.json();
  const envKeys: string[] = (vercelData.envs ?? [])
    .filter((e: { type: string }) => e.type !== "system")
    .map((e: { key: string }) => e.key);

  // Match env var NAMES to vendor IDs (no values needed)
  const detectedVendors: string[] = [];
  for (const key of envKeys) {
    for (const { re, vendorId } of ENV_VENDOR_PATTERNS) {
      if (re.test(key) && !detectedVendors.includes(vendorId)) {
        detectedVendors.push(vendorId);
      }
    }
  }

  // Return detected vendor names and instructions to pull values locally
  return NextResponse.json({
    updated: 0,
    vendors: detectedVendors,
    pullHint: detectedVendors.length > 0,
    totalEnvVars: envKeys.length, // helpful for debugging
  });
}
