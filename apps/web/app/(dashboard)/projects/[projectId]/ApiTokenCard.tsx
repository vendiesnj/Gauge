"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Token {
  id: string;
  name: string;
  token: string;
  createdAt: string;
}

export function ApiTokenCard({ projectId, tokens }: { projectId: string; tokens: Token[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/tokens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create token");
      setTokenName("");
      setShowForm(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  function copyToken(token: Token) {
    navigator.clipboard.writeText(token.token);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteToken(tokenId: string) {
    await fetch(`/api/projects/${projectId}/tokens/${tokenId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="heading-sm">API tokens</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New token"}
        </button>
      </div>

      <p className="muted small" style={{ marginBottom: 12 }}>
        Use these tokens with the VS Code extension or runtime ingest SDK.
      </p>

      {showForm && (
        <form onSubmit={createToken} className="row gap-8" style={{ marginBottom: 12 }}>
          <input
            className="input"
            placeholder="Token name (e.g. vscode-local)"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            style={{ flex: 1 }}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? "…" : "Create"}
          </button>
        </form>
      )}

      {tokens.length === 0 ? (
        <div className="muted small">No tokens yet. Create one to connect the VS Code extension.</div>
      ) : (
        <div className="stack gap-4">
          {tokens.map((t) => (
            <div key={t.id} className="card-sm" style={{ padding: "10px 12px" }}>
              <div className="row gap-8" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                  <div className="muted small">{new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="row gap-6">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyToken(t)}
                    title="Copy token"
                  >
                    {copiedId === t.id ? "Copied!" : "Copy"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteToken(t.id)}
                    style={{ color: "var(--danger)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <code style={{ fontSize: 11, background: "var(--bg)", padding: "3px 8px", borderRadius: 6, display: "block", marginTop: 6, wordBreak: "break-all" }}>
                {t.token.slice(0, 8)}••••••••{t.token.slice(-4)}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
