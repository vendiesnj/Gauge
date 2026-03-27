"use client";

import { useState } from "react";
import { VENDOR_MAP } from "@api-spend/shared";
import type { VendorCostInsight } from "@api-spend/shared";

interface SpendTableProps {
  insights: VendorCostInsight[];
  plans: Array<{ vendorId: string; planName: string; unit?: string; usageIncluded?: number }>;
}

// Published per-unit rates for both current and alternative vendors
const PUBLISHED_RATES: Record<string, { rateUsd: number; per: number; unitLabel: string; display: string }> = {
  openai:    { rateUsd: 2.50,   per: 1_000_000, unitLabel: "tokens",  display: "$2.50 / 1M tokens"  },
  anthropic: { rateUsd: 3.00,   per: 1_000_000, unitLabel: "tokens",  display: "$3.00 / 1M tokens"  },
  groq:      { rateUsd: 0.27,   per: 1_000_000, unitLabel: "tokens",  display: "$0.27 / 1M tokens"  },
  mistral:   { rateUsd: 0.70,   per: 1_000_000, unitLabel: "tokens",  display: "$0.70 / 1M tokens"  },
  cohere:    { rateUsd: 1.00,   per: 1_000_000, unitLabel: "tokens",  display: "$1.00 / 1M tokens"  },
  twilio:    { rateUsd: 0.0079, per: 1,          unitLabel: "SMS",     display: "$0.0079 / SMS"      },
  vonage:    { rateUsd: 0.0063, per: 1,          unitLabel: "SMS",     display: "$0.0063 / SMS"      },
  resend:    { rateUsd: 0.001,  per: 1,          unitLabel: "emails",  display: "$0.001 / email"     },
  mailgun:   { rateUsd: 0.0008, per: 1,          unitLabel: "emails",  display: "$0.0008 / email"    },
  sendgrid:  { rateUsd: 0.0006, per: 1,          unitLabel: "emails",  display: "$0.0006 / email"    },
  stripe:    { rateUsd: 0.029,  per: 1,          unitLabel: "$ volume", display: "2.9% + $0.30/tx"  },
  paddle:    { rateUsd: 0.05,   per: 1,          unitLabel: "$ volume", display: "5% + $0.50/tx"    },
  aws:       { rateUsd: 0.023,  per: 1,          unitLabel: "GB-mo",   display: "$0.023 / GB-month" },
};

function calcCost(vendorId: string, qty: number): number | null {
  const r = PUBLISHED_RATES[vendorId];
  if (!r || qty <= 0) return null;
  // Stripe/Paddle: rate is a fraction of volume
  if (vendorId === "stripe") return qty * 0.029 + Math.ceil(qty / 100) * 0.30;
  if (vendorId === "paddle") return qty * 0.05 + Math.ceil(qty / 100) * 0.50;
  return (qty / r.per) * r.rateUsd;
}

function formatMoney(usd: number, estimated = false): string {
  const prefix = estimated ? "~" : "";
  if (usd < 1 && usd > 0) return `${prefix}$${usd.toFixed(2)}`;
  return `${prefix}$${Math.round(usd).toLocaleString()}`;
}

function formatUsage(amount: number, unit: string): string {
  if (unit === "tokens") {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M tokens`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K tokens`;
    return `${amount} tokens`;
  }
  if (unit === "messages") return `${amount.toLocaleString()} SMS`;
  if (unit === "$ volume processed") return `$${Math.round(amount).toLocaleString()} volume`;
  return `${amount.toLocaleString()} ${unit}`;
}

function formatRate(spendUsd: number, usage: number, unit: string): string {
  if (unit === "tokens" && usage > 0)
    return `$${((spendUsd / usage) * 1_000_000).toFixed(2)} / 1M tokens`;
  if (unit === "messages" && usage > 0)
    return `$${(spendUsd / usage).toFixed(4)} / SMS`;
  if (unit === "$ volume processed" && usage > 0)
    return `~${((spendUsd / usage) * 100).toFixed(2)}% effective fee`;
  return `$${(spendUsd / usage).toFixed(4)} / ${unit}`;
}

function rateSavingsPct(currentId: string, altId: string): number | null {
  const cur = PUBLISHED_RATES[currentId];
  const alt = PUBLISHED_RATES[altId];
  if (!cur || !alt || cur.unitLabel !== alt.unitLabel) return null;
  // normalize both to cost per 1 unit
  const curPerUnit = cur.rateUsd / cur.per;
  const altPerUnit = alt.rateUsd / alt.per;
  if (curPerUnit <= 0) return null;
  return Math.round(((curPerUnit - altPerUnit) / curPerUnit) * 100);
}

export function SpendTable({ insights, plans }: SpendTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});

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
          const usageQty = plan?.usageIncluded ?? 0;
          const hasUsage = usageQty > 0;

          // Rate-based savings % from published rates (more accurate than estimatedSavingsPct)
          const rateBasedSavings = alt ? rateSavingsPct(insight.vendorId, alt.vendorId) : null;
          const savingsPct = rateBasedSavings ?? alt?.estimatedSavingsPct;

          // Cost estimates from actual usage quantity
          const estimatedCurrentCost = !hasSpend && hasUsage ? calcCost(insight.vendorId, usageQty) : null;
          const estimatedAltCost = !hasSpend && hasUsage && alt ? calcCost(alt.vendorId, usageQty) : null;

          // Summary row display values
          const displayAlt = hasSpend
            ? insight.alternativeStackMonthlyUsd
            : estimatedAltCost ?? undefined;
          const displaySavingsPct = hasSpend
            ? insight.savingsVsAlternativePct
            : (hasUsage && estimatedCurrentCost != null && estimatedCurrentCost > 0 ? savingsPct : savingsPct);

          // Input-driven estimate (bonus calculator)
          const inputRaw = inputs[insight.vendorId] ?? "";
          const inputQty = parseFloat(inputRaw.replace(/,/g, "")) || 0;
          const inputCurrentCost = inputQty > 0 ? calcCost(insight.vendorId, inputQty) : null;
          const inputAltCost = inputQty > 0 && alt ? calcCost(alt.vendorId, inputQty) : null;

          return (
            <>
              <tr key={insight.vendorId}>
                <td style={{ fontWeight: 600 }}>{insight.vendorName}</td>
                <td>{formatMoney(insight.monthlySpendUsd)}</td>
                <td>
                  {insight.estimatedUnusedSpendUsd > 0 ? (
                    <span className="text-warn">{formatMoney(insight.estimatedUnusedSpendUsd)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {displayAlt != null && altVendor && savingsPct != null && savingsPct >= 5 ? (
                    <span>
                      {formatMoney(displayAlt, !hasSpend)}
                      {!hasSpend && hasUsage && <span className="muted small"> est.</span>}
                      <span className="muted small"> ({altVendor.name})</span>
                    </span>
                  ) : altVendor && savingsPct != null && savingsPct >= 5 ? (
                    <span className="muted small">{savingsPct}% cheaper</span>
                  ) : "—"}
                </td>
                <td>
                  {savingsPct != null && savingsPct >= 5 ? (
                    <span className="text-good" style={{ fontWeight: 700 }}>{savingsPct}%</span>
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
                            <span style={{ fontWeight: 600 }}>{formatMoney(insight.monthlySpendUsd)}</span>
                          </div>
                          {hasUsage && plan?.unit && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Usage this month</span>
                              <span style={{ fontWeight: 600 }}>{formatUsage(usageQty, plan.unit)}</span>
                            </div>
                          )}
                          {hasUsage && hasSpend && plan?.unit && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Your effective rate</span>
                              <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                                {formatRate(insight.monthlySpendUsd, usageQty, plan.unit)}
                              </span>
                            </div>
                          )}
                          {PUBLISHED_RATES[insight.vendorId] && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Published rate</span>
                              <span style={{ fontWeight: 600 }}>{PUBLISHED_RATES[insight.vendorId].display}</span>
                            </div>
                          )}
                          {insight.estimatedUnusedSpendUsd > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Unused capacity</span>
                              <span style={{ fontWeight: 600, color: "var(--warn)" }}>{formatMoney(insight.estimatedUnusedSpendUsd)} wasted</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: recommendation + calculator */}
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

                            {/* Rate comparison — always shown when rates exist */}
                            {PUBLISHED_RATES[insight.vendorId] && PUBLISHED_RATES[alt.vendorId] && (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">{insight.vendorName} rate</span>
                                  <span style={{ fontWeight: 600 }}>{PUBLISHED_RATES[insight.vendorId].display}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">{altVendor.name} rate</span>
                                  <span style={{ fontWeight: 600, color: "var(--good)" }}>{PUBLISHED_RATES[alt.vendorId].display}</span>
                                </div>
                              </>
                            )}

                            {/* Real spend comparison */}
                            {hasSpend && insight.alternativeStackMonthlyUsd != null && (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Your cost with {altVendor.name}</span>
                                  <span style={{ fontWeight: 600 }}>{formatMoney(insight.alternativeStackMonthlyUsd)}/mo</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Monthly savings</span>
                                  <span style={{ fontWeight: 700, color: "var(--good)" }}>
                                    {formatMoney(insight.savingsVsAlternativeUsd ?? 0)}/mo ({insight.savingsVsAlternativePct?.toFixed(0)}% less)
                                  </span>
                                </div>
                              </>
                            )}

                            {/* Usage-based estimate (has usage, no spend) */}
                            {!hasSpend && hasUsage && estimatedCurrentCost != null && estimatedAltCost != null && (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Your usage on {insight.vendorName}</span>
                                  <span style={{ fontWeight: 600 }}>{formatMoney(estimatedCurrentCost, true)}/mo</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                  <span className="muted">Same usage on {altVendor.name}</span>
                                  <span style={{ fontWeight: 600, color: "var(--good)" }}>{formatMoney(estimatedAltCost, true)}/mo</span>
                                </div>
                              </>
                            )}

                            <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginTop: 2 }}>
                              {alt.rationale}
                            </p>

                            {/* Usage calculator — shown when rates exist for both vendors */}
                            {PUBLISHED_RATES[insight.vendorId] && PUBLISHED_RATES[alt.vendorId] && (
                              <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
                                  Cost calculator
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder={`Monthly ${PUBLISHED_RATES[insight.vendorId].unitLabel}`}
                                    value={inputRaw}
                                    onChange={(e) => setInputs((prev) => ({ ...prev, [insight.vendorId]: e.target.value }))}
                                    style={{
                                      flex: 1,
                                      fontSize: 12,
                                      padding: "5px 8px",
                                      border: "1px solid var(--border)",
                                      borderRadius: 6,
                                      background: "var(--bg)",
                                      color: "var(--text)",
                                      outline: "none",
                                    }}
                                  />
                                </div>
                                {inputCurrentCost != null && inputAltCost != null && (
                                  <div className="stack gap-4">
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                      <span className="muted">{insight.vendorName}</span>
                                      <span style={{ fontWeight: 600 }}>{formatMoney(inputCurrentCost, true)}/mo</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                      <span className="muted">{altVendor.name}</span>
                                      <span style={{ fontWeight: 600, color: "var(--good)" }}>{formatMoney(inputAltCost, true)}/mo</span>
                                    </div>
                                    {inputCurrentCost > inputAltCost && (
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                        <span className="muted">You'd save</span>
                                        <span style={{ fontWeight: 700, color: "var(--good)" }}>
                                          {formatMoney(inputCurrentCost - inputAltCost, true)}/mo
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
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
