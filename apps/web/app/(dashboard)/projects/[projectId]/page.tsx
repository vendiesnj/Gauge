import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { buildCostInsights, VENDOR_MAP } from "@api-spend/shared";
import Link from "next/link";
import { RecalculateButton } from "./RecalculateButton";
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
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { findings: true },
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
  // Only show vendors we have real billing API connections for
  const connectedPlans = project.vendorPlans.filter((p) => p.source === "billing_api");

  const plans = connectedPlans.map((p) => ({
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
  const hasEstimates = false;

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
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div className="muted small" style={{ marginBottom: 6 }}>
            <Link href="/projects">Projects</Link>
            <span style={{ margin: "0 6px" }}>›</span>
            {project.name}
          </div>
          <h1 className="heading-lg">{project.name}</h1>
        </div>
        <Link href={`/projects/${projectId}/scan-history`} className="btn btn-secondary btn-sm">
          Scan history
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi-label">Monthly spend</div>
          <div className="kpi">
            {plans.length > 0 ? `$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {plans.length > 0 ? `${plans.length} vendor${plans.length !== 1 ? "s" : ""} tracked` : "Connect vendors below"}
            {hasEstimates && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--warn)" }}>· based on estimates</span>}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Unused spend</div>
          <div className="kpi" style={{ color: totalUnused > 0 ? "var(--warn)" : undefined }}>
            {plans.length > 0 ? `$${totalUnused.toFixed(0)}` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {totalUnused > 0 ? "Paid capacity not being used" : "No unused spend detected"}
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
              : "Connect vendors to see savings"}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        {/* Left — spend & recommendations */}
        <div className="stack gap-16">
          {insights.length > 0 ? (
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
          ) : (
            <div className="card">
              <div className="heading-sm" style={{ marginBottom: 10 }}>Spend & recommendations</div>
              <p className="muted small">Connect vendors on the right to start tracking spend and see cost-saving recommendations.</p>
            </div>
          )}
        </div>

        {/* Right — connect vendors */}
        <div>
          <ConnectVendorCard projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
