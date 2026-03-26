"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VENDORS } from "@api-spend/shared";

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

  const availableVendors = VENDORS.filter((v) => !existingPlans.includes(v.id));

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
            <select className="select" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Select vendor…</option>
              {availableVendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

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
