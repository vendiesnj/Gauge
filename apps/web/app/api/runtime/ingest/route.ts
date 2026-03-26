import { NextRequest, NextResponse } from "next/server";
import { normalizeRuntimeEvent, RawHttpEvent } from "@api-spend/runtime-ingest";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Auth: per-project API token
  const token = req.headers.get("x-api-token") ?? req.headers.get("x-scan-upload-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devToken = process.env.SCAN_UPLOAD_TOKEN ?? "dev-local-token";

  let projectId: string | null = null;
  if (token !== devToken) {
    const apiToken = await db.apiToken.findUnique({ where: { token } });
    if (!apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    projectId = apiToken.projectId;
    await db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsed: new Date() } });
  }

  const raw = (await req.json()) as RawHttpEvent & { projectId?: string };
  const normalized = normalizeRuntimeEvent(raw);

  if (!normalized) {
    return NextResponse.json({ ok: false, reason: "Vendor not recognized from URL" }, { status: 400 });
  }

  const resolvedProjectId = projectId ?? raw.projectId ?? null;
  if (!resolvedProjectId) {
    return NextResponse.json({ ok: false, reason: "projectId required" }, { status: 400 });
  }

  const event = await db.usageEvent.create({
    data: {
      projectId: resolvedProjectId,
      vendorId: normalized.vendorId,
      timestamp: new Date(normalized.timestamp),
      environment: normalized.environment,
      service: normalized.service,
      endpoint: normalized.endpoint,
      usageQuantity: normalized.usageQuantity,
      unit: normalized.unit,
      costUsd: normalized.costUsd,
    },
  });

  return NextResponse.json({ ok: true, event });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ events: [] });

  const events = await db.usageEvent.findMany({
    where: { projectId },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  return NextResponse.json({ events });
}
