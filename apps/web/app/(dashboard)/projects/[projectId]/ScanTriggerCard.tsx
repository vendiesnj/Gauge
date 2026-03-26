"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  projectId: string;
  repoOwner: string | null;
  repoName: string | null;
}

type Phase = "idle" | "queuing" | "running" | "done" | "error";

interface PollResult {
  status: string;
  vendorsDetected: number;
  filesScanned: number | null;
  notes: string[];
}

export function ScanTriggerCard({ projectId, repoOwner, repoName }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanId, setScanId] = useState<string | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll scan status until terminal state
  useEffect(() => {
    if (!scanId || phase === "done" || phase === "error") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/scans/${scanId}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "COMPLETE") {
          clearInterval(pollRef.current!);
          setResult(data);
          setPhase("done");
          router.refresh();
        } else if (data.status === "FAILED") {
          clearInterval(pollRef.current!);
          setErrorMsg(data.notes?.[0] ?? "Scan failed");
          setPhase("error");
        } else if (data.status === "RUNNING") {
          setPhase("running");
        }
      } catch {
        // Network blip — keep polling
      }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [scanId, projectId, phase, router]);

  async function triggerScan(formData: FormData) {
    setPhase("queuing");
    setErrorMsg("");
    setScanId(null);
    setResult(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan");

      setScanId(data.scanId);
      setPhase("running");
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to start scan");
    }
  }

  function handleGitHub() {
    const fd = new FormData();
    fd.append("type", "github");
    triggerScan(fd);
  }

  function handleZip(file: File) {
    const fd = new FormData();
    fd.append("type", "zip");
    fd.append("file", file);
    triggerScan(fd);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleZip(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleZip(file);
  }

  const busy = phase === "queuing" || phase === "running";

  return (
    <div className="card">
      <div className="heading-sm" style={{ marginBottom: 6 }}>Scan project</div>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Detect APIs, secrets, and pricing models used in your codebase.
      </p>

      <div className="stack gap-10">
        {/* GitHub scan */}
        {repoOwner && repoName ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "var(--panel-2)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <div className="row gap-8">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--muted)">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <span className="small" style={{ fontWeight: 500 }}>
                {repoOwner}/{repoName}
              </span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleGitHub}
              disabled={busy}
            >
              {busy ? (
                <span className="row gap-6"><Spinner /> {phase === "queuing" ? "Starting…" : "Scanning…"}</span>
              ) : (
                "Scan from GitHub"
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--panel-2)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <p className="muted small">
              No GitHub repo linked. Add a repo URL in project settings to enable one-click scanning.
            </p>
          </div>
        )}

        {/* Zip upload */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "20px",
            border: `2px dashed ${dragging ? "var(--accent)" : "var(--border-strong)"}`,
            borderRadius: 12,
            cursor: busy ? "not-allowed" : "pointer",
            background: dragging ? "rgba(59,130,246,0.04)" : "var(--bg2)",
            transition: "border-color 0.15s, background 0.15s",
            opacity: busy ? 0.6 : 1,
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !busy && fileRef.current?.click()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="muted small">
            Upload .zip — drag & drop or click
          </span>
          <span className="muted" style={{ fontSize: 10 }}>
            Extracts and scans all source files
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            onChange={onFileChange}
            style={{ display: "none" }}
            disabled={busy}
          />
        </label>
      </div>

      {/* Status banner */}
      {busy && (
        <div
          className="row gap-8 small"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--panel-2)",
            color: "var(--muted)",
            justifyContent: "space-between",
          }}
        >
          <span className="row gap-8">
            <Spinner />
            {phase === "queuing"
              ? "Queuing scan job…"
              : "Scanning files in background — this takes a few seconds…"}
          </span>
          {scanId && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--danger, #f87171)", flexShrink: 0 }}
              onClick={async () => {
                await fetch(`/api/projects/${projectId}/scans/${scanId}`, { method: "DELETE" });
                clearInterval(pollRef.current!);
                setPhase("error");
                setErrorMsg("Scan cancelled.");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {phase === "done" && result && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--good-bg)",
            color: "var(--good)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span className="small">
            Scan complete — {result.vendorsDetected} vendor{result.vendorsDetected !== 1 ? "s" : ""} detected
            {result.filesScanned ? ` across ${result.filesScanned} files` : ""}.
          </span>
          {scanId && (
            <a href={`/scans/${scanId}`} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
              View results →
            </a>
          )}
        </div>
      )}

      {phase === "error" && (
        <div
          className="small"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.08)",
            color: "var(--danger, #f87171)",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
