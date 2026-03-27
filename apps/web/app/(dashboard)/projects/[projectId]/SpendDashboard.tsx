"use client";

import { useState, useEffect } from "react";
import { VENDOR_MAP } from "@api-spend/shared";
import type { VendorCostInsight } from "@api-spend/shared";
import { SpendTable, PUBLISHED_RATES, calcCost } from "./SpendTable";
import { RecalculateButton } from "./RecalculateButton";

interface PlanDisplay {
  vendorId: string;
  planName: string;
  unit?: string;
  usageIncluded?: number;
}

interface SpendDashboardProps {
  projectId: string;
  insights: VendorCostInsight[];
  plans: PlanDisplay[];
  vendorCount: number;
  notes: string[];
}

function computeLiveTotals(
  insights: VendorCostInsight[],
  inputs: Record<string, string>,
) {
  let liveSpend = 0;
  let liveAlt = 0;
  let liveUnused = 0;
  let anyInput = false;

  for (const insight of insights) {
    const inputRaw = inputs[insight.vendorId] ?? "";
    const inputQty = parseFloat(inputRaw.replace(/,/g, "")) || 0;
    const rate = PUBLISHED_RATES[insight.vendorId];
    const vendor = VENDOR_MAP[insight.vendorId];
    const alt = vendor?.alternatives[0];
    const altSavingsPct = alt?.estimatedSavingsPct ?? 10;

    let vendorSpend: number;
    let altCost: number;

    if (inputQty > 0 && rate) {
      anyInput = true;
      if (rate.dollarMode) {
        vendorSpend = inputQty;
        altCost = inputQty * (1 - altSavingsPct / 100);
      } else {
        vendorSpend = calcCost(insight.vendorId, inputQty) ?? insight.monthlySpendUsd;
        const altCalc = alt ? calcCost(alt.vendorId, inputQty) : null;
        altCost = altCalc ?? vendorSpend * (1 - altSavingsPct / 100);
      }
    } else {
      vendorSpend = insight.monthlySpendUsd;
      altCost = insight.alternativeStackMonthlyUsd ?? vendorSpend;
    }

    liveSpend += vendorSpend;
    liveAlt += altCost;
    liveUnused += insight.estimatedUnusedSpendUsd;
  }

  return { liveSpend, liveAlt, liveUnused, anyInput };
}

function fmt(n: number) {
  if (n < 1 && n > 0) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

const STORAGE_KEY = (projectId: string) => `gauge-calculator-${projectId}`;

export function SpendDashboard({ projectId, insights, plans, vendorCount, notes }: SpendDashboardProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  // Restore saved inputs on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(projectId));
      if (saved) setInputs(JSON.parse(saved));
    } catch {}
  }, [projectId]);

  // Persist inputs whenever they change
  useEffect(() => {
    try {
      if (Object.keys(inputs).length > 0) {
        localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(inputs));
      } else {
        localStorage.removeItem(STORAGE_KEY(projectId));
      }
    } catch {}
  }, [inputs, projectId]);

  function clearInputs() {
    setInputs({});
    try { localStorage.removeItem(STORAGE_KEY(projectId)); } catch {}
  }

  const { liveSpend, liveAlt, liveUnused, anyInput } = computeLiveTotals(insights, inputs);
  const liveSavings = Math.max(0, liveSpend - liveAlt);
  const hasSpend = liveSpend > 0;

  return (
    <>
      {/* KPI row */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi-label">Monthly spend</div>
          <div className="kpi">
            {vendorCount > 0 ? fmt(liveSpend) : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {vendorCount > 0
              ? `${vendorCount} vendor${vendorCount !== 1 ? "s" : ""} tracked`
              : "Connect vendors below"}
            {anyInput && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }}>· includes calculator estimates</span>}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Unused spend</div>
          <div className="kpi" style={{ color: liveUnused > 0 ? "var(--warn)" : undefined }}>
            {vendorCount > 0 ? fmt(liveUnused) : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {liveUnused > 0 ? "Paid capacity not being used" : "No unused spend detected"}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Potential savings</div>
          <div className="kpi" style={{ color: hasSpend && liveSavings > 0 ? "var(--good)" : undefined }}>
            {vendorCount > 0 && (hasSpend || anyInput) ? `${fmt(liveSavings)}/mo` : "—"}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {vendorCount > 0 && (hasSpend || anyInput)
              ? liveSavings > 0
                ? `vs ${fmt(liveAlt)}/mo on alt stack${anyInput ? " (estimated)" : ""}`
                : "Already on optimal stack"
              : "Connect vendors to see savings"}
          </div>
        </div>
      </div>

      {/* Spend table */}
      {insights.length > 0 ? (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div className="heading-sm">Spend & recommendations</div>
            <div className="row" style={{ gap: 8 }}>
              {anyInput && (
                <button className="btn btn-secondary btn-sm" onClick={clearInputs}>
                  Clear estimates
                </button>
              )}
              <RecalculateButton projectId={projectId} />
            </div>
          </div>
          <SpendTable
            insights={insights}
            plans={plans}
            inputs={inputs}
            onInputChange={setInputs}
          />
          {notes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {notes.map((note, idx) => (
                <div key={idx} className="muted small row gap-6" style={{ marginBottom: 4 }}>
                  <span>ℹ</span> {note}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="heading-sm" style={{ marginBottom: 10 }}>Spend & recommendations</div>
          <p className="muted small">Connect vendors on the right to start tracking spend and see cost-saving recommendations.</p>
        </div>
      )}
    </>
  );
}
