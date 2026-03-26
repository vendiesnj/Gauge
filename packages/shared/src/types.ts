export type DetectionSource =
  | "dependency"
  | "import"
  | "domain"
  | "env_var"
  | "api_key_pattern"
  | "config"
  | "runtime";

export type PricingModel =
  | "per_request"
  | "per_token"
  | "subscription"
  | "seat_based"
  | "hybrid"
  | "unknown";

export type Confidence = "low" | "medium" | "high";

export interface VendorAlternative {
  vendorId: string;
  rationale: string;
  estimatedSavingsPct?: number;
}

export interface VendorDefinition {
  id: string;
  name: string;
  category: "ai" | "payments" | "sms" | "email" | "cloud" | "search" | "monitoring" | "auth" | "cdn" | "other";
  domains: string[];
  envVars: string[];
  importHints: string[];
  dependencyHints: string[];
  apiKeyPatterns: string[];
  pricingModel: PricingModel;
  alternatives: VendorAlternative[];
  planDiscovery: {
    canOAuth: boolean;
    notes: string;
  };
  cheaperAlternativeHeadline?: string;
}

export interface DetectionEvidence {
  source: DetectionSource;
  filePath: string;
  line: number;
  match: string;
  confidence: Confidence;
}

export interface VendorFinding {
  vendorId: string;
  vendorName: string;
  category: VendorDefinition["category"];
  pricingModel: PricingModel;
  planDiscovery: VendorDefinition["planDiscovery"];
  evidences: DetectionEvidence[];
  confidence: Confidence;
  detectedApiKeys: {
    pattern: string;
    filePath: string;
    line: number;
    redactedValue: string;
  }[];
  alternativeSummary: VendorAlternative[];
}

export interface ScanSummary {
  projectName: string;
  scannedAt: string;
  totalFilesScanned: number;
  findings: VendorFinding[];
  unknownDomains: Array<{
    domain: string;
    filePath: string;
    line: number;
  }>;
  notes: string[];
  // Only populated when captureRawKeys: true — never stored in DB
  rawApiKeys?: Array<{
    vendorId: string;
    pattern: string;
    value: string;
  }>;
}

export interface RuntimeUsageEvent {
  vendorId: string;
  timestamp: string;
  environment: string;
  service: string;
  endpoint?: string;
  usageQuantity: number;
  unit: "requests" | "tokens" | "images" | "minutes" | "unknown";
  costUsd?: number;
}

export interface VendorPlanInput {
  vendorId: string;
  planName: string;
  monthlyCommitUsd?: number;
  monthlySpendUsd?: number;
  usageIncluded?: number;
  unit?: string;
}

export interface VendorCostInsight {
  vendorId: string;
  vendorName: string;
  monthlySpendUsd: number;
  estimatedUnusedSpendUsd: number;
  effectiveUnitCostUsd?: number;
  alternativeStackMonthlyUsd?: number;
  savingsVsAlternativeUsd?: number;
  savingsVsAlternativePct?: number;
  notes: string[];
}
