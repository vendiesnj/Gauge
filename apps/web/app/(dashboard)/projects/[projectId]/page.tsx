import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { buildCostInsights } from "@api-spend/shared";
import Link from "next/link";
import { ConnectVendorCard } from "./ConnectVendorCard";
import { SpendDashboard } from "./SpendDashboard";
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

  const planDisplayData = connectedPlans.map((p) => ({
    vendorId: p.vendorId,
    planName: p.planName,
    unit: p.unit ?? undefined,
    usageIncluded: p.usageIncluded ?? undefined,
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

  const allNotes = insights.flatMap((i) => i.notes);

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

      <div className="grid-2" style={{ gap: 20, alignItems: "start" }}>
        {/* Left — KPI + spend table (interactive, client) */}
        <div className="stack gap-16">
          <SpendDashboard
            projectId={projectId}
            insights={insights}
            plans={planDisplayData}
            vendorCount={plans.length}
            notes={allNotes}
          />
        </div>

        {/* Right — connect vendors */}
        <div>
          <ConnectVendorCard projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
