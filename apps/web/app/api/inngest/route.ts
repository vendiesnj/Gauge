import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scanProject } from "@/inngest/functions/scanProject";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanProject],
});
