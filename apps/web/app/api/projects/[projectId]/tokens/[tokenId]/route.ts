import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/projects/:projectId/tokens/:tokenId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; tokenId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, tokenId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.apiToken.deleteMany({ where: { id: tokenId, projectId } });
  return NextResponse.json({ ok: true });
}
