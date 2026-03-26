import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const memberships = await db.orgMembership.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          projects: {
            include: {
              scans: { orderBy: { createdAt: "desc" }, take: 1 },
              vendorPlans: true,
              _count: { select: { scans: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  const allProjects = memberships.flatMap((m) => m.org.projects);
  const recentScans = await db.scan.findMany({
    where: { projectId: { in: allProjects.map((p) => p.id) } },
    include: {
      findings: { select: { vendorId: true, vendorName: true, confidence: true, category: true } },
      project: { select: { name: true, id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const totalVendors = new Set(
    recentScans.flatMap((s) => s.findings.map((f) => f.vendorId))
  ).size;

  const totalSpend = memberships
    .flatMap((m) => m.org.projects)
    .flatMap((p) => p.vendorPlans)
    .reduce((sum, p) => sum + (p.monthlySpendUsd ?? p.monthlyCommitUsd ?? 0), 0);

  const hasProjects = allProjects.length > 0;

  return (
    <div className="page-body">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 className="heading-lg">Overview</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {hasProjects
              ? `${allProjects.length} project${allProjects.length !== 1 ? "s" : ""} across ${memberships.length} org${memberships.length !== 1 ? "s" : ""}`
              : "Get started by creating your first project"}
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          + New project
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi-label">Projects</div>
          <div className="kpi">{allProjects.length}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Across {memberships.length} org{memberships.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Vendors detected</div>
          <div className="kpi">{totalVendors}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Unique vendors in latest scans</div>
        </div>
        <div className="card">
          <div className="kpi-label">Monthly spend (entered)</div>
          <div className="kpi">{totalSpend > 0 ? `$${totalSpend.toLocaleString()}` : "—"}</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {totalSpend > 0 ? "From vendor plan entries" : "Add plans to see spend"}
          </div>
        </div>
      </div>

      {!hasProjects ? (
        /* Empty state */
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <div className="heading-md" style={{ marginBottom: 8 }}>No projects yet</div>
            <p className="muted" style={{ marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
              Create a project to start detecting vendors, tracking usage, and estimating costs.
            </p>
            <Link href="/projects/new" className="btn btn-primary">Create your first project →</Link>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {/* Recent projects */}
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div className="heading-sm">Recent projects</div>
              <Link href="/projects" className="muted small" style={{ color: "var(--accent)" }}>View all →</Link>
            </div>
            <div className="stack gap-4">
              {allProjects.slice(0, 6).map((project) => {
                const latestScan = project.scans[0];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="card-sm card-hover"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{project.name}</div>
                      {project.repoUrl && (
                        <div className="muted small">{project.repoOwner}/{project.repoName}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="small">
                        {project._count.scans} scan{project._count.scans !== 1 ? "s" : ""}
                      </div>
                      {latestScan && (
                        <div className={`small badge ${
                          latestScan.status === "COMPLETE" ? "badge-high" :
                          latestScan.status === "FAILED" ? "badge-danger" :
                          "badge-medium"
                        }`} style={{ marginTop: 4 }}>
                          {latestScan.status.toLowerCase()}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent scans */}
          <div className="card">
            <div className="heading-sm" style={{ marginBottom: 16 }}>Recent scans</div>
            {recentScans.length === 0 ? (
              <div className="empty-state" style={{ padding: "30px 20px" }}>
                <div className="muted small">No scans yet. Install the VS Code extension or upload a scan file.</div>
              </div>
            ) : (
              <div className="stack gap-4">
                {recentScans.map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/scans/${scan.id}`}
                    className="card-sm card-hover"
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{scan.project.name}</span>
                      <span className={`badge ${
                        scan.status === "COMPLETE" ? "badge-high" :
                        scan.status === "FAILED" ? "badge-danger" : "badge-medium"
                      }`}>{scan.status.toLowerCase()}</span>
                    </div>
                    <div className="muted small">
                      {scan.findings.length} vendor{scan.findings.length !== 1 ? "s" : ""} detected
                      {" · "}
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </div>
                    {scan.findings.length > 0 && (
                      <div className="row gap-4" style={{ flexWrap: "wrap", marginTop: 6 }}>
                        {scan.findings.slice(0, 5).map((f) => (
                          <span key={f.vendorId} className={`badge badge-${f.category}`} style={{ fontSize: 10.5 }}>
                            {f.vendorName}
                          </span>
                        ))}
                        {scan.findings.length > 5 && (
                          <span className="muted small">+{scan.findings.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extension install hint */}
      <div className="card" style={{ marginTop: 20, background: "var(--panel-2)" }}>
        <div className="row gap-12">
          <div style={{ fontSize: 24 }}>▸</div>
          <div style={{ flex: 1 }}>
            <div className="heading-sm" style={{ marginBottom: 4 }}>Install the VS Code extension</div>
            <p className="muted small">
              Scan your local workspace, detect API vendors and redacted key patterns, and push findings to Gauge in one click.
              Set <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>apiSpendScout.dashboardUrl</code> to your Gauge URL and
              your project&apos;s API token in <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4, fontSize: 11.5 }}>apiSpendScout.uploadToken</code>.
            </p>
          </div>
          <Link href="/projects" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
            Get token →
          </Link>
        </div>
      </div>
    </div>
  );
}
