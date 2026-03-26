"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface VendorConfig {
  id: string;
  name: string;
  placeholder: string;
  hint: string;
  docsUrl: string;
  prefix?: string; // key prefix hint e.g. "sk_"
}

const VENDORS: VendorConfig[] = [
  {
    id: "stripe",
    name: "Stripe",
    placeholder: "rk_live_…",
    hint: "Create a restricted key with Charges: Read (Balance: Read optional for more detail)",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    prefix: "rk_",
  },
  {
    id: "openai",
    name: "OpenAI",
    placeholder: "sk-…",
    hint: "Needs usage.read scope (org admin key) for spend data",
    docsUrl: "https://platform.openai.com/api-keys",
    prefix: "sk-",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    placeholder: "sk-ant-…",
    hint: "Admin API key with usage:read scope",
    docsUrl: "https://console.anthropic.com/settings/keys",
    prefix: "sk-ant-",
  },
];

type Status = "idle" | "loading" | "done" | "error";

interface VendorRowState {
  key: string;
  status: Status;
  msg: string;
  open: boolean;
}

export function ConnectVendorCard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, VendorRowState>>(
    Object.fromEntries(
      VENDORS.map((v) => [v.id, { key: "", status: "idle", msg: "", open: false }])
    )
  );

  function update(vendorId: string, patch: Partial<VendorRowState>) {
    setRows((prev) => ({ ...prev, [vendorId]: { ...prev[vendorId], ...patch } }));
  }

  async function connect(vendor: VendorConfig) {
    const { key } = rows[vendor.id];
    if (!key.trim()) return;
    update(vendor.id, { status: "loading", msg: "" });
    try {
      const res = await fetch(`/api/projects/${projectId}/billing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendorId: vendor.id, apiKey: key.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.updated > 0) {
        const spend = data.monthlySpendUsd ?? 0;
        update(vendor.id, {
          status: "done",
          msg: spend > 0 ? `Connected — $${spend.toFixed(2)}/mo` : "Connected",
          key: "",
          open: false,
        });
        router.refresh();
      } else {
        update(vendor.id, { status: "error", msg: "Invalid key or key rejected by vendor" });
      }
    } catch (err) {
      update(vendor.id, {
        status: "error",
        msg: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return (
    <div className="card">
      <div className="heading-sm" style={{ marginBottom: 6 }}>Connect vendors</div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Add a read-only API key to pull real spend data directly from each vendor.
      </p>

      <div className="stack gap-8">
        {VENDORS.map((vendor) => {
          const row = rows[vendor.id];
          return (
            <div
              key={vendor.id}
              style={{
                borderRadius: 10,
                border: `1px solid ${row.status === "done" ? "var(--good)" : "var(--border)"}`,
                overflow: "hidden",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--panel-2)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => update(vendor.id, { open: !row.open })}
              >
                <span className="small" style={{ fontWeight: 500 }}>{vendor.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {row.status === "done" && (
                    <span style={{ fontSize: 11, color: "var(--good)" }}>{row.msg}</span>
                  )}
                  {row.status === "error" && (
                    <span style={{ fontSize: 11, color: "var(--danger)" }}>Error</span>
                  )}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="var(--muted)" strokeWidth="2.5"
                    style={{ transform: row.open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded form */}
              {row.open && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
                  <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
                    {vendor.hint}.{" "}
                    <a href={vendor.docsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                      Get key →
                    </a>
                  </p>
                  <div className="row gap-8">
                    <input
                      type="password"
                      className="input"
                      placeholder={vendor.placeholder}
                      value={row.key}
                      onChange={(e) => update(vendor.id, { key: e.target.value, status: "idle", msg: "" })}
                      onKeyDown={(e) => e.key === "Enter" && connect(vendor)}
                      style={{ flex: 1, fontSize: 13 }}
                      autoComplete="off"
                      disabled={row.status === "loading"}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => connect(vendor)}
                      disabled={row.status === "loading" || !row.key.trim()}
                    >
                      {row.status === "loading" ? "Fetching…" : "Connect"}
                    </button>
                  </div>
                  {row.status === "error" && (
                    <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{row.msg}</p>
                  )}
                  <p className="muted" style={{ fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
                    Key is used once to fetch billing data and never stored.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
