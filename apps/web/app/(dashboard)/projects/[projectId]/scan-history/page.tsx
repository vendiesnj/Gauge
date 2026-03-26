import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ScanHistoryList } from "./ScanHistoryList";

export const metadata: Metadata = { title: "Scan history" };

export default async function ScanHistoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      org: { include: { memberships: { where: { userId: session.user.id } } } },
    },
  });

  if (!project || project.org.memberships.length === 0) notFound();

  const scans = await db.scan.findMany({
    where: { projectId },
    include: {
      findings: { select: { vendorId: true, vendorName: true, category: true, confidence: true } },
      _count: { select: { findings: true, unknownDomains: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>
          <Link href="/projects">Projects</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <Link href={`/projects/${projectId}`}>{project.name}</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          Scan history
        </div>
        <h1 className="heading-lg">Scan history</h1>
      </div>

      <ScanHistoryList projectId={projectId} scans={scans.map((scan) => ({
        id: scan.id,
        status: scan.status,
        triggeredBy: scan.triggeredBy,
        scannedAt: scan.scannedAt?.toISOString() ?? null,
        createdAt: scan.createdAt.toISOString(),
        totalFilesScanned: scan.totalFilesScanned,
        findingCount: scan._count.findings,
        unknownDomainCount: scan._count.unknownDomains,
        findings: scan.findings,
      }))} />
    </div>
  );
}
