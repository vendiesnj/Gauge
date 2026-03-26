import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const memberships = await db.orgMembership.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          projects: {
            include: {
              vendorPlans: true,
              _count: { select: { scans: true, usageEvents: true } },
              scans: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { findings: { select: { vendorId: true, vendorName: true, category: true, confidence: true } } },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      },
    },
  });

  return (
    <div className="page-body">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 className="heading-lg">Projects</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Each project tracks one codebase — its vendors, usage, and spend.
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">+ New project</Link>
      </div>

      {memberships.map((m) => (
        <div key={m.orgId} style={{ marginBottom: 32 }}>
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <div className="heading-sm">{m.org.name}</div>
            <span className="badge badge-low" style={{ textTransform: "capitalize" }}>{m.role.toLowerCase()}</span>
          </div>

          {m.org.projects.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <p className="muted small" style={{ marginBottom: 16 }}>No projects in this org yet.</p>
              <Link href="/projects/new" className="btn btn-secondary btn-sm">Create project</Link>
            </div>
          ) : (
            <div className="grid-2">
              {m.org.projects.map((project) => {
                const latestScan = project.scans[0];
                const monthlySpend = project.vendorPlans.reduce((s, p) => s + (p.monthlySpendUsd ?? p.monthlyCommitUsd ?? 0), 0);

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="card card-hover"
                    style={{ display: "block" }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                      <div className="heading-sm">{project.name}</div>
                      {latestScan && (
                        <span className={`badge ${
                          latestScan.status === "COMPLETE" ? "badge-high" :
                          latestScan.status === "FAILED" ? "badge-danger" : "badge-medium"
                        }`}>{latestScan.status.toLowerCase()}</span>
                      )}
                    </div>

                    {project.description && (
                      <p className="muted small" style={{ marginBottom: 10 }}>{project.description}</p>
                    )}

                    {project.repoUrl && (
                      <div className="muted small row gap-4" style={{ marginBottom: 10 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        {project.repoOwner}/{project.repoName}
                      </div>
                    )}

                    {/* Latest scan vendors */}
                    {latestScan && latestScan.findings.length > 0 && (
                      <div className="row gap-4" style={{ flexWrap: "wrap", marginBottom: 12 }}>
                        {latestScan.findings.slice(0, 6).map((f) => (
                          <span key={f.vendorId} className={`badge badge-${f.category}`} style={{ fontSize: 10.5 }}>
                            {f.vendorName}
                          </span>
                        ))}
                        {latestScan.findings.length > 6 && (
                          <span className="muted small">+{latestScan.findings.length - 6}</span>
                        )}
                      </div>
                    )}

                    <hr className="divider" style={{ margin: "12px 0" }} />

                    <div className="row gap-16" style={{ fontSize: 12, color: "var(--muted)" }}>
                      <span>{project._count.scans} scan{project._count.scans !== 1 ? "s" : ""}</span>
                      <span>{project._count.usageEvents.toLocaleString()} events</span>
                      {monthlySpend > 0 && (
                        <span style={{ marginLeft: "auto", color: "var(--text)", fontWeight: 600 }}>
                          ${monthlySpend.toLocaleString()}/mo
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {memberships.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <div className="heading-md" style={{ marginBottom: 8 }}>No projects yet</div>
            <p className="muted" style={{ marginBottom: 20 }}>Create your first project to start scanning.</p>
            <Link href="/projects/new" className="btn btn-primary">Create project →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
