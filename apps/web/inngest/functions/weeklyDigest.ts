import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { Resend } from "resend";

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    name: "Weekly Spend Digest",
    triggers: [{ cron: "0 9 * * 1" }], // 9am UTC every Monday
  },
  async ({ step, logger }) => {
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (!resend) {
      logger.warn("RESEND_API_KEY not set — skipping digest");
      return { skipped: true };
    }

    // Get all orgs with connected vendor plans
    const orgs = await step.run("fetch-orgs", () =>
      db.organization.findMany({
        where: { projects: { some: { vendorPlans: { some: { source: "billing_api" } } } } },
        include: {
          memberships: { include: { user: { select: { email: true, name: true } } } },
          projects: {
            include: {
              vendorPlans: { where: { source: "billing_api" } },
            },
          },
        },
      })
    );

    // Fetch recent price changes to include in digest
    const recentChanges = await step.run("fetch-price-changes", () =>
      db.priceChangeLog.findMany({
        where: { detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { detectedAt: "desc" },
        take: 10,
      })
    );

    let sent = 0;

    for (const org of orgs) {
      const emails = org.memberships
        .map((m) => m.user.email)
        .filter((e): e is string => !!e);
      if (emails.length === 0) continue;

      // Aggregate spend across all projects
      const allPlans = org.projects.flatMap((p) => p.vendorPlans);
      const totalSpend = allPlans.reduce((s, p) => s + (p.monthlySpendUsd ?? 0), 0);
      if (totalSpend === 0 && recentChanges.length === 0) continue;

      const vendorRows = allPlans
        .filter((p) => (p.monthlySpendUsd ?? 0) > 0)
        .sort((a, b) => (b.monthlySpendUsd ?? 0) - (a.monthlySpendUsd ?? 0))
        .slice(0, 5);

      const fmt = (n: number) => n < 1 && n > 0 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`;

      const vendorRowsHtml = vendorRows.map((p) => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#4a3f2f;border-bottom:1px solid #e8e2d8;">${p.vendorId.charAt(0).toUpperCase() + p.vendorId.slice(1)}</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1a1208;text-align:right;border-bottom:1px solid #e8e2d8;">${fmt(p.monthlySpendUsd ?? 0)}/mo</td>
        </tr>
      `).join("");

      const priceChangesHtml = recentChanges.length > 0 ? `
        <p style="margin:24px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8a7255;">Rate changes detected this week</p>
        ${recentChanges.map((c) => {
          const dir = c.newPrice > c.oldPrice ? "↑" : "↓";
          const color = c.newPrice > c.oldPrice ? "#dc2626" : "#059669";
          return `<p style="margin:4px 0;font-size:13px;color:#4a3f2f;">
            <strong>${c.vendorId}</strong> ${c.tierName}:
            <span style="color:${color};font-weight:700;">${dir} ${c.unit}</span>
            <span style="color:#8a7255;"> (was ${c.oldPrice}, now ${c.newPrice})</span>
          </p>`;
        }).join("")}
      ` : "";

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ece4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece4;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#faf8f4;border:1px solid #d6cfc4;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a56db 0%,#0ea47a 100%);padding:20px 32px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:900;font-size:20px;color:#fff;letter-spacing:-0.03em;">Gauge</span>
            <span style="font-size:12px;color:rgba(255,255,255,0.8);font-weight:600;">Weekly Digest</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a1208;letter-spacing:-0.02em;">Your weekly spend summary</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#8a7255;">${org.name}</p>

            <div style="background:#f0ece4;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8a7255;">Total monthly spend</p>
              <p style="margin:0;font-size:32px;font-weight:900;color:#1a1208;letter-spacing:-0.03em;">${fmt(totalSpend)}<span style="font-size:16px;font-weight:600;color:#8a7255;">/mo</span></p>
            </div>

            ${vendorRowsHtml ? `
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8a7255;">By vendor</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              ${vendorRowsHtml}
            </table>` : ""}

            ${priceChangesHtml}

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr><td style="border-top:1px solid #d6cfc4;font-size:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#4a3f2f;">
              <a href="https://getgauge.dev/dashboard" style="background:linear-gradient(135deg,#1a56db,#0ea47a);color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px;display:inline-block;">
                View full dashboard →
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#ede9e0;border-top:1px solid #d6cfc4;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#8a7255;">
              Weekly digest from <a href="https://getgauge.dev" style="color:#1a56db;text-decoration:none;">Gauge</a>.
              Reply to unsubscribe.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await step.run(`send-digest-${org.id}`, () =>
        resend.emails.send({
          from: "Gauge <digest@getgauge.dev>",
          to: emails,
          subject: `Your Gauge digest — ${fmt(totalSpend)}/mo across ${allPlans.filter(p => (p.monthlySpendUsd ?? 0) > 0).length} vendors`,
          html,
        })
      );
      sent++;
    }

    return { sent, total: orgs.length };
  }
);
