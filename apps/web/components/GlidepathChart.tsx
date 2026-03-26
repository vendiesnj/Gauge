"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingTier {
  id: string;
  tierName: string;
  tierOrder: number;
  monthlyBaseUsd: number;
  usageUnit: string;
  usageUnitLabel: string;
  includedUnits: number;
  pricePerUnit: number | null;
  unitBatchSize: number;
  maxUnits: number | null;
  isFreeTier: boolean;
  isMostPopular: boolean;
  percentageRate: number | null;
  perTxFeeUsd: number | null;
  notes: string | null;
}

interface GlidepathProps {
  vendorId: string;
  vendorName: string;
  tiers: PricingTier[];
  currentUsage: number | null;    // current monthly usage quantity
  currentPlan: string | null;     // current tier name
  usageUnitLabel: string;
}

// ─── Cost computation ─────────────────────────────────────────────────────────

function computeCost(tier: PricingTier, usage: number): number | null {
  // Percentage-based (Stripe, etc.)
  if (tier.percentageRate != null) {
    // usage = transaction volume in $
    return tier.percentageRate * usage + (tier.perTxFeeUsd ?? 0) * (usage / 100);
  }

  // Beyond tier max — not available
  if (tier.maxUnits != null && usage > tier.maxUnits) return null;

  const base = tier.monthlyBaseUsd;
  const overage = Math.max(0, usage - tier.includedUnits);
  const overageCost =
    tier.pricePerUnit != null ? (overage / tier.unitBatchSize) * tier.pricePerUnit : 0;

  return base + overageCost;
}

// ─── Compute crossover points (where one tier becomes cheaper) ────────────────

function findCrossover(a: PricingTier, b: PricingTier): number | null {
  // Solve: costA(x) = costB(x)
  // (baseA) + max(0, x - inclA) / batchA * ppuA  =  (baseB) + ...
  // Approximate by stepping
  for (let x = 0; x <= 10_000_000; x += 100) {
    const ca = computeCost(a, x);
    const cb = computeCost(b, x);
    if (ca == null || cb == null) continue;
    if (cb < ca) return x;
  }
  return null;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const TIER_COLORS = [
  "#22d3a8",  // good (free tier)
  "#3b82f6",  // accent
  "#a78bfa",  // purple
  "#f59e0b",  // warn
  "#f87171",  // danger
];

function fmtCurrency(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 100) return `$${v.toFixed(0)}`;
  if (v >= 10) return `$${v.toFixed(0)}`;
  return `$${v.toFixed(2)}`;
}

function fmtUsage(v: number, label: string) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${label}`;
  if (v >= 1_000) return `${(v / 1000).toFixed(0)}k ${label}`;
  return `${v} ${label}`;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

function buildRecommendations(
  tiers: PricingTier[],
  currentUsage: number | null,
  currentPlan: string | null
) {
  if (!tiers.length) return [];
  const recs: { icon: string; text: string; type: "good" | "warn" | "info" }[] = [];

  if (currentUsage == null) {
    recs.push({ icon: "⚡", text: "Connect runtime ingest to see usage-based recommendations.", type: "info" });
    return recs;
  }

  // Find cheapest tier at current usage
  let cheapest: PricingTier | null = null;
  let cheapestCost = Infinity;

  for (const tier of tiers) {
    const cost = computeCost(tier, currentUsage);
    if (cost != null && cost < cheapestCost) {
      cheapestCost = cost;
      cheapest = tier;
    }
  }

  if (cheapest) {
    if (currentPlan && currentPlan !== cheapest.tierName) {
      recs.push({
        icon: "⬇",
        text: `You'd pay ${fmtCurrency(cheapestCost)}/mo on ${cheapest.tierName} vs your current ${currentPlan}. Consider switching.`,
        type: "good",
      });
    } else {
      recs.push({
        icon: "✓",
        text: `${cheapest.isFreeTier ? "Free tier covers" : cheapest.tierName + " is cheapest"} at your current usage (${fmtCurrency(cheapestCost)}/mo).`,
        type: "good",
      });
    }
  }

  // Free tier: warn if close to limit
  const freeTier = tiers.find((t) => t.isFreeTier);
  if (freeTier && freeTier.maxUnits) {
    const pct = currentUsage / freeTier.maxUnits;
    if (pct >= 0.8 && pct < 1) {
      recs.push({
        icon: "⚠",
        text: `Using ${(pct * 100).toFixed(0)}% of free tier. You'll need to upgrade soon.`,
        type: "warn",
      });
    } else if (pct >= 1) {
      recs.push({
        icon: "⚠",
        text: `You've exceeded the free tier limit. You need a paid plan.`,
        type: "warn",
      });
    }
  }

  // Find next upgrade trigger (crossover to next tier being cheaper)
  for (let i = 0; i < tiers.length - 1; i++) {
    const lower = tiers[i];
    const higher = tiers[i + 1];
    const crossover = findCrossover(lower, higher);
    if (crossover != null && crossover > currentUsage) {
      recs.push({
        icon: "→",
        text: `At ${fmtUsage(crossover, tiers[0].usageUnitLabel)}, upgrading to ${higher.tierName} becomes cheaper.`,
        type: "info",
      });
      break; // show only the next relevant crossover
    }
  }

  return recs;
}

// ─── Main chart component ─────────────────────────────────────────────────────

export function GlidepathChart({
  vendorName,
  tiers,
  currentUsage,
  currentPlan,
  usageUnitLabel,
}: GlidepathProps) {
  if (!tiers.length) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="heading-sm" style={{ marginBottom: 6 }}>{vendorName}</div>
        <p className="muted small">No pricing tier data available yet.</p>
      </div>
    );
  }

  // Build x-axis range: 0 → max(currentUsage * 4, highest tier breakpoint * 2, min sensible)
  const maxIncluded = Math.max(...tiers.map((t) => t.includedUnits));
  const xMax = Math.max(
    (currentUsage ?? 0) * 4,
    maxIncluded * 2,
    tiers[0].usageUnit.includes("mau") ? 20000 :
    tiers[0].usageUnit.includes("token") ? 5 : // 5M tokens
    tiers[0].usageUnit.includes("host") ? 20 :
    tiers[0].usageUnit.includes("email") ? 200000 :
    tiers[0].usageUnit.includes("sms") ? 100000 :
    tiers[0].usageUnit.includes("event") ? 500 :
    tiers[0].usageUnit.includes("gb") ? 100 :
    1000
  );

  const STEPS = 80;
  const data = Array.from({ length: STEPS + 1 }, (_, i) => {
    const usage = (xMax / STEPS) * i;
    const point: Record<string, number | null | string> = { usage };
    for (const tier of tiers) {
      point[tier.tierName] = computeCost(tier, usage);
    }
    return point;
  });

  const recs = buildRecommendations(tiers, currentUsage, currentPlan);

  // Find cheapest at current usage for highlighting
  let cheapestAtCurrent: string | null = null;
  if (currentUsage != null) {
    let minCost = Infinity;
    for (const t of tiers) {
      const c = computeCost(t, currentUsage);
      if (c != null && c < minCost) { minCost = c; cheapestAtCurrent = t.tierName; }
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div className="heading-sm">{vendorName} — cost at scale</div>
          <div className="muted small" style={{ marginTop: 3 }}>Monthly cost by usage volume</div>
        </div>
        {currentUsage != null && (
          <div style={{ textAlign: "right" }}>
            <div className="muted small">Current usage</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {fmtUsage(currentUsage, usageUnitLabel)}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,200,0.1)" />
          <XAxis
            dataKey="usage"
            tickFormatter={(v) => fmtUsage(v, "")}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tickFormatter={fmtCurrency}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel-2)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtUsage(Number(v), usageUnitLabel)}
            formatter={(value, name) => {
              const v = value as number | null;
              const n = name as string;
              return v == null ? ["N/A", n] : [fmtCurrency(v), n];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: value === cheapestAtCurrent ? "var(--good)" : "var(--muted)" }}>
                {value}{value === cheapestAtCurrent ? " ★" : ""}
                {tiers.find((t) => t.tierName === value)?.isMostPopular ? " (popular)" : ""}
              </span>
            )}
          />

          {/* Current usage marker */}
          {currentUsage != null && (
            <ReferenceLine
              x={currentUsage}
              stroke="var(--warn)"
              strokeDasharray="4 2"
              label={{ value: "Now", fill: "var(--warn)", fontSize: 10, position: "top" }}
            />
          )}

          {/* Tier lines */}
          {tiers.map((tier, i) => (
            <Line
              key={tier.tierName}
              dataKey={tier.tierName}
              stroke={TIER_COLORS[i % TIER_COLORS.length]}
              strokeWidth={tier.tierName === cheapestAtCurrent ? 2.5 : 1.5}
              dot={false}
              strokeDasharray={tier.isFreeTier ? "6 3" : undefined}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="stack gap-4" style={{ marginTop: 14 }}>
          {recs.map((r, i) => (
            <div
              key={i}
              className="card-sm row gap-8"
              style={{
                padding: "8px 12px",
                background:
                  r.type === "good" ? "var(--good-bg)" :
                  r.type === "warn" ? "var(--warn-bg)" :
                  "var(--panel-2)",
                borderColor:
                  r.type === "good" ? "rgba(34,211,168,0.2)" :
                  r.type === "warn" ? "rgba(245,158,11,0.2)" :
                  "var(--border)",
              }}
            >
              <span style={{ flexShrink: 0, fontSize: 13 }}>{r.icon}</span>
              <span className="small" style={{
                color:
                  r.type === "good" ? "var(--good)" :
                  r.type === "warn" ? "var(--warn)" :
                  "var(--muted)",
              }}>{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tier table */}
      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table className="table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Base/mo</th>
              <th>Included</th>
              <th>Overage</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => {
              const costNow = currentUsage != null ? computeCost(tier, currentUsage) : null;
              return (
                <tr key={tier.tierName} style={{ background: tier.tierName === cheapestAtCurrent ? "rgba(34,211,168,0.05)" : undefined }}>
                  <td>
                    <div className="row gap-6">
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: TIER_COLORS[i % TIER_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{tier.tierName}</span>
                      {tier.isFreeTier && <span className="badge badge-high" style={{ fontSize: 9, padding: "1px 6px" }}>free</span>}
                      {tier.isMostPopular && <span className="badge badge-accent" style={{ fontSize: 9, padding: "1px 6px" }}>popular</span>}
                    </div>
                  </td>
                  <td>
                    {tier.percentageRate != null
                      ? `${(tier.percentageRate * 100).toFixed(1)}% + $${tier.perTxFeeUsd}`
                      : tier.monthlyBaseUsd === 0 ? <span className="text-good">Free</span> : `$${tier.monthlyBaseUsd}`}
                  </td>
                  <td className="muted">
                    {tier.includedUnits > 0 ? fmtUsage(tier.includedUnits, tier.usageUnitLabel) : "Pay-per-use"}
                    {tier.maxUnits && tier.maxUnits === tier.includedUnits ? " (cap)" : ""}
                  </td>
                  <td className="muted">
                    {tier.pricePerUnit != null
                      ? `$${tier.pricePerUnit}/${tier.unitBatchSize > 1 ? `${fmtUsage(tier.unitBatchSize, "")}` : "unit"}`
                      : "—"}
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {costNow != null && (
                      <span style={{ fontWeight: 700, color: tier.tierName === cheapestAtCurrent ? "var(--good)" : "var(--muted)", marginRight: 8 }}>
                        {fmtCurrency(costNow)}/mo now
                      </span>
                    )}
                    {tier.notes && <span className="muted small">{tier.notes.slice(0, 60)}{tier.notes.length > 60 ? "…" : ""}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
