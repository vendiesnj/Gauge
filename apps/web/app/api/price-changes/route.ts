import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/price-changes — recent vendor price changes, newest first
export async function GET() {
  const changes = await db.priceChangeLog.findMany({
    orderBy: { detectedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(changes);
}
