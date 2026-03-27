import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchOpenAI, fetchAnthropic } from "@/lib/billing";

async function assertProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId } } } } },
  });
  return project && project.org.memberships.length > 0 ? project : null;
}

const FETCHERS: Record<string, (key: string) => Promise<{ keyValid?: boolean; billingAccess?: boolean; verifyError?: string; monthlySpendUsd: number } | null>> = {
  openai: fetchOpenAI,
  anthropic: fetchAnthropic,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const project = await assertProjectAccess(session.user.id, projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { vendorId, apiKey } = await req.json();
  if (!vendorId || !apiKey)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const fetcher = FETCHERS[vendorId];
  if (!fetcher)
    return NextResponse.json({ error: "Unsupported vendor" }, { status: 400 });

  const result = await fetcher(apiKey);

  if (!result) {
    return NextResponse.json({ keyValid: false, billingAccess: false, verifyError: "Invalid key" });
  }

  return NextResponse.json({
    keyValid: result.keyValid ?? true,
    billingAccess: result.billingAccess ?? true,
    verifyError: result.verifyError ?? null,
    monthlySpendUsd: result.monthlySpendUsd,
  });
}
