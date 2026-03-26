"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanSummary } from "@api-spend/shared";

export function FileUploadCard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage("");

    try {
      const text = await file.text();
      const scan = JSON.parse(text) as ScanSummary;

      const res = await fetch("/api/scan/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-scan-upload-token": "dev-local-token", // TODO: use project token
        },
        body: JSON.stringify({ ...scan, projectId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setStatus("done");
      setMessage(`Scan uploaded — ${scan.findings?.length ?? 0} vendor${scan.findings?.length !== 1 ? "s" : ""} detected.`);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }

    // Reset file input
    e.target.value = "";
  }

  return (
    <div className="card">
      <div className="heading-sm" style={{ marginBottom: 10 }}>Upload scan file</div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Upload a <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4 }}>.json</code> scan from the VS Code extension.
        Or run the extension and use <strong>Push to Dashboard</strong>.
      </p>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "20px",
          border: "2px dashed var(--border-strong)",
          borderRadius: 12,
          cursor: "pointer",
          background: "var(--bg2)",
          transition: "border-color 0.15s",
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="muted small">
          {status === "uploading" ? "Uploading…" : "Click to upload or drag & drop"}
        </span>
        <input
          type="file"
          accept=".json"
          onChange={handleFile}
          style={{ display: "none" }}
          disabled={status === "uploading"}
        />
      </label>

      {message && (
        <div
          className="small"
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: status === "done" ? "var(--good-bg)" : "var(--danger-bg)",
            color: status === "done" ? "var(--good)" : "var(--danger)",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
