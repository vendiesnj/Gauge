import { inngest } from "../client";
import { db } from "@/lib/db";
import { scanWorkspace } from "@api-spend/scanner";
import { fetchBillingForKeys } from "@/lib/billing";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import unzipper from "unzipper";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchGitHubZip(
  owner: string,
  repo: string,
  token: string | null,
  destDir: string
) {
  const url = `https://api.github.com/repos/${owner}/${repo}/zipball`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gauge-app",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub returned ${res.status}: ${msg}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuf);
  await extractZip(zipBuffer, destDir);
}

async function extractZip(zipBuffer: Buffer, destDir: string) {
  const zipPath = join(destDir, "_upload.zip");
  await writeFile(zipPath, zipBuffer);

  await new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stream = require("fs").createReadStream(zipPath);
    stream
      .pipe(unzipper.Extract({ path: destDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

// ─── Inngest function (v4 API) ────────────────────────────────────────────────

export const scanProject = inngest.createFunction(
  {
    id: "scan-project",
    name: "Scan project repository",
    triggers: [{ event: "scan/project.requested" }],
    retries: 2,
    concurrency: { limit: 5 },
  },
  async ({ event }: { event: { data: Record<string, string> } }) => {
    const { scanId, projectId, type, userId, repoOwner, repoName, fetchBilling } = event.data;

    await db.scan.update({
      where: { id: scanId },
      data: { status: "RUNNING" },
    });

    let tempDir: string | null = null;

    try {
      tempDir = await mkdtemp(join(tmpdir(), "gauge-scan-"));

      if (type === "github") {
        if (!repoOwner || !repoName) {
          throw new Error("Missing repoOwner or repoName for GitHub scan");
        }
        const account = await db.account.findFirst({
          where: { userId, provider: "github" },
          select: { access_token: true },
        });
        await fetchGitHubZip(repoOwner, repoName, account?.access_token ?? null, tempDir);

      } else if (type === "zip") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scan = await (db.scan as any).findUnique({
          where: { id: scanId },
          select: { zipPayload: true },
        });
        if (!scan?.zipPayload) throw new Error("No zip payload found for scan");
        const zipBuffer = Buffer.from(scan.zipPayload as string, "base64");
        await extractZip(zipBuffer, tempDir);

      } else {
        throw new Error(`Unknown scan type: ${type}`);
      }

      const summary = await scanWorkspace(tempDir, { captureRawKeys: fetchBilling === "true" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.scan as any).update({
        where: { id: scanId },
        data: {
          status: "COMPLETE",
          scannedAt: new Date(),
          totalFilesScanned: summary.totalFilesScanned,
          notes: summary.notes,
          zipPayload: null,
          findings: {
            create: summary.findings.map((f) => ({
              vendorId: f.vendorId,
              vendorName: f.vendorName,
              category: f.category,
              pricingModel: f.pricingModel,
              confidence: f.confidence,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              evidences: f.evidences as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              detectedApiKeys: f.detectedApiKeys as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              alternatives: f.alternativeSummary as any,
            })),
          },
          unknownDomains: {
            create: summary.unknownDomains.slice(0, 100).map((d) => ({
              domain: d.domain,
              filePath: d.filePath,
              line: d.line,
            })),
          },
        },
      });

      // Fetch real billing data if user consented and keys were found
      const billingResults = (fetchBilling === "true" && summary.rawApiKeys?.length)
        ? await fetchBillingForKeys(summary.rawApiKeys)
        : [];

      // Upsert real billing data (overrides estimates)
      for (const result of billingResults) {
        await db.vendorPlan.upsert({
          where: { projectId_vendorId: { projectId, vendorId: result.vendorId } },
          update: {
            planName: result.planName,
            monthlySpendUsd: result.monthlySpendUsd,
            usageIncluded: result.usageIncluded ?? null,
            unit: result.unit ?? null,
            source: "billing_api",
          },
          create: {
            projectId,
            vendorId: result.vendorId,
            planName: result.planName,
            monthlySpendUsd: result.monthlySpendUsd,
            usageIncluded: result.usageIncluded ?? null,
            unit: result.unit ?? null,
            source: "billing_api",
          },
        });
      }

      const billingVendorIds = new Set(billingResults.map((r) => r.vendorId));

      // Auto-create estimated vendor plans for newly detected vendors
      const existingPlans = await db.vendorPlan.findMany({
        where: { projectId },
        select: { vendorId: true },
      });
      const existingVendorIds = new Set(existingPlans.map((p) => p.vendorId));

      for (const finding of summary.findings) {
        if (existingVendorIds.has(finding.vendorId)) continue;
        if (billingVendorIds.has(finding.vendorId)) continue; // already have real data

        // Find the most popular tier, or fall back to cheapest paid tier
        const tier = await db.vendorPricingTier.findFirst({
          where: { vendorId: finding.vendorId, isFreeTier: false },
          orderBy: [{ isMostPopular: "desc" }, { tierOrder: "asc" }],
        });
        if (!tier) continue;

        await db.vendorPlan.create({
          data: {
            projectId,
            vendorId: finding.vendorId,
            planName: tier.tierName,
            monthlySpendUsd: tier.monthlyBaseUsd > 0 ? tier.monthlyBaseUsd : null,
            usageIncluded: tier.includedUnits > 0 ? tier.includedUnits : null,
            unit: tier.usageUnitLabel,
            source: "estimated",
          },
        });
      }

      return {
        scanId,
        vendorsDetected: summary.findings.length,
        filesScanned: summary.totalFilesScanned,
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.scan as any).update({
        where: { id: scanId },
        data: { status: "FAILED", notes: [message], zipPayload: null },
      });
      throw err; // Re-throw so Inngest retries
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
);
