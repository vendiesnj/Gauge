/**
 * POST /api/github/webhook
 * Handles GitHub App push events — triggers auto-scan on push to default branch.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { createHmac } from "crypto";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (event !== "push") return NextResponse.json({ skipped: true });

  const payload = JSON.parse(body);
  const repoFullName: string = payload.repository?.full_name ?? "";
  const [repoOwner, repoName] = repoFullName.split("/");

  if (!repoOwner || !repoName) return NextResponse.json({ skipped: true });

  // Only trigger on default branch pushes
  const defaultBranch: string = payload.repository?.default_branch ?? "main";
  const ref: string = payload.ref ?? "";
  if (ref !== `refs/heads/${defaultBranch}`) return NextResponse.json({ skipped: true });

  // Find all projects linked to this repo
  const projects = await db.project.findMany({
    where: { repoOwner, repoName },
    select: { id: true },
  });

  const triggered: string[] = [];
  for (const project of projects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scan = await (db.scan as any).create({
      data: {
        projectId: project.id,
        triggeredBy: "github_push",
        status: "PENDING",
      },
    }) as { id: string };

    await inngest.send({
      name: "scan/project.requested",
      data: {
        scanId: scan.id,
        projectId: project.id,
        type: "github",
        userId: "system",
        repoOwner,
        repoName,
        fetchBilling: "false",
      },
    });
    triggered.push(project.id);
  }

  return NextResponse.json({ triggered: triggered.length });
}
