import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { MONITORED_RATES, fetchCurrentRate } from "@/lib/pricing/monitor";
import { Resend } from "resend";

/**
 * Daily cron — fetches vendor pricing pages via Jina Reader, compares to
 * stored rates in VendorPricingTier, and logs any changes to PriceChangeLog.
 *
 * Runs at 8am UTC so it's after billing refresh (6am UTC).
 */
export const dailyPriceMonitor = inngest.createFunction(
  {
    id: "daily-price-monitor",
    name: "Daily Vendor Price Monitor",
    triggers: [{ cron: "0 8 * * *" }],
    // Generous timeout — Jina fetches can be slow
    timeouts: { finish: "10m" },
  },
  async ({ step, logger }) => {
    const results: Array<{
      vendorId: string;
      tierName: string;
      status: "unchanged" | "changed" | "not_found" | "first_seen";
      oldPrice?: number;
      newPrice?: number;
    }> = [];

    for (const rate of MONITORED_RATES) {
      await step.run(`check-${rate.vendorId}-${rate.tierName}`, async () => {
        const currentPrice = await fetchCurrentRate(rate);

        if (currentPrice === null) {
          logger.warn(`Price not found for ${rate.vendorId}/${rate.tierName} — keeping existing price`);
          // Preserve existing stored price; just note we attempted a check
          await db.vendorPricingTier.updateMany({
            where: { vendorId: rate.vendorId, tierName: rate.tierName },
            data: { lastVerifiedAt: new Date() },
          });
          results.push({ vendorId: rate.vendorId, tierName: rate.tierName, status: "not_found" });
          return;
        }

        // Load stored rate
        const stored = await db.vendorPricingTier.findUnique({
          where: { vendorId_tierName: { vendorId: rate.vendorId, tierName: rate.tierName } },
        });

        if (!stored) {
          // First time seeing this rate — seed it
          await db.vendorPricingTier.create({
            data: {
              vendorId: rate.vendorId,
              tierName: rate.tierName,
              tierOrder: 0,
              usageUnit: rate.unit,
              usageUnitLabel: rate.unit,
              unitBatchSize: rate.unitBatchSize,
              pricePerUnit: currentPrice,
              sourceUrl: rate.pricingUrl,
              lastVerifiedAt: new Date(),
            },
          });
          results.push({ vendorId: rate.vendorId, tierName: rate.tierName, status: "first_seen", newPrice: currentPrice });
          return;
        }

        // Compare — flag if changed by more than 0.5% (avoid float noise)
        const storedPrice = stored.pricePerUnit ?? 0;
        const pctDiff = storedPrice > 0 ? Math.abs(currentPrice - storedPrice) / storedPrice : 1;

        if (pctDiff > 0.005) {
          logger.info(`Price change detected: ${rate.vendorId}/${rate.tierName} ${storedPrice} → ${currentPrice}`);

          await Promise.all([
            db.priceChangeLog.create({
              data: {
                vendorId: rate.vendorId,
                tierName: rate.tierName,
                oldPrice: storedPrice,
                newPrice: currentPrice,
                unit: rate.unit,
                sourceUrl: rate.pricingUrl,
              },
            }),
            db.vendorPricingTier.update({
              where: { vendorId_tierName: { vendorId: rate.vendorId, tierName: rate.tierName } },
              data: { pricePerUnit: currentPrice, lastVerifiedAt: new Date() },
            }),
          ]);

          results.push({ vendorId: rate.vendorId, tierName: rate.tierName, status: "changed", oldPrice: storedPrice, newPrice: currentPrice });

          // Email affected users
          if (process.env.RESEND_API_KEY) {
            const connections = await db.vendorConnection.findMany({
              where: { vendorId: rate.vendorId },
              include: {
                org: {
                  include: {
                    memberships: { include: { user: { select: { email: true } } } },
                  },
                },
              },
            });
            const emails = [
              ...new Set(
                connections
                  .flatMap((c) => c.org.memberships.map((m) => m.user.email))
                  .filter((e): e is string => Boolean(e))
              ),
            ];
            if (emails.length > 0) {
              const pctChange = Math.round(Math.abs(currentPrice - storedPrice) / storedPrice * 100);
              const direction = currentPrice > storedPrice ? "increased" : "decreased";
              const resend = new Resend(process.env.RESEND_API_KEY);
              await resend.emails.send({
                from: "Gauge Alerts <adam@getgauge.dev>",
                to: emails,
                subject: `${rate.vendorId} pricing ${direction} ${pctChange}%`,
                html: `<p>Hi,</p><p>Gauge detected a pricing change for <strong>${rate.vendorId}</strong> (${rate.tierName}):</p><p><strong>${storedPrice}</strong> → <strong>${currentPrice}</strong> per ${rate.unit} (${direction} ${pctChange}%)</p><p>Log in to <a href="https://getgauge.dev">Gauge</a> to review your updated spend estimates.</p><p>— Adam at Gauge</p>`,
              }).catch(() => {});
            }
          }
        } else {
          // Same — just update lastVerifiedAt
          await db.vendorPricingTier.update({
            where: { vendorId_tierName: { vendorId: rate.vendorId, tierName: rate.tierName } },
            data: { lastVerifiedAt: new Date() },
          });
          results.push({ vendorId: rate.vendorId, tierName: rate.tierName, status: "unchanged", newPrice: currentPrice });
        }
      });
    }

    const changed = results.filter(r => r.status === "changed");
    return {
      checked: results.length,
      changed: changed.length,
      notFound: results.filter(r => r.status === "not_found").length,
      firstSeen: results.filter(r => r.status === "first_seen").length,
      changes: changed,
    };
  }
);
