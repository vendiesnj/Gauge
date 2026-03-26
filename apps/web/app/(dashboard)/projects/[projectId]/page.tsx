import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { buildCostInsights, VENDOR_MAP } from "@api-spend/shared";
import Link from "next/link";
import { AddPlanForm } from "./AddPlanForm";
import { ScanTriggerCard } from "./ScanTriggerCard";
import { ApiTokenCard } from "./ApiTokenCard";
import { GlidepathSection } from "./GlidepathSection";
import { RecalculateButton } from "./RecalculateButton";
import { SpendTrendChart } from "./SpendTrendChart";
import { ConnectVendorCard } from "./ConnectVendorCard";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({
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
      vendorPlans: true,
      apiTokens: true,
      scans: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          findings: true,
          _count: { select: { findings: true, unknownDomains: true } },
        },
      },
    },
  });

  if (!project || project.org.memberships.length === 0) notFound();

  const usageEvents = await db.usageEvent.findMany({
    where: { projectId },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  // Build cost insights
  const plans = project.vendorPlans.map((p) => ({
    vendorId: p.vendorId,
    planName: p.planName,
    monthlySpendUsd: p.monthlySpendUsd ?? undefined,
    monthlyCommitUsd: p.monthlyCommitUsd ?? undefined,
    usageIncluded: p.usageIncluded ?? undefined,
    unit: p.unit ?? undefined,
  }));

  const events = usageEvents.map((e) => ({
    vendorId: e.vendorId,
    timestamp: e.timestamp.toISOString(),
    environment: e.environment,
    service: e.service,
    endpoint: e.endpoint ?? undefined,
    usageQuantity: e.usageQuantity,
    unit: e.unit as "requests" | "tokens" | "images" | "minutes" | "unknown",
    costUsd: e.costUsd ?? undefined,
  }));

  const insights = plans.length > 0 ? buildCostInsights(plans, events) : [];

  const totalSpend = insights.reduce((s, i) => s + i.monthlySpendUsd, 0);
  const totalUnused = insights.reduce((s, i) => s + i.estimatedUnusedSpendUsd, 0);
  const totalAlt = insights.reduce((s, i) => s + (i.alternativeStackMonthlyUsd ?? i.monthlySpendUsd), 0);
  const hasEstimates = project.vendorPlans.some((p) => p.source === "estimated");

  // Latest scan
  const latestScan = project.scans[0];
  const allDetectedVendors = new Map<string, { vendorId: string; vendorName: string; category: string; confidence: string }>();
  for (const scan of project.scans) {
    for (const f of scan.findings) {
      if (!allDetectedVendors.has(f.vendorId)) {
        allDetectedVendors.set(f.vendorId, {
          vendorId: f.vendorId,
          vendorName: f.vendorName,
          category: f.category,
          confidence: f.confidence,
        });
      }
    }
  }

  const detectedVendors = [...allDetectedVendors.values()];

  return (
    <div className="page-body">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div className="muted small" style={{ marginBottom: 6 }}>
            <Link href="/projects">Projects</Link>
            <span style={{ margin: "0 6px" }}>›</span>
            {project.name}
          </div>
          <h1 className="heading-lg">{project.name}</h1>
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="muted small row gap-4" style={{ marginTop: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              {project.repoOwner}/{project.repoName}
            </a>
          )}
        </div>
        <Link href={`/projects/${projectId}/scan-history`} className="btn btn-secondary btn-sm">
          Scan history
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid-3" style={{ margin: "20px 0" }}>
        <div className="card">
          <div className="kpi-label">Monthly spend</div>
          <div className="kpi">
            {plans.length > 0 ? `$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {plans.length > 0 ? `${plans.length} vendor${plans.length !== 1 ? "s" : ""} tracked` : "Add vendor plans below"}
            {hasEstimates && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--warn)" }}>· based on estimates</span>}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Unused spend</div>
          <div className="kpi" style={{ color: totalUnused > 0 ? "var(--warn)" : undefined }}>
            {plans.length > 0 ? `$${totalUnused.toFixed(0)}` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {totalUnused > 0 ? "Paid capacity not being used" : "Upload .env to detect wasted capacity"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Potential savings</div>
          <div className="kpi" style={{ color: totalSpend > 0 && totalAlt < totalSpend ? "var(--good)" : undefined }}>
            {plans.length > 0 && totalSpend > 0 ? `$${(totalSpend - totalAlt).toFixed(0)}/mo` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {plans.length > 0 && totalSpend > 0
              ? totalAlt < totalSpend
                ? `vs $${totalAlt.toFixed(0)}/mo alt stack`
                : "Already on optimal stack"
              : "Based on detected alternatives"}
          </div>
        </div>
      </div>

      <SpendTrendChart projectId={projectId} />

      <div className="grid-2" style={{ gap: 20 }}>
        {/* Left column */}
        <div className="stack gap-16">

          {/* Detected vendors */}
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <div className="heading-sm">Detected vendors</div>
              {latestScan && (
                <span className="muted small">
                  Last scan: {new Date(latestScan.createdAt).toLocaleDateString()}
                  {latestScan.totalFilesScanned && ` · ${latestScan.totalFilesScanned} files`}
                </span>
              )}
            </div>

            {detectedVendors.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <div className="muted small">No scans yet. Upload a scan file or use the VS Code extension.</div>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Confidence</th>
                    <th>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedVendors.map((v) => {
                    const plan = project.vendorPlans.find((p) => p.vendorId === v.vendorId);
                    const vendorDef = VENDOR_MAP[v.vendorId];
                    return (
                      <tr key={v.vendorId}>
                        <td style={{ fontWeight: 600 }}>{v.vendorName}</td>
                        <td>
                          <span className={`badge badge-${v.category}`}>{v.category}</span>
                        </td>
                        <td>
                          <span className={`badge badge-${v.confidence}`}>{v.confidence}</span>
                        </td>
                        <td>
                          {plan ? (
                            <span className="row gap-4" style={{ alignItems: "center" }}>
                              <span className="small" style={{ fontWeight: 500 }}>{plan.planName}</span>
                              {plan.source === "estimated" && (
                                <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(234,179,8,0.15)", color: "var(--warn)", border: "1px solid rgba(234,179,8,0.3)" }}>est</span>
                              )}
                            </span>
                          ) : (
                            <span className="muted small">{vendorDef?.pricingModel ?? "—"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Spend & recommendations */}
          {insights.length > 0 && (
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <div className="heading-sm">Spend & recommendations</div>
                <RecalculateButton projectId={projectId} />
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Monthly</th>
                    <th>Unused</th>
                    <th>Alt estimate</th>
                    <th>Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((insight) => {
                    const vendor = VENDOR_MAP[insight.vendorId];
                    const alt = vendor?.alternatives[0];
                    const altVendor = alt ? VENDOR_MAP[alt.vendorId] : null;
                    return (
                      <tr key={insight.vendorId}>
                        <td style={{ fontWeight: 600 }}>{insight.vendorName}</td>
                        <td>${insight.monthlySpendUsd.toFixed(0)}</td>
                        <td>
                          {insight.estimatedUnusedSpendUsd > 0 ? (
                            <span className="text-warn">${insight.estimatedUnusedSpendUsd.toFixed(0)}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {insight.alternativeStackMonthlyUsd != null ? (
                            <span>
                              ${insight.alternativeStackMonthlyUsd.toFixed(0)}
                              {altVendor && <span className="muted small"> ({altVendor.name})</span>}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {insight.savingsVsAlternativePct != null ? (
                            <span className="text-good" style={{ fontWeight: 700 }}>
                              {insight.savingsVsAlternativePct.toFixed(0)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {insights.some((i) => i.notes.length > 0) && (
                <div style={{ marginTop: 12 }}>
                  {insights.flatMap((i) => i.notes).map((note, idx) => (
                    <div key={idx} className="muted small row gap-6" style={{ marginBottom: 4 }}>
                      <span>ℹ</span> {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scan history preview */}
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <div className="heading-sm">Recent scans</div>
              <Link href={`/projects/${projectId}/scan-history`} className="muted small" style={{ color: "var(--accent)" }}>
                View all →
              </Link>
            </div>
            {project.scans.length === 0 ? (
              <div className="muted small">No scans yet.</div>
            ) : (
              <div className="stack gap-4">
                {project.scans.map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/scans/${scan.id}`}
                    className="card-sm card-hover"
                    style={{ display: "block" }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="small" style={{ fontWeight: 500 }}>
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                      <span className={`badge ${scan.status === "COMPLETE" ? "badge-high" : scan.status === "FAILED" ? "badge-danger" : "badge-medium"}`}>
                        {scan.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {scan._count.findings} vendor{scan._count.findings !== 1 ? "s" : ""} detected
                      {scan.totalFilesScanned && ` · ${scan.totalFilesScanned} files`}
                      {" · "}{scan.triggeredBy}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="stack gap-16">
          <ScanTriggerCard
            projectId={projectId}
            repoOwner={project.repoOwner}
            repoName={project.repoName}
          />
          <ConnectVendorCard projectId={projectId} />
          <AddPlanForm projectId={projectId} existingPlans={project.vendorPlans.map((p) => p.vendorId)} />
          <ApiTokenCard projectId={projectId} tokens={project.apiTokens.map((t) => ({ id: t.id, name: t.name, token: t.token, createdAt: t.createdAt.toISOString() }))} />

          {/* Plan discovery notes */}
          <div className="card" style={{ background: "var(--panel-2)" }}>
            <div className="heading-sm" style={{ marginBottom: 10 }}>Plan discovery notes</div>
            <div className="stack gap-6">
              {detectedVendors.map((v) => {
                const def = VENDOR_MAP[v.vendorId];
                if (!def) return null;
                return (
                  <div key={v.vendorId} className="card-sm" style={{ padding: "10px 12px" }}>
                    <div className="row gap-8" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{def.name}</span>
                      {def.planDiscovery.canOAuth && (
                        <span className="badge badge-high" style={{ fontSize: 10 }}>OAuth possible</span>
                      )}
                    </div>
                    <p className="muted small">{def.planDiscovery.notes}</p>
                  </div>
                );
              })}
              {detectedVendors.length === 0 && (
                <p className="muted small">Scan the project to see plan discovery notes for detected vendors.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Glidepath — cost at scale */}
      <div style={{ marginTop: 28 }}>
        <GlidepathSection projectId={projectId} />
      </div>
    </div>
  );
}
