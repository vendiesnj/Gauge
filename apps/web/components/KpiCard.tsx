export function KpiCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="kpi" style={{ marginTop: 6 }}>{value}</div>
      {subtext ? <div className="muted small" style={{ marginTop: 6 }}>{subtext}</div> : null}
    </div>
  );
}
