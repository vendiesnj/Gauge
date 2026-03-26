"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props { projectId: string }

export function SpendTrendChart({ projectId }: Props) {
  const [data, setData] = useState<{ month: string; total: number }[] | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/spend-history`)
      .then(r => r.json())
      .then(d => {
        const byMonth = d.byMonth ?? {};
        const points = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, total]) => ({
            month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            total: Math.round(total as number),
          }));
        setData(points);
      })
      .catch(() => setData([]));
  }, [projectId]);

  if (data === null) return null;
  if (data.length < 2) return null; // Don't show with less than 2 months of data

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="heading-sm" style={{ marginBottom: 4 }}>Spend over time</div>
      <p className="muted small" style={{ marginBottom: 16 }}>Total monthly API spend across all vendors</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,200,0.08)" />
          <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tickFormatter={v => `$${v}`} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} width={48} />
          <Tooltip
            contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12 }}
            formatter={(v) => [`$${v}`, "Total spend"]}
          />
          <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
