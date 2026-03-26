import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "gauge",
  // In production, set INNGEST_EVENT_KEY in your environment
  // For local dev with `npx inngest-cli@latest dev`, this is optional
});
