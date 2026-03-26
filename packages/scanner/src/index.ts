import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { ScanSummary, VendorFinding, DetectionEvidence, VENDORS, VendorDefinition, Confidence } from "@api-spend/shared";

const TEXT_GLOBS = [
  "**/*.{ts,tsx,js,jsx,mjs,cjs,py,rb,php,go,java,cs,json,yaml,yml,toml,env,txt,md}",
  "package.json",
  "requirements.txt",
  "poetry.lock",
  "Pipfile",
  ".env*",
];

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.venv/**",
];

function redact(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function confidenceRank(value: Confidence): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function maxConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

function pushEvidence(arr: DetectionEvidence[], source: DetectionEvidence["source"], filePath: string, line: number, match: string, confidence: Confidence) {
  arr.push({ source, filePath, line, match, confidence });
}

function lineNumberFromIndex(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function scanVendorInFile(vendor: VendorDefinition, relPath: string, content: string) {
  const evidences: DetectionEvidence[] = [];
  const detectedApiKeys: VendorFinding["detectedApiKeys"] = [];

  for (const dep of vendor.dependencyHints) {
    const regex = new RegExp(dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    for (const match of content.matchAll(regex)) {
      pushEvidence(evidences, "dependency", relPath, lineNumberFromIndex(content, match.index ?? 0), dep, "medium");
    }
  }

  for (const hint of vendor.importHints) {
    const regex = new RegExp(hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    for (const match of content.matchAll(regex)) {
      pushEvidence(evidences, "import", relPath, lineNumberFromIndex(content, match.index ?? 0), hint, "high");
    }
  }

  for (const envVar of vendor.envVars) {
    const regex = new RegExp(envVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    for (const match of content.matchAll(regex)) {
      pushEvidence(evidences, "env_var", relPath, lineNumberFromIndex(content, match.index ?? 0), envVar, "medium");
    }
  }

  for (const domain of vendor.domains) {
    const regex = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    for (const match of content.matchAll(regex)) {
      pushEvidence(evidences, "domain", relPath, lineNumberFromIndex(content, match.index ?? 0), domain, "high");
    }
  }

  for (const pattern of vendor.apiKeyPatterns) {
    const regex = new RegExp(`${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[A-Za-z0-9._-]{8,}`, "g");
    for (const match of content.matchAll(regex)) {
      const value = match[0];
      detectedApiKeys.push({
        pattern,
        filePath: relPath,
        line: lineNumberFromIndex(content, match.index ?? 0),
        redactedValue: redact(value),
      });
      pushEvidence(evidences, "api_key_pattern", relPath, lineNumberFromIndex(content, match.index ?? 0), redact(value), "high");
    }
  }

  return { evidences, detectedApiKeys };
}

export async function scanWorkspace(workspacePath: string): Promise<ScanSummary> {
  const entries = await fg(TEXT_GLOBS, { cwd: workspacePath, ignore: IGNORE, dot: true, onlyFiles: true });
  const findingMap = new Map<string, VendorFinding>();
  const unknownDomains: ScanSummary["unknownDomains"] = [];

  for (const relPath of entries) {
    const abs = path.join(workspacePath, relPath);
    const content = await fs.readFile(abs, "utf-8").catch(() => "");
    if (!content) continue;

    for (const vendor of VENDORS) {
      const { evidences, detectedApiKeys } = scanVendorInFile(vendor, relPath, content);
      if (!evidences.length && !detectedApiKeys.length) continue;

      const existing = findingMap.get(vendor.id);
      const confidence = evidences.reduce<Confidence>((acc, item) => maxConfidence(acc, item.confidence), "low");

      if (existing) {
        existing.evidences.push(...evidences);
        existing.detectedApiKeys.push(...detectedApiKeys);
        existing.confidence = maxConfidence(existing.confidence, confidence);
      } else {
        findingMap.set(vendor.id, {
          vendorId: vendor.id,
          vendorName: vendor.name,
          category: vendor.category,
          pricingModel: vendor.pricingModel,
          planDiscovery: vendor.planDiscovery,
          evidences,
          confidence,
          detectedApiKeys,
          alternativeSummary: vendor.alternatives,
        });
      }
    }

    for (const match of content.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
      const domain = match[1];
      const known = VENDORS.some((v) => v.domains.some((d) => domain.includes(d)));
      if (!known) {
        unknownDomains.push({
          domain,
          filePath: relPath,
          line: lineNumberFromIndex(content, match.index ?? 0),
        });
      }
    }
  }

  return {
    projectName: path.basename(workspacePath),
    scannedAt: new Date().toISOString(),
    totalFilesScanned: entries.length,
    findings: [...findingMap.values()].sort((a, b) => b.evidences.length - a.evidences.length),
    unknownDomains: unknownDomains.slice(0, 200),
    notes: [
      "Static analysis can identify likely vendors and redacted key patterns, but cannot prove production usage by itself.",
      "Exact plan detection usually requires provider account access, billing exports, or runtime telemetry."
    ]
  };
}
