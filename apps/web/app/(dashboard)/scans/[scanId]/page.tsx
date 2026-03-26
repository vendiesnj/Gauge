import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { DetectionEvidence } from "@api-spend/shared";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Scan results" };

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { scanId } = await params;

  const scan = await db.scan.findUnique({
    where: { id: scanId },
    include: {
      findings: true,
      unknownDomains: { take: 100 },
      project: {
        include: {
          org: { include: { memberships: { where: { userId: session.user.id } } } },
        },
      },
    },
  });

  if (!scan || scan.project.org.memberships.length === 0) notFound();

  const confidenceOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sortedFindings = [...scan.findings].sort(
    (a, b) => (confidenceOrder[b.confidence] ?? 0) - (confidenceOrder[a.confidence] ?? 0)
  );

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <div className="muted small" style={{ marginBottom: 6 }}>
          <Link href="/projects">Projects</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <Link href={`/projects/${scan.project.id}`}>{scan.project.name}</Link>
          <span style={{ margin: "0 6px" }}>›</span>
          Scan
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="heading-lg">Scan results</h1>
          <span className={`badge ${scan.status === "COMPLETE" ? "badge-high" : scan.status === "FAILED" ? "badge-danger" : "badge-medium"}`}>
            {scan.status.toLowerCase()}
          </span>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : new Date(scan.createdAt).toLocaleString()}
          {scan.totalFilesScanned && ` · ${scan.totalFilesScanned} files scanned`}
          {` · ${scan.triggeredBy}`}
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card-sm">
          <div className="kpi-label">Vendors detected</div>
          <div className="kpi">{scan.findings.length}</div>
        </div>
        <div className="card-sm">
          <div className="kpi-label">Files scanned</div>
          <div className="kpi">{scan.totalFilesScanned ?? "—"}</div>
        </div>
        <div className="card-sm">
          <div className="kpi-label">Unknown domains</div>
          <div className="kpi">{scan.unknownDomains.length}</div>
        </div>
      </div>

      {/* Findings */}
      {sortedFindings.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="muted small">No vendors detected in this scan.</div>
          </div>
        </div>
      ) : (
        <div className="stack gap-16">
          {sortedFindings.map((finding) => {
            const evidences = finding.evidences as unknown as DetectionEvidence[];
            const detectedKeys = finding.detectedApiKeys as unknown as { pattern: string; filePath: string; line: number; redactedValue: string }[];
            const alternatives = finding.alternatives as unknown as { vendorId: string; rationale: string; estimatedSavingsPct?: number }[];

            return (
              <div key={finding.id} className="card">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div className="row gap-10">
                    <span className="heading-md">{finding.vendorName}</span>
                    <span className={`badge badge-${finding.category}`}>{finding.category}</span>
                    <span className={`badge badge-${finding.confidence}`}>{finding.confidence} confidence</span>
                  </div>
                  <span className="muted small">{finding.pricingModel.replace(/_/g, " ")}</span>
                </div>

                {/* Evidence */}
                <div style={{ marginBottom: evidences.length > 0 ? 14 : 0 }}>
                  <div className="muted small" style={{ marginBottom: 6, fontWeight: 600 }}>
                    Detection evidence ({evidences.length})
                  </div>
                  <div className="stack gap-2">
                    {evidences.slice(0, 8).map((ev, i) => (
                      <div key={i} className="evidence-item">
                        <span className={`evidence-source source-${ev.source}`}>{ev.source.replace(/_/g, " ")}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <code style={{ fontSize: 12, wordBreak: "break-all" }}>{ev.match}</code>
                          <div className="muted small" style={{ marginTop: 2 }}>
                            {ev.filePath}:{ev.line}
                          </div>
                        </div>
                        <span className={`badge badge-${ev.confidence}`} style={{ fontSize: 10, flexShrink: 0 }}>
                          {ev.confidence}
                        </span>
                      </div>
                    ))}
                    {evidences.length > 8 && (
                      <div className="muted small">+{evidences.length - 8} more evidence items</div>
                    )}
                  </div>
                </div>

                {/* Redacted API keys */}
                {detectedKeys.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="muted small" style={{ marginBottom: 6, fontWeight: 600 }}>
                      Detected key patterns ({detectedKeys.length}) — all redacted
                    </div>
                    <div className="stack gap-2">
                      {detectedKeys.map((k, i) => (
                        <div key={i} className="card-sm" style={{ background: "var(--danger-bg)", border: "1px solid rgba(248,113,113,0.15)" }}>
                          <div className="row gap-8">
                            <span className="badge badge-danger" style={{ fontSize: 10 }}>{k.pattern}</span>
                            <code style={{ fontSize: 12 }}>{k.redactedValue}</code>
                            <span className="muted small">{k.filePath}:{k.line}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <div>
                    <div className="muted small" style={{ marginBottom: 6, fontWeight: 600 }}>Cheaper alternatives</div>
                    <div className="stack gap-4">
                      {alternatives.map((alt, i) => (
                        <div key={i} className="card-sm" style={{ background: "var(--good-bg)", border: "1px solid rgba(34,211,168,0.15)" }}>
                          <div className="row gap-8">
                            {alt.estimatedSavingsPct && (
                              <span className="badge badge-high">{alt.estimatedSavingsPct}% savings</span>
                            )}
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{alt.vendorId}</span>
                          </div>
                          <p className="muted small" style={{ marginTop: 4 }}>{alt.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unknown domains */}
      {scan.unknownDomains.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="heading-sm" style={{ marginBottom: 12 }}>
            Unknown domains ({scan.unknownDomains.length})
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            These domains were found in HTTP calls but didn&apos;t match any known vendor. They may represent internal services or untracked third-party APIs.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>File</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>
              {scan.unknownDomains.slice(0, 50).map((d) => (
                <tr key={d.id}>
                  <td><code style={{ fontSize: 12 }}>{d.domain}</code></td>
                  <td className="muted small">{d.filePath}</td>
                  <td className="muted small">{d.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {scan.notes.length > 0 && (
        <div className="card" style={{ marginTop: 20, background: "var(--panel-2)" }}>
          {scan.notes.map((note, i) => (
            <div key={i} className="muted small row gap-6" style={{ marginBottom: i < scan.notes.length - 1 ? 6 : 0 }}>
              <span>ℹ</span> {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
