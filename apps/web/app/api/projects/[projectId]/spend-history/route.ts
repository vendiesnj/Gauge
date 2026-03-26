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
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshots = await db.spendSnapshot.findMany({
    where: { projectId },
    orderBy: { monthYear: "asc" },
  });

  // Group by monthYear, sum across vendors
  const byMonth: Record<string, number> = {};
  const byVendorMonth: Record<string, Record<string, number>> = {};

  for (const snap of snapshots) {
    byMonth[snap.monthYear] = (byMonth[snap.monthYear] ?? 0) + snap.monthlySpendUsd;
    if (!byVendorMonth[snap.vendorId]) byVendorMonth[snap.vendorId] = {};
    byVendorMonth[snap.vendorId][snap.monthYear] = snap.monthlySpendUsd;
  }

  return NextResponse.json({ byMonth, byVendorMonth, snapshots });
}
