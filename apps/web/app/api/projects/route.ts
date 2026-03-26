import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects?orgId=xxx — list projects in an org
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  // Verify membership
  const membership = await db.orgMembership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projects = await db.project.findMany({
    where: { orgId },
    include: {
      _count: { select: { scans: true, usageEvents: true } },
      scans: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

// POST /api/projects — create a project
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orgId, name, description, repoUrl } = body;

  if (!orgId || !name) return NextResponse.json({ error: "orgId and name required" }, { status: 400 });

  const membership = await db.orgMembership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const existing = await db.project.findUnique({ where: { orgId_slug: { orgId, slug } } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  // Parse GitHub repo URL if provided
  let repoOwner: string | undefined;
  let repoName: string | undefined;
  if (repoUrl) {
    const match = String(repoUrl).match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      repoOwner = match[1];
      repoName = match[2].replace(/\.git$/, "");
    }
  }

  const project = await db.project.create({
    data: {
      orgId,
      name: String(name).trim(),
      slug: finalSlug,
      description: description ? String(description).trim() : null,
      repoUrl: repoUrl ? String(repoUrl).trim() : null,
      repoOwner,
      repoName,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
