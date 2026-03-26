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

  useEffect(() => {
    fetch(`/api/projects/${projectId}/pricing`)
      .then((r) => r.json())
      .then((d) => setVendors(d.vendors ?? []))
      .catch(() => setError("Failed to load pricing data"));
  }, [projectId]);

  if (error) {
    return <p className="muted small">{error}</p>;
  }

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

  // Only show vendors that have pricing tier data
  const withTiers = vendors.filter((v) => v.tiers.length > 0);

  if (withTiers.length === 0) {
    return (
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="heading-sm" style={{ marginBottom: 6 }}>Cost at scale</div>
        <p className="muted small">
          {vendors.length === 0
            ? "Run a scan to detect vendors, then pricing tiers will appear here."
            : "No pricing tier data available for the detected vendors yet. Seed the database to see glidepath charts."}
        </p>
      </div>
    );
  }

  return (
    <div className="stack gap-16">
      <div>
        <h2 className="heading-sm" style={{ marginBottom: 4 }}>Cost at scale</h2>
        <p className="muted small">How each vendor's cost grows with usage — and when to upgrade.</p>
      </div>
      {withTiers.map((v) => (
        <GlidepathChart
          key={v.vendorId}
          vendorId={v.vendorId}
          vendorName={v.vendorName}
          tiers={v.tiers}
          currentUsage={v.currentUsage?.quantity ?? null}
          currentPlan={v.currentPlan?.planName ?? null}
          usageUnitLabel={v.tiers[0]?.usageUnitLabel ?? "units"}
        />
      ))}
    </div>
  );
}
