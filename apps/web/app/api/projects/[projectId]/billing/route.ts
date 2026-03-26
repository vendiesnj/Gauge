/**
 * POST /api/projects/:projectId/billing/recalculate
 * Triggers a billing refresh from .env key-value pairs provided in the request body.
 * Also handles the recalculate button (no body needed — just refreshes via router).
 *
 * POST body (optional): { envContent: string }  — raw .env file text
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

function parseEnvContent(content: string): Array<{ key: string; value: string }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => {
      const eq = line.indexOf("=");
      if (eq === -1) return [];
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      return value ? [{ key, value }] : [];
    });
}

// Match env key names to vendor IDs using common patterns
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

  let rawKeys: Array<{ vendorId: string; value: string }> = [];

  // If env content provided, parse and match to vendors
  const body = await req.json().catch(() => ({}));
  if (body.envContent && typeof body.envContent === "string") {
    const pairs = parseEnvContent(body.envContent);
    for (const { key, value } of pairs) {
      for (const { re, vendorId } of ENV_VENDOR_PATTERNS) {
        if (re.test(key) && value.length > 8) {
          rawKeys.push({ vendorId, value });
          break;
        }
      }
    }
  }

  // Fetch billing data for matched keys
  if (rawKeys.length > 0) {
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

    return NextResponse.json({ updated: billingResults.length, vendors: billingResults.map((r) => r.vendorId) });
  }

  // No env content — just a recalculate signal (client will router.refresh())
  return NextResponse.json({ updated: 0 });
}
