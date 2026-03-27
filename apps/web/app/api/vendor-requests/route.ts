import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/vendor-requests — returns { vendorId: count } map (public, for social proof)
export async function GET() {
  const counts = await db.vendorRequest.groupBy({
    by: ["vendorId"],
    _count: { vendorId: true },
    orderBy: { _count: { vendorId: "desc" } },
  });

  const result: Record<string, number> = {};
  for (const row of counts) {
    result[row.vendorId] = row._count.vendorId;
  }

  return NextResponse.json(result);
}

// POST /api/vendor-requests — { email, vendorIds: string[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !Array.isArray(body.vendorIds) || body.vendorIds.length === 0) {
    return NextResponse.json({ error: "email and vendorIds required" }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  const vendorIds: string[] = body.vendorIds.slice(0, 50); // cap at 50

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Upsert each — ignore duplicates (same email + vendor)
  await db.$transaction(
    vendorIds.map((vendorId) =>
      db.vendorRequest.upsert({
        where: { email_vendorId: { email, vendorId } },
        update: {},
        create: { email, vendorId },
      })
    )
  );

  return NextResponse.json({ ok: true, saved: vendorIds.length });
}
