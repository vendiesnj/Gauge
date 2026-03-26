"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VENDORS } from "@api-spend/shared";

type Tier = {
  id: string;
  tierName: string;
  monthlyBaseUsd: number;
  usageUnitLabel: string;
  includedUnits: number;
  pricePerUnit: number | null;
  isFreeTier: boolean;
  isMostPopular: boolean;
  notes: string | null;
};

export function AddPlanForm({
  projectId,
  existingPlans,
}: {
  projectId: string;
  existingPlans: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [planName, setPlanName] = useState("");
  const [monthlySpend, setMonthlySpend] = useState("");
  const [usageIncluded, setUsageIncluded] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);

  const availableVendors = VENDORS.filter((v) => !existingPlans.includes(v.id));

  async function handleVendorChange(id: string) {
    setVendorId(id);
    setPlanName("");
    setMonthlySpend("");
    setUsageIncluded("");
    setUnit("");
    setTiers([]);
    if (!id) return;

    setTiersLoading(true);
    const res = await fetch(`/api/vendors/${id}/tiers`);
    const data = await res.json();
    setTiers(data.tiers ?? []);
    setTiersLoading(false);
  }

  function applyTier(tier: Tier) {
    setPlanName(tier.tierName);
    setMonthlySpend(tier.monthlyBaseUsd > 0 ? String(tier.monthlyBaseUsd) : "");
    setUsageIncluded(tier.includedUnits > 0 ? String(tier.includedUnits) : "");
    setUnit(tier.usageUnitLabel);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !planName) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorId,
          planName,
          monthlySpendUsd: monthlySpend ? Number(monthlySpend) : undefined,
          usageIncluded: usageIncluded ? Number(usageIncluded) : undefined,
          unit: unit || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save plan");

      setOpen(false);
      setVendorId("");
      setPlanName("");
      setMonthlySpend("");
      setUsageIncluded("");
      setUnit("");
      setTiers([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: open ? 14 : 0 }}>
        <div className="heading-sm">Vendor plans</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "+ Add plan"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="stack gap-12">
          <div className="form-group">
            <label className="label">Vendor</label>
            <select className="select" value={vendorId} onChange={(e) => handleVendorChange(e.target.value)} required>
              <option value="">Select vendor…</option>
              {availableVendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Tier picker */}
          {vendorId && (
            <div className="form-group">
              <label className="label">
                {tiersLoading ? "Loading tiers…" : tiers.length > 0 ? "Select a known tier to auto-fill" : "No known tiers — enter manually below"}
              </label>
              {tiers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => applyTier(tier)}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${planName === tier.tierName ? "var(--accent)" : "var(--border)"}`,
                        background: planName === tier.tierName ? "rgba(99,102,241,0.1)" : "var(--panel-2)",
                        cursor: "pointer",
                        color: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {tier.tierName}
                          {tier.isFreeTier && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>free</span>}
                          {tier.isMostPopular && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent)" }}>popular</span>}
                        </span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {tier.monthlyBaseUsd > 0 ? `$${tier.monthlyBaseUsd}/mo` : "usage-based"}
                        </span>
                      </div>
                      {tier.notes && (
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{tier.notes}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="label">Plan name</label>
            <input className="input" placeholder="e.g. Pro, Team, Enterprise" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            <div className="form-group">
              <label className="label">Monthly spend ($)</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={monthlySpend} onChange={(e) => setMonthlySpend(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Included usage</label>
              <input className="input" type="number" min="0" placeholder="e.g. 100000" value={usageIncluded} onChange={(e) => setUsageIncluded(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Unit</label>
            <input className="input" placeholder="tokens, requests, emails…" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>

          {error && <div className="small" style={{ color: "var(--danger)" }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving || !vendorId || !planName}>
            {saving ? "Saving…" : "Save plan"}
          </button>
        </form>
      )}
    </div>
  );
}
