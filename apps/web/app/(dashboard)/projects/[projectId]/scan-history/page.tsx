import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

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

      {scans.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="muted small">No scans yet. Upload a scan from the VS Code extension.</div>
          </div>
        </div>
      ) : (
        <div className="stack gap-8">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              href={`/scans/${scan.id}`}
              className="card card-hover"
              style={{ display: "block" }}
            >
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="row gap-8">
                  <span style={{ fontWeight: 600 }}>
                    {scan.scannedAt
                      ? new Date(scan.scannedAt).toLocaleString()
                      : new Date(scan.createdAt).toLocaleString()}
                  </span>
                  <span className={`badge ${
                    scan.status === "COMPLETE" ? "badge-high" :
                    scan.status === "FAILED" ? "badge-danger" : "badge-medium"
                  }`}>{scan.status.toLowerCase()}</span>
                </div>
                <span className="muted small">{scan.triggeredBy}</span>
              </div>

              <div className="row gap-16 muted small" style={{ marginBottom: 8 }}>
                <span>{scan._count.findings} vendor{scan._count.findings !== 1 ? "s" : ""}</span>
                {scan.totalFilesScanned && <span>{scan.totalFilesScanned} files</span>}
                {scan._count.unknownDomains > 0 && <span>{scan._count.unknownDomains} unknown domains</span>}
              </div>

              {scan.findings.length > 0 && (
                <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                  {scan.findings.map((f) => (
                    <span key={f.vendorId} className={`badge badge-${f.category}`} style={{ fontSize: 10.5 }}>
                      {f.vendorName}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
