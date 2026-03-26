import { NextResponse } from "next/server";
import { VENDORS } from "@api-spend/shared";

export async function GET() {
  return NextResponse.json({ vendors: VENDORS });
}
