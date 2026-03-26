import { RuntimeUsageEvent, VENDOR_MAP } from "@api-spend/shared";

export interface RawHttpEvent {
  url: string;
  method?: string;
  environment?: string;
  service?: string;
  quantity?: number;
  unit?: RuntimeUsageEvent["unit"];
  timestamp?: string;
  costUsd?: number;
}

export function normalizeRuntimeEvent(raw: RawHttpEvent): RuntimeUsageEvent | null {
  const vendor = Object.values(VENDOR_MAP).find((v) => v.domains.some((d) => raw.url.includes(d)));
  if (!vendor) return null;

  const url = new URL(raw.url);
  return {
    vendorId: vendor.id,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    environment: raw.environment ?? "unknown",
    service: raw.service ?? "unknown",
    endpoint: url.pathname,
    usageQuantity: raw.quantity ?? 1,
    unit: raw.unit ?? "requests",
    costUsd: raw.costUsd,
  };
}
