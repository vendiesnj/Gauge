"use client";

import { useState } from "react";
import { VENDOR_MAP } from "@api-spend/shared";
import type { VendorCostInsight } from "@api-spend/shared";

interface SpendTableProps {
  insights: VendorCostInsight[];
  plans: Array<{ vendorId: string; planName: string; unit?: string; usageIncluded?: number }>;
  inputs: Record<string, string>;
  onInputChange: (inputs: Record<string, string>) => void;
}

export interface RateInfo {
  rateUsd: number;
  per: number;
  unitLabel: string;
  display: string;
  dollarMode?: boolean; // calculator takes monthly $ spend directly
}

// Published per-unit rates. Exported so SpendDashboard can use calcCost for live KPI totals.
export const PUBLISHED_RATES: Record<string, RateInfo> = {
  // AI — per 1M tokens (blended mid-tier rates)
  openai:    { rateUsd: 2.50,   per: 1_000_000, unitLabel: "tokens",      display: "$2.50 / 1M tokens"  },
  anthropic: { rateUsd: 3.00,   per: 1_000_000, unitLabel: "tokens",      display: "$3.00 / 1M tokens"  },
  groq:      { rateUsd: 0.27,   per: 1_000_000, unitLabel: "tokens",      display: "$0.27 / 1M tokens"  },
  mistral:   { rateUsd: 0.70,   per: 1_000_000, unitLabel: "tokens",      display: "$0.70 / 1M tokens"  },
  cohere:    { rateUsd: 1.00,   per: 1_000_000, unitLabel: "tokens",      display: "$1.00 / 1M tokens"  },
  // SMS
  twilio:    { rateUsd: 0.0079, per: 1,          unitLabel: "SMS",         display: "$0.0079 / SMS"      },
  vonage:    { rateUsd: 0.0063, per: 1,          unitLabel: "SMS",         display: "$0.0063 / SMS"      },
  // Email
  resend:    { rateUsd: 0.001,  per: 1,          unitLabel: "emails",      display: "$0.001 / email"     },
  mailgun:   { rateUsd: 0.0008, per: 1,          unitLabel: "emails",      display: "$0.0008 / email"    },
  sendgrid:  { rateUsd: 0.0006, per: 1,          unitLabel: "emails",      display: "$0.0006 / email"    },
  // Payments — % of volume processed
  stripe:    { rateUsd: 0.029,  per: 1,          unitLabel: "$ volume",    display: "2.9% + $0.30/tx"    },
  paddle:    { rateUsd: 0.05,   per: 1,          unitLabel: "$ volume",    display: "5% + $0.50/tx"      },
  // Cloud / infra — dollar-mode: calculator takes monthly $ spend
  aws:       { rateUsd: 1,      per: 1,          unitLabel: "mo. spend ($)", display: "Pay-per-use",     dollarMode: true },
  vercel:    { rateUsd: 1,      per: 1,          unitLabel: "mo. spend ($)", display: "$20/mo Pro",       dollarMode: true },
};

export function calcCost(vendorId: string, qty: number): number | null {
  const r = PUBLISHED_RATES[vendorId];
  if (!r || qty <= 0) return null;
  if (r.dollarMode) return qty; // qty is already in $
  if (vendorId === "stripe") return qty * 0.029 + Math.ceil(qty / 100) * 0.30;
  if (vendorId === "paddle") return qty * 0.05 + Math.ceil(qty / 100) * 0.50;
  return (qty / r.per) * r.rateUsd;
}

function rateSavingsPct(currentId: string, altId: string): number | null {
  const cur = PUBLISHED_RATES[currentId];
  const alt = PUBLISHED_RATES[altId];
  if (!cur || !alt || cur.unitLabel !== alt.unitLabel) return null;
  if (cur.dollarMode || alt.dollarMode) return null; // handled via estimatedSavingsPct
  const curPerUnit = cur.rateUsd / cur.per;
  const altPerUnit = alt.rateUsd / alt.per;
  if (curPerUnit <= 0) return null;
  return Math.round(((curPerUnit - altPerUnit) / curPerUnit) * 100);
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

export function SpendTable({ insights, plans, inputs, onInputChange }: SpendTableProps) {
  function setInput(vendorId: string, value: string) {
    onInputChange({ ...inputs, [vendorId]: value });
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
          const hasSpend = insight.monthlySpendUsd > 0;
          const usageQty = plan?.usageIncluded ?? 0;
          const hasUsage = usageQty > 0;
          const rate = PUBLISHED_RATES[insight.vendorId];
          const altRate = alt ? PUBLISHED_RATES[alt.vendorId] : null;

          // Savings % — prefer rate-based (exact), fall back to vendor definition
          const rateBasedSavings = alt ? rateSavingsPct(insight.vendorId, alt.vendorId) : null;
          const altSavingsPct = alt?.estimatedSavingsPct ?? 10;
          const savingsPct = (rateBasedSavings != null && rateBasedSavings > 0)
            ? rateBasedSavings
            : (rateBasedSavings == null ? altSavingsPct : undefined);

          // Usage-based estimates (when no real spend)
          const estimatedCurrentCost = !hasSpend && hasUsage ? calcCost(insight.vendorId, usageQty) : null;
          const estimatedAltCost = !hasSpend && hasUsage && alt ? calcCost(alt.vendorId, usageQty) : null;

          // Summary row display
          const displayAlt = hasSpend
            ? insight.alternativeStackMonthlyUsd
            : (estimatedAltCost ?? undefined);

          // Calculator input
          const inputRaw = inputs[insight.vendorId] ?? "";
          const inputQty = parseFloat(inputRaw.replace(/,/g, "")) || 0;
          const inputCurrentCost = calcCost(insight.vendorId, inputQty);
          const inputAltCostCalc = alt ? calcCost(alt.vendorId, inputQty) : null;
          // Dollar-mode alts use savings % since we don't have their per-unit rate
          const inputAltCost = rate?.dollarMode && inputCurrentCost != null
            ? inputCurrentCost * (1 - altSavingsPct / 100)
            : inputAltCostCalc;

          return (
            <SpendRow
              key={insight.vendorId}
              insight={insight}
              plan={plan}
              alt={alt}
              altVendor={altVendor}
              rate={rate}
              altRate={altRate}
              hasSpend={hasSpend}
              hasUsage={hasUsage}
              usageQty={usageQty}
              savingsPct={savingsPct}
              displayAlt={displayAlt}
              estimatedCurrentCost={estimatedCurrentCost}
              estimatedAltCost={estimatedAltCost}
              inputRaw={inputRaw}
              inputQty={inputQty}
              inputCurrentCost={inputCurrentCost}
              inputAltCost={inputAltCost}
              onInputChange={(v) => setInput(insight.vendorId, v)}
              formatUsage={formatUsage}
              formatRate={formatRate}
            />
          );
        })}
      </tbody>
    </table>
  );
}

// Extracted to avoid massive inline JSX — keeps the map() readable
function SpendRow({
  insight, plan, alt, altVendor, rate, altRate,
  hasSpend, hasUsage, usageQty, savingsPct,
  displayAlt, estimatedCurrentCost, estimatedAltCost,
  inputRaw, inputQty, inputCurrentCost, inputAltCost,
  onInputChange, formatUsage, formatRate,
}: {
  insight: VendorCostInsight;
  plan?: { vendorId: string; planName: string; unit?: string; usageIncluded?: number };
  alt?: { vendorId: string; rationale: string; estimatedSavingsPct?: number };
  altVendor?: { name: string } | null;
  rate?: RateInfo;
  altRate?: RateInfo | null;
  hasSpend: boolean;
  hasUsage: boolean;
  usageQty: number;
  savingsPct?: number;
  displayAlt?: number;
  estimatedCurrentCost: number | null;
  estimatedAltCost: number | null;
  inputRaw: string;
  inputQty: number;
  inputCurrentCost: number | null;
  inputAltCost: number | null;
  onInputChange: (v: string) => void;
  formatUsage: (n: number, u: string) => string;
  formatRate: (s: number, u: number, unit: string) => string;
}) {
  const [open, setOpen] = useState(false);

  const altIsCheaper = rate && altRate && !rate.dollarMode && !altRate.dollarMode
    ? (altRate.rateUsd / altRate.per) < (rate.rateUsd / rate.per)
    : true; // for dollar-mode, trust estimatedSavingsPct

  return (
    <>
      <tr>
        <td style={{ fontWeight: 600 }}>{insight.vendorName}</td>
        <td>
          {inputCurrentCost != null ? (
            <span>
              {formatMoney(inputCurrentCost, true)}
              <span className="muted small"> est.</span>
            </span>
          ) : formatMoney(insight.monthlySpendUsd)}
        </td>
        <td>
          {insight.estimatedUnusedSpendUsd > 0
            ? <span className="text-warn">{formatMoney(insight.estimatedUnusedSpendUsd)}</span>
            : <span className="muted">—</span>}
        </td>
        <td>
          {inputAltCost != null && altVendor ? (
            <span>
              {formatMoney(inputAltCost, true)}
              <span className="muted small"> est. ({altVendor.name})</span>
            </span>
          ) : displayAlt != null && altVendor && savingsPct != null && savingsPct >= 5 ? (
            <span>
              {formatMoney(displayAlt, !hasSpend)}
              {!hasSpend && hasUsage && <span className="muted small"> est.</span>}
              <span className="muted small"> ({altVendor.name})</span>
            </span>
          ) : altVendor && savingsPct != null && savingsPct >= 5 ? (
            <span className="muted small">{altVendor.name}</span>
          ) : "—"}
        </td>
        <td>
          {inputCurrentCost != null && inputAltCost != null && inputCurrentCost > inputAltCost ? (
            <span className="text-good" style={{ fontWeight: 700 }}>
              {Math.round((1 - inputAltCost / inputCurrentCost) * 100)}%
            </span>
          ) : savingsPct != null && savingsPct >= 5 ? (
            <span className="text-good" style={{ fontWeight: 700 }}>{savingsPct}%</span>
          ) : "—"}
        </td>
        <td>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 6px", borderRadius: 6,
              color: "var(--muted)", fontSize: 11,
              display: "flex", alignItems: "center",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </td>
      </tr>

      {open && (
        <tr>
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
                  <Row label="Plan" value={plan?.planName ?? "Pay-as-you-go"} />
                  <Row label="Monthly spend" value={formatMoney(insight.monthlySpendUsd)} />
                  {hasUsage && plan?.unit && (
                    <Row label="Usage this month" value={formatUsage(usageQty, plan.unit)} />
                  )}
                  {hasUsage && hasSpend && plan?.unit && (
                    <Row label="Your effective rate" value={formatRate(insight.monthlySpendUsd, usageQty, plan.unit)} accent />
                  )}
                  {rate && (
                    <Row label="Published rate" value={rate.display} />
                  )}
                  {insight.estimatedUnusedSpendUsd > 0 && (
                    <Row label="Unused capacity" value={`${formatMoney(insight.estimatedUnusedSpendUsd)} wasted`} warn />
                  )}
                  {!hasSpend && !hasUsage && inputQty === 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 10px", borderRadius: 6, background: "var(--bg)", border: "1px dashed var(--border)", marginTop: 4, lineHeight: 1.6 }}>
                      No billing data synced yet. Enter your monthly {rate?.unitLabel ?? "usage"} in the cost calculator to see an estimate.
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
                    <Row label="Alternative" value={altVendor.name} accent />

                    {/* Rate comparison */}
                    {rate && altRate && (
                      <>
                        <Row label={`${insight.vendorName} rate`} value={rate.display} />
                        <Row
                          label={`${altVendor.name} rate`}
                          value={altRate.display + (!altIsCheaper ? " (pricier)" : "")}
                          good={altIsCheaper}
                        />
                      </>
                    )}

                    {/* Real spend comparison */}
                    {hasSpend && insight.alternativeStackMonthlyUsd != null && (
                      <>
                        <Row label={`Your cost with ${altVendor.name}`} value={`${formatMoney(insight.alternativeStackMonthlyUsd)}/mo`} />
                        <Row
                          label="Monthly savings"
                          value={`${formatMoney(insight.savingsVsAlternativeUsd ?? 0)}/mo (${insight.savingsVsAlternativePct?.toFixed(0)}% less)`}
                          good
                        />
                      </>
                    )}

                    {/* Usage-based estimate */}
                    {!hasSpend && hasUsage && estimatedCurrentCost != null && estimatedAltCost != null && (
                      <>
                        <Row label={`Your usage on ${insight.vendorName}`} value={`${formatMoney(estimatedCurrentCost, true)}/mo`} />
                        <Row label={`Same usage on ${altVendor.name}`} value={`${formatMoney(estimatedAltCost, true)}/mo`} good />
                      </>
                    )}

                    <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginTop: 2 }}>
                      {alt.rationale}
                    </p>

                    {/* Cost calculator */}
                    {rate && (
                      <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>
                          Cost calculator
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                            — updates summary above
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={`Monthly ${rate.unitLabel}`}
                          value={inputRaw}
                          onChange={(e) => onInputChange(e.target.value)}
                          style={{
                            width: "100%",
                            fontSize: 12,
                            padding: "5px 8px",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            background: "var(--bg)",
                            color: "var(--text)",
                            outline: "none",
                            boxSizing: "border-box",
                            marginBottom: 8,
                          }}
                        />
                        {inputCurrentCost != null && inputAltCost != null && (
                          <div className="stack gap-4">
                            <Row label={insight.vendorName} value={`${formatMoney(inputCurrentCost, true)}/mo`} />
                            <Row label={altVendor.name} value={`${formatMoney(inputAltCost, true)}/mo`} good />
                            {inputCurrentCost > inputAltCost && (
                              <Row
                                label="You'd save"
                                value={`${formatMoney(inputCurrentCost - inputAltCost, true)}/mo`}
                                good
                                bold
                              />
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
}

// Small helper to keep row JSX DRY
function Row({ label, value, accent, good, warn, bold }: {
  label: string; value: string;
  accent?: boolean; good?: boolean; warn?: boolean; bold?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span className="muted">{label}</span>
      <span style={{
        fontWeight: bold ? 700 : 600,
        color: good ? "var(--good)" : accent ? "var(--accent)" : warn ? "var(--warn)" : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

