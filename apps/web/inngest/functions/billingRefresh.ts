import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { fetchOpenAI, fetchStripeOAuth, fetchVercelBilling, fetchGoogleBilling } from "@/lib/billing";
import type { BillingResult } from "@/lib/billing";

export const dailyBillingRefresh = inngest.createFunction(
  {
    id: "daily-billing-refresh",
    name: "Daily Billing Refresh",
    triggers: [{ cron: "0 6 * * *" }], // 6am UTC daily
  },
  async ({ step }) => {
    const connections = await step.run("fetch-connections", () =>
      db.vendorConnection.findMany({
        where: { encryptedAdminKey: { not: null } },
        include: { org: { include: { projects: { include: { vendorPlans: true } } } } },
      })
    );

    let refreshed = 0;

    for (const conn of connections) {
      const adminKey = decrypt(conn.encryptedAdminKey!);
      const meta = (conn.metadata ?? {}) as Record<string, unknown>;

      let result: BillingResult | null = null;

      await step.run(`refresh-${conn.orgId}-${conn.vendorId}`, async () => {
        switch (conn.vendorId) {
          case "openai":
            result = await fetchOpenAI(adminKey);
            break;
          case "stripe":
            result = await fetchStripeOAuth(adminKey);
            break;
          case "vercel":
            result = await fetchVercelBilling(adminKey, (meta.teamId as string) ?? null);
            break;
          case "google": {
            const gcpProjects = (meta.gcpProjects as Array<{ projectId: string }>) ?? [];
            result = await fetchGoogleBilling(adminKey, gcpProjects.map((p) => p.projectId));
            break;
          }
          default:
            // For manual vendors (twilio, sendgrid, etc.), use billing lib dispatcher
            const { fetchBillingForKeys } = await import("@/lib/billing");
            const results = await fetchBillingForKeys([{ vendorId: conn.vendorId, value: adminKey }]);
            result = results[0] ?? null;
        }

        if (!result) return;

        // Update VendorPlan for every project in this org that has this vendor
        for (const project of conn.org.projects) {
          await db.vendorPlan.upsert({
            where: { projectId_vendorId: { projectId: project.id, vendorId: conn.vendorId } },
            update: {
              planName: result.planName,
              monthlySpendUsd: result.monthlySpendUsd,
              source: "billing_api",
            },
            create: {
              projectId: project.id,
              vendorId: conn.vendorId,
              planName: result.planName,
              monthlySpendUsd: result.monthlySpendUsd,
              source: "billing_api",
            },
          });
        }

        refreshed++;
      });
    }

    return { refreshed, total: connections.length };
  }
);
