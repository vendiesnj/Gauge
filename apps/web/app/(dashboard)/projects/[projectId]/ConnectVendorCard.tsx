"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const OAUTH_VENDORS = [
  { id: "stripe", name: "Stripe" },
] as const;

const MANUAL_VENDORS = [
  {
    id: "anthropic",
    name: "Anthropic",
    placeholder: "sk-ant-…",
    hint: "Paste any Anthropic API key to confirm your account is connected. Live usage data requires Anthropic to enable the usage API for your org.",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpLabel: "Get API key →",
  },
  {
    id: "twilio",
    name: "Twilio",
    placeholder: "ACxxx:authtoken",
    hint: "Paste as AccountSID:AuthToken — find both on your Twilio console homepage.",
    helpUrl: "https://console.twilio.com/",
    helpLabel: "Find AccountSID & AuthToken →",
  },
] as const;

type Status = "idle" | "loading" | "done" | "error";

interface ManualRowState {
  key: string;
  status: Status;
  msg: string;
  open: boolean;
}

interface OpenAIRowState {
  openaiProjectId: string;
  adminKey: string;
  status: Status;
  msg: string;
  open: boolean;
}

interface AWSRowState {
  accessKeyId: string;
  secretKey: string;
  status: Status;
  msg: string;
  open: boolean;
}

export function ConnectVendorCard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get("connected");

  const [connected, setConnected] = useState<string[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [envStatus, setEnvStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [envMsg, setEnvMsg] = useState("");
  const [envDragOver, setEnvDragOver] = useState(false);

  const [manualRows, setManualRows] = useState<Record<string, ManualRowState>>(
    Object.fromEntries(
      MANUAL_VENDORS.map((v) => [v.id, { key: "", status: "idle", msg: "", open: false }])
    )
  );

  const [openaiRow, setOpenaiRow] = useState<OpenAIRowState>({
    openaiProjectId: "",
    adminKey: "",
    status: "idle",
    msg: "",
    open: false,
  });

  const [awsRow, setAwsRow] = useState<AWSRowState>({
    accessKeyId: "",
    secretKey: "",
    status: "idle",
    msg: "",
    open: false,
  });

  const fetchConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/connections`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected ?? []);
      }
    } finally {
      setLoadingConnections(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (connectedParam) {
      const vendorName =
        OAUTH_VENDORS.find((v) => v.id === connectedParam)?.name ?? connectedParam;
      setSuccessBanner(`${vendorName} connected successfully!`);
      const t = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [connectedParam]);

  function updateManual(vendorId: string, patch: Partial<ManualRowState>) {
    setManualRows((prev) => ({ ...prev, [vendorId]: { ...prev[vendorId], ...patch } }));
  }

  async function connectManual(vendorId: string) {
    const row = manualRows[vendorId];
    if (!row.key.trim()) return;
    updateManual(vendorId, { status: "loading", msg: "" });
    try {
      const res = await fetch(`/api/projects/${projectId}/billing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendorId, apiKey: row.key.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.updated > 0) {
        const spend = data.monthlySpendUsd ?? 0;
        const billingAccess = data.billingAccess !== false;
        updateManual(vendorId, {
          status: billingAccess ? "done" : "error",
          msg: !billingAccess
            ? `Key valid but no billing access — ${data.verifyError ?? "check key permissions"}`
            : spend > 0 ? `Connected — $${spend.toFixed(2)}/mo` : "Connected ($0 spend this month)",
          key: "",
          open: !billingAccess,
        });
        router.refresh();
      } else {
        updateManual(vendorId, { status: "error", msg: "Invalid key or key rejected by vendor" });
      }
    } catch (err) {
      updateManual(vendorId, {
        status: "error",
        msg: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  async function handleEnvFile(file: File) {
    setEnvStatus("loading");
    setEnvMsg("");
    try {
      const envContent = await file.text();
      const res = await fetch(`/api/projects/${projectId}/billing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.updated > 0) {
        setEnvStatus("done");
        setEnvMsg(`Connected ${data.updated} vendor${data.updated !== 1 ? "s" : ""}: ${data.vendors.join(", ")}`);
        router.refresh();
        fetchConnections();
      } else {
        setEnvStatus("error");
        setEnvMsg("No recognized vendor keys found in this file.");
      }
    } catch (err) {
      setEnvStatus("error");
      setEnvMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function connectOpenAI() {
    if (!openaiRow.openaiProjectId.trim() || !openaiRow.adminKey.trim()) return;
    setOpenaiRow((prev) => ({ ...prev, status: "loading", msg: "" }));
    try {
      const res = await fetch("/api/connect/openai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adminKey: openaiRow.adminKey.trim(),
          openaiProjectId: openaiRow.openaiProjectId.trim(),
          gaugeProjectId: projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const spend = data.monthlySpendUsd ?? 0;
      const billingAccess = data.billingAccess !== false;
      setOpenaiRow((prev) => ({
        ...prev,
        status: billingAccess ? "done" : "error",
        msg: !billingAccess
          ? `Key valid but no billing access — ${data.verifyError ?? "check key permissions"}`
          : spend > 0 ? `Connected — $${spend.toFixed(2)}/mo` : "Connected ($0 spend this month)",
        adminKey: "",
        openaiProjectId: "",
        open: !billingAccess,
      }));
      setConnected((prev) => [...prev.filter((v) => v !== "openai"), "openai"]);
      router.refresh();
    } catch (err) {
      setOpenaiRow((prev) => ({
        ...prev,
        status: "error",
        msg: err instanceof Error ? err.message : "Failed",
      }));
    }
  }

  async function connectAWS() {
    if (!awsRow.accessKeyId.trim() || !awsRow.secretKey.trim()) return;
    setAwsRow((prev) => ({ ...prev, status: "loading", msg: "" }));
    try {
      const res = await fetch("/api/connect/aws", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessKeyId: awsRow.accessKeyId.trim(),
          secretKey: awsRow.secretKey.trim(),
          gaugeProjectId: projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const spend = data.monthlySpendUsd ?? 0;
      const billingAccess = data.billingAccess !== false;
      setAwsRow((prev) => ({
        ...prev,
        status: billingAccess ? "done" : "error",
        msg: !billingAccess
          ? `Key valid but no billing access — ${data.verifyError ?? "attach CostExplorerReadOnlyAccess policy"}`
          : spend > 0 ? `Connected — $${spend.toFixed(2)}/mo` : "Connected ($0 spend this month)",
        accessKeyId: "",
        secretKey: "",
        open: !billingAccess,
      }));
      setConnected((prev) => [...prev.filter((v) => v !== "aws"), "aws"]);
      router.refresh();
    } catch (err) {
      setAwsRow((prev) => ({
        ...prev,
        status: "error",
        msg: err instanceof Error ? err.message : "Failed",
      }));
    }
  }

  return (
    <div className="card">
      <div className="heading-sm" style={{ marginBottom: 6 }}>Connect vendors</div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Connect vendor accounts so Gauge can pull real billing data.
      </p>

      {successBanner && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--good-bg, #dcfce7)",
            color: "var(--good, #16a34a)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {successBanner}
        </div>
      )}

      {/* .env drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setEnvDragOver(true); }}
        onDragLeave={() => setEnvDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEnvDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleEnvFile(file);
        }}
        style={{
          marginBottom: 16,
          padding: "14px 16px",
          borderRadius: 10,
          border: `1.5px dashed ${envDragOver ? "var(--accent)" : envStatus === "done" ? "var(--good)" : "var(--border)"}`,
          background: envDragOver ? "var(--accent-bg, rgba(99,102,241,0.06))" : "var(--panel-2)",
          textAlign: "center",
          transition: "border-color 0.15s, background 0.15s",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".env,.txt";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleEnvFile(file);
          };
          input.click();
        }}
      >
        {envStatus === "loading" ? (
          <p className="muted small">Scanning for vendor keys…</p>
        ) : envStatus === "done" ? (
          <p className="small" style={{ color: "var(--good)", fontWeight: 500 }}>{envMsg}</p>
        ) : envStatus === "error" ? (
          <p className="small" style={{ color: "var(--danger)" }}>{envMsg}</p>
        ) : (
          <>
            <p className="small" style={{ fontWeight: 500, marginBottom: 2 }}>Drop your .env file here</p>
            <p className="muted small">Gauge detects OpenAI, Anthropic, Stripe, Twilio, SendGrid keys automatically</p>
          </>
        )}
      </div>

      {/* OAuth section */}
      <div style={{ marginBottom: 16 }}>
        <p className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          One-click connect
        </p>
        <div className="stack gap-8">
          {OAUTH_VENDORS.map((vendor) => {
            const isConnected = connected.includes(vendor.id);
            return (
              <div
                key={vendor.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${isConnected ? "var(--good)" : "var(--border)"}`,
                  background: "var(--panel-2)",
                }}
              >
                <span className="small" style={{ fontWeight: 500 }}>{vendor.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isConnected && (
                    <span style={{ fontSize: 11, color: "var(--good)", fontWeight: 500 }}>
                      Connected
                    </span>
                  )}
                  {isConnected ? (
                    <a
                      href={`/api/connect/${vendor.id}?projectId=${projectId}`}
                      className="btn btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      Reconnect
                    </a>
                  ) : (
                    <a
                      href={`/api/connect/${vendor.id}?projectId=${projectId}`}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      Connect {vendor.name}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual / API key section */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Connect with API key
          </p>
          <span className="muted" style={{ fontSize: 10 }}>Keys stored encrypted · used for daily refresh</span>
        </div>
        <div className="stack gap-8">
          {/* OpenAI — special two-input flow */}
          {(() => {
            const isConnected = connected.includes("openai") || openaiRow.status === "done";
            return (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${isConnected ? "var(--good)" : "var(--border)"}`,
                  overflow: "hidden",
                }}
              >
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
                  onClick={() => setOpenaiRow((prev) => ({ ...prev, open: !prev.open }))}
                >
                  <span className="small" style={{ fontWeight: 500 }}>OpenAI</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isConnected && (
                      <span style={{ fontSize: 11, color: "var(--good)" }}>Connected</span>
                    )}
                    {openaiRow.status === "error" && (
                      <span style={{ fontSize: 11, color: "var(--danger)" }}>Error</span>
                    )}
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="var(--muted)" strokeWidth="2.5"
                      style={{ transform: openaiRow.open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                {openaiRow.open && (
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
                    <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
                      Gauge needs your OpenAI Project ID and an admin API key to read usage data. The key is stored encrypted and used for daily billing refreshes.{" "}
                      <a href="https://platform.openai.com/settings/organization/projects" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                        Find Project ID →
                      </a>
                      {" · "}
                      <a href="https://platform.openai.com/settings/organization/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                        Create admin key →
                      </a>
                      {" (set Role to "}
                      <strong>All</strong>
                      {" when creating)"}
                    </p>
                    <div className="stack gap-8">
                      <input
                        type="text"
                        className="input"
                        placeholder="OpenAI Project ID (proj_…)"
                        value={openaiRow.openaiProjectId}
                        onChange={(e) => setOpenaiRow((prev) => ({ ...prev, openaiProjectId: e.target.value, status: "idle", msg: "" }))}
                        style={{ fontSize: 13 }}
                        autoComplete="off"
                        disabled={openaiRow.status === "loading"}
                      />
                      <div className="row gap-8">
                        <input
                          type="password"
                          className="input"
                          placeholder="Admin API key (used once, not stored)"
                          value={openaiRow.adminKey}
                          onChange={(e) => setOpenaiRow((prev) => ({ ...prev, adminKey: e.target.value, status: "idle", msg: "" }))}
                          onKeyDown={(e) => e.key === "Enter" && connectOpenAI()}
                          style={{ flex: 1, fontSize: 13 }}
                          autoComplete="off"
                          disabled={openaiRow.status === "loading"}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={connectOpenAI}
                          disabled={openaiRow.status === "loading" || !openaiRow.openaiProjectId.trim() || !openaiRow.adminKey.trim()}
                        >
                          {openaiRow.status === "loading" ? "Connecting…" : "Auto-connect"}
                        </button>
                      </div>
                    </div>
                    {openaiRow.status === "error" && (
                      <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{openaiRow.msg}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* AWS — two-input flow */}
          {(() => {
            const isConnected = connected.includes("aws") || awsRow.status === "done";
            return (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${isConnected ? "var(--good)" : "var(--border)"}`,
                  overflow: "hidden",
                }}
              >
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
                  onClick={() => setAwsRow((prev) => ({ ...prev, open: !prev.open }))}
                >
                  <span className="small" style={{ fontWeight: 500 }}>AWS</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isConnected && (
                      <span style={{ fontSize: 11, color: "var(--good)" }}>Connected</span>
                    )}
                    {awsRow.status === "error" && (
                      <span style={{ fontSize: 11, color: "var(--danger)" }}>Error</span>
                    )}
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="var(--muted)" strokeWidth="2.5"
                      style={{ transform: awsRow.open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                {awsRow.open && (
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
                    <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
                      Create an IAM user with <strong>CostExplorerReadOnlyAccess</strong> policy and paste the access key here.{" "}
                      <a href="https://console.aws.amazon.com/iam/home#/users" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                        IAM console →
                      </a>
                    </p>
                    <div className="stack gap-8">
                      <input
                        type="text"
                        className="input"
                        placeholder="Access Key ID (AKIA…)"
                        value={awsRow.accessKeyId}
                        onChange={(e) => setAwsRow((prev) => ({ ...prev, accessKeyId: e.target.value, status: "idle", msg: "" }))}
                        style={{ fontSize: 13 }}
                        autoComplete="off"
                        disabled={awsRow.status === "loading"}
                      />
                      <div className="row gap-8">
                        <input
                          type="password"
                          className="input"
                          placeholder="Secret Access Key"
                          value={awsRow.secretKey}
                          onChange={(e) => setAwsRow((prev) => ({ ...prev, secretKey: e.target.value, status: "idle", msg: "" }))}
                          onKeyDown={(e) => e.key === "Enter" && connectAWS()}
                          style={{ flex: 1, fontSize: 13 }}
                          autoComplete="off"
                          disabled={awsRow.status === "loading"}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={connectAWS}
                          disabled={awsRow.status === "loading" || !awsRow.accessKeyId.trim() || !awsRow.secretKey.trim()}
                        >
                          {awsRow.status === "loading" ? "Connecting…" : "Connect"}
                        </button>
                      </div>
                    </div>
                    {awsRow.status === "error" && (
                      <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{awsRow.msg}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Other manual vendors */}
          {MANUAL_VENDORS.map((vendor) => {
            const row = manualRows[vendor.id];
            return (
              <div
                key={vendor.id}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${row.status === "done" ? "var(--good)" : "var(--border)"}`,
                  overflow: "hidden",
                }}
              >
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
                  onClick={() => updateManual(vendor.id, { open: !row.open })}
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
                {row.open && (
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
                    <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
                      {vendor.hint}{" "}
                      <a href={vendor.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                        {vendor.helpLabel}
                      </a>
                    </p>
                    <div className="row gap-8">
                      <input
                        type="password"
                        className="input"
                        placeholder={vendor.placeholder}
                        value={row.key}
                        onChange={(e) => updateManual(vendor.id, { key: e.target.value, status: "idle", msg: "" })}
                        onKeyDown={(e) => e.key === "Enter" && connectManual(vendor.id)}
                        style={{ flex: 1, fontSize: 13 }}
                        autoComplete="off"
                        disabled={row.status === "loading"}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => connectManual(vendor.id)}
                        disabled={row.status === "loading" || !row.key.trim()}
                      >
                        {row.status === "loading" ? "Fetching…" : "Connect"}
                      </button>
                    </div>
                    {row.status === "error" && (
                      <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{row.msg}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
