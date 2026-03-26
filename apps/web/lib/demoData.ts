import { VendorPlanInput, RuntimeUsageEvent } from "@api-spend/shared";

export const demoPlans: VendorPlanInput[] = [
  {
    vendorId: "openai",
    planName: "Usage billing",
    monthlySpendUsd: 480,
    usageIncluded: 1200000,
    unit: "tokens"
  },
  {
    vendorId: "sendgrid",
    planName: "Growth",
    monthlySpendUsd: 99,
    usageIncluded: 100000,
    unit: "emails"
  },
  {
    vendorId: "stripe",
    planName: "Standard processing",
    monthlySpendUsd: 220,
    unit: "transactions"
  }
];

export const demoRuntimeEvents: RuntimeUsageEvent[] = [
  { vendorId: "openai", timestamp: new Date().toISOString(), environment: "prod", service: "api", endpoint: "/v1/responses", usageQuantity: 820000, unit: "tokens", costUsd: 390 },
  { vendorId: "sendgrid", timestamp: new Date().toISOString(), environment: "prod", service: "worker", endpoint: "/mail/send", usageQuantity: 42000, unit: "requests", costUsd: 45 },
  { vendorId: "stripe", timestamp: new Date().toISOString(), environment: "prod", service: "api", endpoint: "/v1/payment_intents", usageQuantity: 3400, unit: "requests", costUsd: 220 }
];
