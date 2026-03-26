import { NextRequest, NextResponse } from "next/server";
import { ScanSummary } from "@api-spend/shared";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Auth: per-project API token stored in DB, or dev fallback
  const token = req.headers.get("x-scan-upload-token");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devToken = process.env.SCAN_UPLOAD_TOKEN ?? "dev-local-token";

  let projectId: string | null = null;

  if (token !== devToken) {
    // Look up project by API token
    const apiToken = await db.apiToken.findUnique({ where: { token } });
    if (!apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    projectId = apiToken.projectId;
    // Update lastUsed
    await db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsed: new Date() } });
  }

  const body = (await req.json()) as ScanSummary & { projectId?: string };

  // projectId can come from token lookup or body
  const resolvedProjectId = projectId ?? body.projectId ?? null;

  const scan = await db.scan.create({
    data: {
      projectId: resolvedProjectId ?? "dev", // will fail if "dev" project doesn't exist — acceptable for dev mode
      triggeredBy: "extension",
      status: "COMPLETE",
      scannedAt: body.scannedAt ? new Date(body.scannedAt) : new Date(),
      totalFilesScanned: body.totalFilesScanned,
      notes: body.notes ?? [],
      findings: {
        create: body.findings.map((f) => ({
          vendorId: f.vendorId,
          vendorName: f.vendorName,
          category: f.category,
          pricingModel: f.pricingModel,
          confidence: f.confidence,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          evidences: f.evidences as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          detectedApiKeys: f.detectedApiKeys as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          alternatives: f.alternativeSummary as any,
        })),
      },
      unknownDomains: {
        create: (body.unknownDomains ?? []).slice(0, 100).map((d) => ({
          domain: d.domain,
          filePath: d.filePath,
          line: d.line,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, scanId: scan.id });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ scans: [] });

  const scans = await db.scan.findMany({
    where: { projectId },
    include: { _count: { select: { findings: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ scans });
}
