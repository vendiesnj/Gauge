"use client";

import { useState } from "react";
import { VendorPlanInput, VENDORS } from "@api-spend/shared";

const emptyPlan: VendorPlanInput = {
  vendorId: "openai",
  planName: "",
  monthlySpendUsd: 0,
  usageIncluded: 0,
  unit: ""
};

export function PlanForm() {
  const [plan, setPlan] = useState<VendorPlanInput>(emptyPlan);
  const [saved, setSaved] = useState<VendorPlanInput[]>([]);

  function update<K extends keyof VendorPlanInput>(key: K, value: VendorPlanInput[K]) {
    setPlan((prev) => ({ ...prev, [key]: value }));
  }

  function addPlan() {
    setSaved((prev) => [...prev, plan]);
    setPlan(emptyPlan);
  }

  return (
    <div className="card">
      <div className="section-title">Manual plan input</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <select className="select" value={plan.vendorId} onChange={(e) => update("vendorId", e.target.value)}>
          {VENDORS.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
        <input className="input" placeholder="Plan name" value={plan.planName} onChange={(e) => update("planName", e.target.value)} />
        <input className="input" type="number" placeholder="Monthly spend USD" value={plan.monthlySpendUsd ?? 0} onChange={(e) => update("monthlySpendUsd", Number(e.target.value))} />
        <input className="input" type="number" placeholder="Usage included" value={plan.usageIncluded ?? 0} onChange={(e) => update("usageIncluded", Number(e.target.value))} />
        <input className="input" placeholder="Usage unit" value={plan.unit ?? ""} onChange={(e) => update("unit", e.target.value)} />
        <button className="button" onClick={addPlan}>Save plan</button>
      </div>

      {saved.length ? (
        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Plan</th>
              <th>Monthly spend</th>
              <th>Included usage</th>
            </tr>
          </thead>
          <tbody>
            {saved.map((item, idx) => (
              <tr key={`${item.vendorId}-${idx}`}>
                <td>{VENDORS.find((v) => v.id === item.vendorId)?.name ?? item.vendorId}</td>
                <td>{item.planName}</td>
                <td>${item.monthlySpendUsd ?? 0}</td>
                <td>{item.usageIncluded ?? 0} {item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
