import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scanProject } from "@/inngest/functions/scanProject";
import { weeklyProjectScan, monthlySpendSnapshot } from "@/inngest/functions/scheduledScan";
import { dailyBillingRefresh } from "@/inngest/functions/billingRefresh";
import { dailyPriceMonitor } from "@/inngest/functions/priceMonitor";

export const maxDuration = 300; // 5 minutes — required for long-running scans

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanProject, weeklyProjectScan, monthlySpendSnapshot, dailyBillingRefresh, dailyPriceMonitor],
});
