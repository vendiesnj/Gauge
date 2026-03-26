/**
 * POST /api/projects/:projectId/scan
 *
 * Accepts type=github or type=zip.
 * Creates a scan record immediately, queues an Inngest job, and returns
 * { scanId } so the client can poll for completion. Non-blocking.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

async function assertProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId } } } } },
  });
  return project && project.org.memberships.length > 0 ? project : null;
}

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

  const formData = await req.formData();
  const type = formData.get("type") as string;
  const fetchBilling = formData.get("fetchBilling") as string | null;

  if (type !== "github" && type !== "zip") {
    return NextResponse.json(
      { error: "type must be 'github' or 'zip'" },
      { status: 400 }
    );
  }

  // For zip uploads, encode the file as base64 before handing off
  let zipPayload: string | undefined;
  if (type === "zip") {
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    zipPayload = buf.toString("base64");
  }

  // Create scan record synchronously so the UI has an ID immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scan = await (db.scan as any).create({
    data: {
      projectId,
      triggeredBy: type === "github" ? "github" : "upload",
      status: "PENDING",
      ...(zipPayload ? { zipPayload } : {}),
    },
  }) as { id: string };

  // Dispatch to Inngest — returns immediately
  await inngest.send({
    name: "scan/project.requested",
    data: {
      scanId: scan.id,
      projectId,
      type,
      userId: session.user.id,
      repoOwner: project.repoOwner ?? "",
      repoName: project.repoName ?? "",
      fetchBilling: fetchBilling ?? "false",
    },
  });

  return NextResponse.json({ scanId: scan.id });
}
