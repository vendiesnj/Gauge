import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/orgs — list orgs for the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.orgMembership.findMany({
    where: { userId: session.user.id },
    include: { org: { include: { _count: { select: { projects: true } } } } },
    orderBy: { org: { createdAt: "asc" } },
  });

  return NextResponse.json({ orgs: memberships.map((m) => ({ ...m.org, role: m.role })) });
}

// POST /api/orgs — create a new org
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  // Ensure unique slug
  const existing = await db.organization.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const org = await db.organization.create({
    data: {
      name,
      slug: finalSlug,
      memberships: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
  });

  return NextResponse.json({ org }, { status: 201 });
}
