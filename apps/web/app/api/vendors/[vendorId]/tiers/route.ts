import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;

  const tiers = await db.vendorPricingTier.findMany({
    where: { vendorId },
    orderBy: { tierOrder: "asc" },
  });

  return NextResponse.json({ tiers });
}
