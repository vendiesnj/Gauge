import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function assertAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId } } } } },
  });
  return project && project.org.memberships.length > 0 ? project : null;
}

// GET /api/projects/:projectId/plans
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  if (!await assertAccess(session.user.id, projectId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plans = await db.vendorPlan.findMany({ where: { projectId } });
  return NextResponse.json({ plans });
}

// POST /api/projects/:projectId/plans — upsert a vendor plan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  if (!await assertAccess(session.user.id, projectId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { vendorId, planName, monthlySpendUsd, monthlyCommitUsd, usageIncluded, unit } = body;
  if (!vendorId || !planName) return NextResponse.json({ error: "vendorId and planName required" }, { status: 400 });

  const plan = await db.vendorPlan.upsert({
    where: { projectId_vendorId: { projectId, vendorId } },
    update: {
      planName,
      monthlySpendUsd: monthlySpendUsd != null ? Number(monthlySpendUsd) : null,
      monthlyCommitUsd: monthlyCommitUsd != null ? Number(monthlyCommitUsd) : null,
      usageIncluded: usageIncluded != null ? Number(usageIncluded) : null,
      unit: unit ?? null,
    },
    create: {
      projectId,
      vendorId,
      planName,
      monthlySpendUsd: monthlySpendUsd != null ? Number(monthlySpendUsd) : null,
      monthlyCommitUsd: monthlyCommitUsd != null ? Number(monthlyCommitUsd) : null,
      usageIncluded: usageIncluded != null ? Number(usageIncluded) : null,
      unit: unit ?? null,
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}

// DELETE /api/projects/:projectId/plans?vendorId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  if (!await assertAccess(session.user.id, projectId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const vendorId = req.nextUrl.searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 });

  await db.vendorPlan.deleteMany({ where: { projectId, vendorId } });
  return NextResponse.json({ ok: true });
}
