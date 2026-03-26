"use client";

import { useEffect, useState } from "react";
import { GlidepathChart, type PricingTier } from "@/components/GlidepathChart";

interface VendorPricing {
  vendorId: string;
  vendorName: string;
  tiers: PricingTier[];
  currentUsage: { quantity: number; unit: string } | null;
  currentPlan: { planName: string } | null;
}

export function GlidepathSection({ projectId }: { projectId: string }) {
  const [vendors, setVendors] = useState<VendorPricing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/pricing`)
      .then((r) => r.json())
      .then((d) => {
        const withTiers = (d.vendors ?? []).filter((v: VendorPricing) => v.tiers.length > 0);
        setVendors(withTiers);
        if (withTiers.length > 0) setSelectedVendorId(withTiers[0].vendorId);
      })
      .catch(() => setError("Failed to load pricing data"));
  }, [projectId]);

  if (error) return <p className="muted small">{error}</p>;

  if (vendors === null) {
    return (
      <div className="muted small row gap-8" style={{ padding: "20px 0" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: "spin 0.8s linear infinite" }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Loading pricing data…
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="heading-sm" style={{ marginBottom: 6 }}>Cost at scale</div>
        <p className="muted small">Run a scan to detect vendors — pricing tiers will appear here.</p>
      </div>
    );
  }

  const selected = vendors.find((v) => v.vendorId === selectedVendorId) ?? vendors[0];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header with vendor picker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="heading-sm">Cost at scale</div>
          <p className="muted small" style={{ marginTop: 2 }}>
            How cost grows with usage — and when to switch tiers.
          </p>
        </div>
        <select
          className="select"
          value={selectedVendorId ?? ""}
          onChange={(e) => setSelectedVendorId(e.target.value)}
          style={{ width: "auto", minWidth: 140 }}
        >
          {vendors.map((v) => (
            <option key={v.vendorId} value={v.vendorId}>{v.vendorName}</option>
          ))}
        </select>
      </div>

      {/* Chart for selected vendor */}
      <div style={{ padding: 20, paddingTop: 16 }}>
        <GlidepathChart
          key={selected.vendorId}
          vendorId={selected.vendorId}
          vendorName={selected.vendorName}
          tiers={selected.tiers}
          currentUsage={selected.currentUsage?.quantity ?? null}
          currentPlan={selected.currentPlan?.planName ?? null}
          usageUnitLabel={selected.tiers[0]?.usageUnitLabel ?? "units"}
        />
      </div>
    </div>
  );
}
