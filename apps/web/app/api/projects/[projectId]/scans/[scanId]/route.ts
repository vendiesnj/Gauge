/**
 * GET /api/projects/:projectId/scans/:scanId
 * Returns scan status + summary for polling from the UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, scanId } = await params;

  // Verify project access
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scan = await db.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      status: true,
      totalFilesScanned: true,
      notes: true,
      scannedAt: true,
      _count: { select: { findings: true } },
    },
  });

  if (!scan)
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  return NextResponse.json({
    scanId: scan.id,
    status: scan.status,
    vendorsDetected: scan._count.findings,
    filesScanned: scan.totalFilesScanned,
    notes: scan.notes,
    scannedAt: scan.scannedAt,
  });
}

// DELETE /api/projects/:projectId/scans/:scanId — cancel a pending/running scan
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, scanId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scan = await db.scan.findUnique({ where: { id: scanId }, select: { status: true } });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (scan.status === "COMPLETE" || scan.status === "FAILED")
    return NextResponse.json({ error: "Scan already finished" }, { status: 400 });

  // If pending/running, cancel it; otherwise delete it entirely
  if (scan.status === "PENDING" || scan.status === "RUNNING") {
    await db.scan.update({
      where: { id: scanId },
      data: { status: "FAILED", notes: ["Cancelled by user"] },
    });
  } else {
    await db.scan.delete({ where: { id: scanId } });
  }

  return NextResponse.json({ ok: true });
}
