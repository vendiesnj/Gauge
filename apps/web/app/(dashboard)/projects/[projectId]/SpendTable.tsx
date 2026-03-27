"use client";

import { useState } from "react";
import { VENDOR_MAP } from "@api-spend/shared";
import type { VendorCostInsight } from "@api-spend/shared";

interface SpendTableProps {
  insights: VendorCostInsight[];
  plans: Array<{ vendorId: string; planName: string; unit?: string }>;
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
                  {insight.alternativeStackMonthlyUsd != null && hasSpend ? (
                    <span>
                      ${insight.alternativeStackMonthlyUsd.toFixed(0)}
                      {altVendor && <span className="muted small"> ({altVendor.name})</span>}
                    </span>
                  ) : "—"}
                </td>
                <td>
                  {insight.savingsVsAlternativePct != null && hasSpend ? (
                    <span className="text-good" style={{ fontWeight: 700 }}>
                      {insight.savingsVsAlternativePct.toFixed(0)}%
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
                          {insight.effectiveUnitCostUsd != null && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Effective unit cost</span>
                              <span style={{ fontWeight: 600 }}>${insight.effectiveUnitCostUsd.toFixed(6)} / {plan?.unit ?? "unit"}</span>
                            </div>
                          )}
                          {insight.estimatedUnusedSpendUsd > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span className="muted">Unused capacity</span>
                              <span style={{ fontWeight: 600, color: "var(--warn)" }}>${insight.estimatedUnusedSpendUsd.toFixed(2)} wasted</span>
                            </div>
                          )}
                          {!hasSpend && (
                            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                              No spend recorded yet — data will update after your next billing cycle.
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
