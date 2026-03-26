/**
 * GET /api/projects/:projectId/pricing
 *
 * Returns pricing tiers for all vendors detected in the project's latest scan,
 * plus current usage + plan data — everything the glidepath chart needs.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { memberships: { where: { userId: session.user.id } } } },
      vendorPlans: true,
    },
  });

  if (!project || project.org.memberships.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get detected vendors from latest scan
  const latestScan = await db.scan.findFirst({
    where: { projectId, status: "COMPLETE" },
    orderBy: { createdAt: "desc" },
    include: { findings: { select: { vendorId: true, vendorName: true } } },
  });

  const detectedVendorIds = latestScan?.findings.map((f) => f.vendorId) ?? [];

  // Fetch pricing tiers for detected vendors
  const pricingTiers = await db.vendorPricingTier.findMany({
    where: { vendorId: { in: detectedVendorIds } },
    orderBy: [{ vendorId: "asc" }, { tierOrder: "asc" }],
  });

  // Get last 30 days of usage per vendor for current-usage marker
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const usageByVendor = await db.usageEvent.groupBy({
    by: ["vendorId", "unit"],
    where: { projectId, timestamp: { gte: thirtyDaysAgo } },
    _sum: { usageQuantity: true },
  });

  // Shape usage into a map: vendorId → { quantity, unit }
  const usageMap: Record<string, { quantity: number; unit: string }> = {};
  for (const row of usageByVendor) {
    usageMap[row.vendorId] = {
      quantity: row._sum.usageQuantity ?? 0,
      unit: row.unit,
    };
  }

  // Shape plans: vendorId → plan
  const planMap = Object.fromEntries(project.vendorPlans.map((p) => [p.vendorId, p]));

  // Group tiers by vendor
  const tiersByVendor: Record<string, typeof pricingTiers> = {};
  for (const tier of pricingTiers) {
    if (!tiersByVendor[tier.vendorId]) tiersByVendor[tier.vendorId] = [];
    tiersByVendor[tier.vendorId].push(tier);
  }

  return NextResponse.json({
    vendors: detectedVendorIds.map((vendorId) => ({
      vendorId,
      vendorName: latestScan?.findings.find((f) => f.vendorId === vendorId)?.vendorName ?? vendorId,
      tiers: tiersByVendor[vendorId] ?? [],
      currentUsage: usageMap[vendorId] ?? null,
      currentPlan: planMap[vendorId] ?? null,
    })),
  });
}
