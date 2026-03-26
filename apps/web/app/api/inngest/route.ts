import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scanProject } from "@/inngest/functions/scanProject";

export const maxDuration = 300; // 5 minutes — required for long-running scans

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanProject],
});
