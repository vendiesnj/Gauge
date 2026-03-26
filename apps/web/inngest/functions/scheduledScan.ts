import { inngest } from "../client";
import { db } from "@/lib/db";

/**
 * Weekly auto-scan: re-scans all projects that have a GitHub repo linked.
 * Runs every Monday at 9am UTC.
 */
export const weeklyProjectScan = inngest.createFunction(
  { id: "weekly-project-scan", name: "Weekly auto-scan all GitHub projects" },
  { cron: "0 9 * * 1" }, // Monday 9am UTC
  async () => {
    const projects = await db.project.findMany({
      where: { repoOwner: { not: null }, repoName: { not: null } },
      select: { id: true, repoOwner: true, repoName: true },
    });

    const triggered: string[] = [];

    for (const project of projects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scan = await (db.scan as any).create({
        data: {
          projectId: project.id,
          triggeredBy: "scheduled",
          status: "PENDING",
        },
      }) as { id: string };

      await inngest.send({
        name: "scan/project.requested",
        data: {
          scanId: scan.id,
          projectId: project.id,
          type: "github",
          userId: "system",
          repoOwner: project.repoOwner ?? "",
          repoName: project.repoName ?? "",
          fetchBilling: "false",
        },
      });

      triggered.push(project.id);
    }

    return { triggered: triggered.length };
  }
);

/**
 * Monthly spend snapshot: records current spend for all projects.
 * Runs on the 1st of each month.
 */
export const monthlySpendSnapshot = inngest.createFunction(
  { id: "monthly-spend-snapshot", name: "Monthly spend snapshot" },
  { cron: "0 6 1 * *" }, // 1st of month, 6am UTC
  async () => {
    const monthYear = new Date().toISOString().slice(0, 7); // "2026-03"
    const plans = await db.vendorPlan.findMany({
      where: { monthlySpendUsd: { not: null } },
    });

    let saved = 0;
    for (const plan of plans) {
      await db.spendSnapshot.upsert({
        where: {
          projectId_vendorId_monthYear: {
            projectId: plan.projectId,
            vendorId: plan.vendorId,
            monthYear,
          },
        },
        update: {
          monthlySpendUsd: plan.monthlySpendUsd ?? 0,
          source: plan.source,
        },
        create: {
          projectId: plan.projectId,
          vendorId: plan.vendorId,
          monthYear,
          monthlySpendUsd: plan.monthlySpendUsd ?? 0,
          source: plan.source,
        },
      });
      saved++;
    }

    return { saved, monthYear };
  }
);
