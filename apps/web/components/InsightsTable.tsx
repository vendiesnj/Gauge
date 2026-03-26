import { buildCostInsights } from "@api-spend/shared";
import { demoPlans, demoRuntimeEvents } from "@/lib/demoData";

export function InsightsTable() {
  const insights = buildCostInsights(demoPlans, demoRuntimeEvents);

  return (
    <div className="card">
      <div className="section-title">Cost insights</div>
      <table className="table">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Monthly spend</th>
            <th>Unused spend</th>
            <th>Alt stack monthly</th>
            <th>Savings</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {insights.map((item) => (
            <tr key={item.vendorId}>
              <td>{item.vendorName}</td>
              <td>${item.monthlySpendUsd.toFixed(2)}</td>
              <td>${item.estimatedUnusedSpendUsd.toFixed(2)}</td>
              <td>{item.alternativeStackMonthlyUsd !== undefined ? `$${item.alternativeStackMonthlyUsd.toFixed(2)}` : "—"}</td>
              <td>{item.savingsVsAlternativeUsd !== undefined ? `$${item.savingsVsAlternativeUsd.toFixed(2)} (${item.savingsVsAlternativePct}%)` : "—"}</td>
              <td>
                <div className="small muted">{item.notes.join(" ") || "—"}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
