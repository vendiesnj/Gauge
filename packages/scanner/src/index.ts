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

// ─── Pre-compile all vendor regexes once at module load ───────────────────────

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type CompiledVendor = {
  vendor: VendorDefinition;
  depRe: RegExp[];
  importRe: RegExp[];
  envRe: RegExp[];
  domainRe: RegExp[];
  keyRe: { pattern: string; re: RegExp }[];
};

const COMPILED: CompiledVendor[] = VENDORS.map((vendor) => ({
  vendor,
  depRe:    vendor.dependencyHints.map((s) => new RegExp(esc(s), "g")),
  importRe: vendor.importHints.map((s) => new RegExp(esc(s), "g")),
  envRe:    vendor.envVars.map((s) => new RegExp(esc(s), "g")),
  domainRe: vendor.domains.map((s) => new RegExp(esc(s), "g")),
  keyRe:    vendor.apiKeyPatterns.map((p) => ({ pattern: p, re: new RegExp(`${esc(p)}[A-Za-z0-9._-]{8,}`, "g") })),
}));

// Pre-built regex to test if a URL domain is a known vendor domain
const KNOWN_DOMAIN_RE = new RegExp(
  VENDORS.flatMap((v) => v.domains).map(esc).join("|")
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redact(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function confidenceRank(v: Confidence): number {
  return v === "high" ? 3 : v === "medium" ? 2 : 1;
}

function maxConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

function pushEvidence(arr: DetectionEvidence[], source: DetectionEvidence["source"], filePath: string, line: number, match: string, confidence: Confidence) {
  arr.push({ source, filePath, line, match, confidence });
}

// Build a line-start offset array once per file, then binary-search for line number
function buildLineIndex(content: string): number[] {
  const idx = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") idx.push(i + 1);
  }
  return idx;
}

function lineAt(lineIndex: number[], charIndex: number): number {
  let lo = 0, hi = lineIndex.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineIndex[mid] <= charIndex) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

// ─── Per-file scan ────────────────────────────────────────────────────────────

function scanFile(
  relPath: string,
  content: string,
  findingMap: Map<string, VendorFinding>,
  unknownDomains: ScanSummary["unknownDomains"],
  rawApiKeys: NonNullable<ScanSummary["rawApiKeys"]> | null
) {
  const lineIdx = buildLineIndex(content);

  for (const { vendor, depRe, importRe, envRe, domainRe, keyRe } of COMPILED) {
    const evidences: DetectionEvidence[] = [];
    const detectedApiKeys: VendorFinding["detectedApiKeys"] = [];

    for (const re of depRe)
      for (const m of content.matchAll(re))
        pushEvidence(evidences, "dependency", relPath, lineAt(lineIdx, m.index ?? 0), m[0], "medium");

    for (const re of importRe)
      for (const m of content.matchAll(re))
        pushEvidence(evidences, "import", relPath, lineAt(lineIdx, m.index ?? 0), m[0], "high");

    for (const re of envRe)
      for (const m of content.matchAll(re))
        pushEvidence(evidences, "env_var", relPath, lineAt(lineIdx, m.index ?? 0), m[0], "medium");

    for (const re of domainRe)
      for (const m of content.matchAll(re))
        pushEvidence(evidences, "domain", relPath, lineAt(lineIdx, m.index ?? 0), m[0], "high");

    for (const { pattern, re } of keyRe) {
      for (const m of content.matchAll(re)) {
        const line = lineAt(lineIdx, m.index ?? 0);
        detectedApiKeys.push({ pattern, filePath: relPath, line, redactedValue: redact(m[0]) });
        pushEvidence(evidences, "api_key_pattern", relPath, line, redact(m[0]), "high");
        if (rawApiKeys) rawApiKeys.push({ vendorId: vendor.id, pattern, value: m[0] });
      }
    }

    if (!evidences.length && !detectedApiKeys.length) continue;

    const confidence = evidences.reduce<Confidence>((acc, item) => maxConfidence(acc, item.confidence), "low");
    const existing = findingMap.get(vendor.id);
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

  for (const m of content.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
    const domain = m[1];
    if (!KNOWN_DOMAIN_RE.test(domain)) {
      unknownDomains.push({ domain, filePath: relPath, line: lineAt(lineIdx, m.index ?? 0) });
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

const BATCH = 20;

export async function scanWorkspace(
  workspacePath: string,
  options: { captureRawKeys?: boolean } = {}
): Promise<ScanSummary> {
  const entries = await fg(TEXT_GLOBS, { cwd: workspacePath, ignore: IGNORE, dot: true, onlyFiles: true });
  const findingMap = new Map<string, VendorFinding>();
  const unknownDomains: ScanSummary["unknownDomains"] = [];
  const rawApiKeys: NonNullable<ScanSummary["rawApiKeys"]> = [];

  // Process files in parallel batches
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(
      entries.slice(i, i + BATCH).map(async (relPath) => {
        const content = await fs.readFile(path.join(workspacePath, relPath), "utf-8").catch(() => "");
        if (content) scanFile(relPath, content, findingMap, unknownDomains, options.captureRawKeys ? rawApiKeys : null);
      })
    );
  }

  // Filter false positives: require at least one high-confidence evidence
  // (import, domain, api_key_pattern) OR 2+ distinct evidence source types.
  const HIGH: DetectionEvidence["source"][] = ["import", "domain", "api_key_pattern"];
  const findings = [...findingMap.values()].filter((f) => {
    const sources = new Set(f.evidences.map((e) => e.source));
    return f.evidences.some((e) => HIGH.includes(e.source)) || sources.size >= 2;
  }).sort((a, b) => b.evidences.length - a.evidences.length);

  return {
    projectName: path.basename(workspacePath),
    scannedAt: new Date().toISOString(),
    totalFilesScanned: entries.length,
    findings,
    unknownDomains: unknownDomains.slice(0, 200),
    rawApiKeys: options.captureRawKeys ? rawApiKeys : undefined,
    notes: [
      "Static analysis can identify likely vendors and redacted key patterns, but cannot prove production usage by itself.",
      "Exact plan detection usually requires provider account access, billing exports, or runtime telemetry."
    ]
  };
}
