import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/scans/:scanId — full scan detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scanId } = await params;
  const scan = await db.scan.findUnique({
    where: { id: scanId },
    include: {
      findings: true,
      unknownDomains: { take: 100 },
      project: {
        include: {
          org: { include: { memberships: { where: { userId: session.user.id } } } },
        },
      },
    },
  });

  if (!scan || scan.project.org.memberships.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ scan });
}
