import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCostInsights } from "@api-spend/shared";

async function assertProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { memberships: { where: { userId } } } },
    },
  });
  if (!project || project.org.memberships.length === 0) return null;
  return project;
}

// GET /api/projects/:projectId — project detail + latest insights
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await assertProjectAccess(session.user.id, projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [scans, vendorPlans, usageEvents] = await Promise.all([
    db.scan.findMany({
      where: { projectId },
      include: { findings: true, _count: { select: { findings: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.vendorPlan.findMany({ where: { projectId } }),
    db.usageEvent.findMany({
      where: { projectId },
      orderBy: { timestamp: "desc" },
      take: 500,
    }),
  ]);

  const plans = vendorPlans.map((p) => ({
    vendorId: p.vendorId,
    planName: p.planName,
    monthlySpendUsd: p.monthlySpendUsd ?? undefined,
    monthlyCommitUsd: p.monthlyCommitUsd ?? undefined,
    usageIncluded: p.usageIncluded ?? undefined,
    unit: p.unit ?? undefined,
  }));

  const events = usageEvents.map((e) => ({
    vendorId: e.vendorId,
    timestamp: e.timestamp.toISOString(),
    environment: e.environment,
    service: e.service,
    endpoint: e.endpoint ?? undefined,
    usageQuantity: e.usageQuantity,
    unit: e.unit as "requests" | "tokens" | "images" | "minutes" | "unknown",
    costUsd: e.costUsd ?? undefined,
  }));

  const insights = plans.length > 0 ? buildCostInsights(plans, events) : [];

  return NextResponse.json({ project, scans, vendorPlans, insights });
}

// PATCH /api/projects/:projectId — update project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await assertProjectAccess(session.user.id, projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await db.project.update({
    where: { id: projectId },
    data: {
      name: body.name ? String(body.name).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      repoUrl: body.repoUrl !== undefined ? String(body.repoUrl).trim() : undefined,
    },
  });

  return NextResponse.json({ project: updated });
}
