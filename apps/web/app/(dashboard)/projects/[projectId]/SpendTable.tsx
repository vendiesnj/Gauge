"use client";

import { useState } from "react";
import { VENDOR_MAP } from "@api-spend/shared";
import type { VendorCostInsight } from "@api-spend/shared";

interface SpendTableProps {
  insights: VendorCostInsight[];
  plans: Array<{ vendorId: string; planName: string; unit?: string; usageIncluded?: number }>;
}

// Published per-unit pricing rates for key vendors (used when actual spend = $0)
const PUBLISHED_RATES: Record<string, { rateUsd: number; per: number; label: string }> = {
  openai:    { rateUsd: 2.50,   per: 1_000_000, label: "$2.50 / 1M tokens"  },
  anthropic: { rateUsd: 3.00,   per: 1_000_000, label: "$3.00 / 1M tokens"  },
  groq:      { rateUsd: 0.27,   per: 1_000_000, label: "$0.27 / 1M tokens"  },
  mistral:   { rateUsd: 0.70,   per: 1_000_000, label: "$0.70 / 1M tokens"  },
  twilio:    { rateUsd: 0.0079, per: 1,          label: "$0.0079 / SMS"      },
  vonage:    { rateUsd: 0.0063, per: 1,          label: "$0.0063 / SMS"      },
  resend:    { rateUsd: 0.001,  per: 1,          label: "$0.001 / email"     },
  sendgrid:  { rateUsd: 0.0006, per: 1,          label: "$0.0006 / email"    },
  stripe:    { rateUsd: 0.029,  per: 1,          label: "2.9% of volume"     },
};

function estimateCost(vendorId: string, usageQuantity: number): number | null {
  const rate = PUBLISHED_RATES[vendorId];
  if (!rate || usageQuantity <= 0) return null;
  return (usageQuantity / rate.per) * rate.rateUsd;
}

function formatUsage(amount: number, unit: string): string {
  if (unit === "tokens") {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M tokens`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K tokens`;
    return `${amount} tokens`;
  }
  if (unit === "messages") return `${amount.toLocaleString()} messages`;
  if (unit === "$ volume processed") return `$${Math.round(amount).toLocaleString()} volume`;
  return `${amount.toLocaleString()} ${unit}`;
}

function formatRate(spendUsd: number, usage: number, unit: string): string {
  if (unit === "tokens" && usage > 0) {
    const perMillion = (spendUsd / usage) * 1_000_000;
    return `$${perMillion.toFixed(2)} / 1M tokens`;
  }
  if (unit === "messages" && usage > 0) {
    return `$${(spendUsd / usage).toFixed(4)} / message`;
  }
  if (unit === "$ volume processed" && usage > 0) {
    const pct = (spendUsd / usage) * 100;
    return `~${pct.toFixed(2)}% effective fee rate`;
  }
  return `$${(spendUsd / usage).toFixed(4)} / ${unit}`;
}

export function SpendTable({ insights, plans }: SpendTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(vendorId: string) {
    setExpanded((prev) => ({ ...prev, [vendorId]: !prev[vendorId] }));
  }

  return (
    <table className="table" style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Monthly</th>
          <th>Unused</th>
          <th>Alt estimate</th>
          <th>Savings</th>
          <th style={{ width: 32 }} />
        </tr>
      </thead>
      <tbody>
        {insights.map((insight) => {
          const vendor = VENDOR_MAP[insight.vendorId];
          const alt = vendor?.alternatives[0];
          const altVendor = alt ? VENDOR_MAP[alt.vendorId] : null;
          const plan = plans.find((p) => p.vendorId === insight.vendorId);
          const isOpen = !!expanded[insight.vendorId];
          const hasSpend = insight.monthlySpendUsd > 0;

          // Compute usage-based cost estimates for $0-spend vendors
          const usageQty = plan?.usageIncluded ?? 0;
          const estimatedCurrentCost = !hasSpend ? estimateCost(insight.vendorId, usageQty) : null;
          const altSavingsPct = alt?.estimatedSavingsPct ?? (vendor?.category === "ai" ? 60 : 20);
          const estimatedAltCost = estimatedCurrentCost != null
            ? estimatedCurrentCost * (1 - altSavingsPct / 100)
            : null;
          const estimatedSavings = estimatedCurrentCost != null && estimatedAltCost != null
            ? estimatedCurrentCost - estimatedAltCost
            : null;

          // Effective display values: prefer real spend, fall back to estimates
          const displayAlt = insight.alternativeStackMonthlyUsd ?? (estimatedAltCost ?? undefined);
          const displaySavingsPct = insight.savingsVsAlternativePct ?? (
            estimatedCurrentCost != null && estimatedCurrentCost > 0
              ? altSavingsPct
              : undefined
          );

          return (
            <>
              <tr key={insight.vendorId}>
                <td style={{ fontWeight: 600 }}>{insight.vendorName}</td>
                <td>${insight.monthlySpendUsd.toFixed(0)}</td>
                <td>
                  {insight.estimatedUnusedSpendUsd > 0 ? (
                    <span className="text-warn">${insight.estimatedUnusedSpendUsd.toFixed(0)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {displayAlt != null && altVendor ? (
                    <span>
                      ~${displayAlt.toFixed(0)}
                      {!hasSpend && <span className="muted small"> est.</span>}
                      <span className="muted small"> ({altVendor.name})</span>
                    </span>
                  ) : "—"}
                </td>
                <td>
                  {displaySavingsPct != null ? (
                    <span className="text-good" style={{ fontWeight: 700 }}>
                      {displaySavingsPct.toFixed(0)}%
                    </span>
                  ) : "—"}
                </td>
                <td>
                  <button
                    onClick={() => toggle(insight.vendorId)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: "2px 6px", borderRadius: 6,
                      color: "var(--muted)", fontSize: 11, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <svg
                      width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </td>
              </tr>

              {isOpen && (
                <tr key={`${insight.vendorId}-detail`}>
                  <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
                    <div style={{
                      padding: "14px 16px",
                      background: "var(--bg2)",
                      borderTop: "1px solid var(--border)",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                    }}>
                      {/* Left: usage breakdown */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
                          Usage breakdown
                        </div>
                        <div className="stack gap-6">
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span className="muted">Plan</span>
                            <span style={{ fontWeight: 600 }}>{plan?.planName ?? "Pay-as-you-go"}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span className="muted">Monthly spend</span>
                            <span style={{ fontWeight: 600 }}>${insight.monthlySpendUsd.toFixed(2)}</span>
                          </div>
                          {plan?.unit && usageQty > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Usage this month</span>
                              <span style={{ fontWeight: 600 }}>
                                {formatUsage(usageQty, plan.unit)}
                              </span>
                            </div>
                          )}
                          {plan?.unit && usageQty > 0 && hasSpend && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Effective rate</span>
                              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                                {formatRate(insight.monthlySpendUsd, usageQty, plan.unit)}
                              </span>
                            </div>
                          )}
                          {plan?.unit && usageQty > 0 && !hasSpend && PUBLISHED_RATES[insight.vendorId] && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Published rate</span>
                              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                                {PUBLISHED_RATES[insight.vendorId].label}
                              </span>
                            </div>
                          )}
                          {insight.estimatedUnusedSpendUsd > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Unused capacity</span>
                              <span style={{ fontWeight: 600, color: "var(--warn)" }}>${insight.estimatedUnusedSpendUsd.toFixed(2)} wasted</span>
                            </div>
                          )}
                          {!hasSpend && usageQty === 0 && (
                            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                              No usage recorded yet — data will appear after your next billing cycle.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: alternative recommendation */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
                          Recommendation
                        </div>
                        {alt && altVendor ? (
                          <div className="stack gap-6">
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Alternative</span>
                              <span style={{ fontWeight: 600, color: "var(--accent)" }}>{altVendor.name}</span>
                            </div>

                            {/* Case 1: Real spend data */}
                            {hasSpend && insight.alternativeStackMonthlyUsd != null && (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Est. cost with {altVendor.name}</span>
                                  <span style={{ fontWeight: 600 }}>${insight.alternativeStackMonthlyUsd.toFixed(2)}/mo</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Monthly savings</span>
                                  <span style={{ fontWeight: 700, color: "var(--good)" }}>
                                    ${insight.savingsVsAlternativeUsd?.toFixed(2)}/mo ({insight.savingsVsAlternativePct?.toFixed(0)}% less)
                                  </span>
                                </div>
                              </>
                            )}

                            {/* Case 2: Usage data, no spend — show estimated comparison */}
                            {!hasSpend && estimatedCurrentCost != null && estimatedAltCost != null && (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Your usage cost (~{insight.vendorName})</span>
                                  <span style={{ fontWeight: 600 }}>~${estimatedCurrentCost.toFixed(2)}/mo</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Same usage on {altVendor.name}</span>
                                  <span style={{ fontWeight: 600 }}>~${estimatedAltCost.toFixed(2)}/mo</span>
                                </div>
                                {estimatedSavings != null && estimatedSavings > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                    <span className="muted">Potential savings</span>
                                    <span style={{ fontWeight: 700, color: "var(--good)" }}>
                                      ~${estimatedSavings.toFixed(2)}/mo ({altSavingsPct}% less)
                                    </span>
                                  </div>
                                )}
                                <p style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 }}>
                                  Estimates based on published rates — connect billing to see actuals.
                                </p>
                              </>
                            )}

                            <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginTop: 4 }}>
                              {alt.rationale}
                            </p>
                          </div>
                        ) : (
                          <p className="muted" style={{ fontSize: 11 }}>No alternative identified for this vendor.</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}
