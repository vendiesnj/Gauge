"use client";

import { useState } from "react";
import Link from "next/link";

type Scan = {
  id: string;
  status: string;
  triggeredBy: string;
  scannedAt: string | null;
  createdAt: string;
  totalFilesScanned: number | null;
  findingCount: number;
  unknownDomainCount: number;
  findings: { vendorId: string; vendorName: string; category: string; confidence: string }[];
};

export function ScanHistoryList({ projectId, scans: initial }: { projectId: string; scans: Scan[] }) {
  const [scans, setScans] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(scanId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this scan?")) return;
    setDeleting(scanId);
    await fetch(`/api/projects/${projectId}/scans/${scanId}`, { method: "DELETE" });
    setScans((prev) => prev.filter((s) => s.id !== scanId));
    setDeleting(null);
  }

  if (scans.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="muted small">No scans yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-8">
      {scans.map((scan) => (
        <Link
          key={scan.id}
          href={`/scans/${scan.id}`}
          className="card card-hover"
          style={{ display: "block", position: "relative" }}
        >
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="row gap-8">
              <span style={{ fontWeight: 600 }}>
                {scan.scannedAt
                  ? new Date(scan.scannedAt).toLocaleString()
                  : new Date(scan.createdAt).toLocaleString()}
              </span>
              <span className={`badge ${
                scan.status === "COMPLETE" ? "badge-high" :
                scan.status === "FAILED" ? "badge-danger" : "badge-medium"
              }`}>{scan.status.toLowerCase()}</span>
            </div>
            <div className="row gap-8">
              <span className="muted small">{scan.triggeredBy}</span>
              <button
                onClick={(e) => handleDelete(scan.id, e)}
                disabled={deleting === scan.id}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--danger, #f87171)",
                  fontSize: 12,
                  padding: "2px 6px",
                  borderRadius: 4,
                  opacity: deleting === scan.id ? 0.5 : 1,
                }}
              >
                {deleting === scan.id ? "…" : "Delete"}
              </button>
            </div>
          </div>

          <div className="row gap-16 muted small" style={{ marginBottom: 8 }}>
            <span>{scan.findingCount} vendor{scan.findingCount !== 1 ? "s" : ""}</span>
            {scan.totalFilesScanned && <span>{scan.totalFilesScanned} files</span>}
            {scan.unknownDomainCount > 0 && <span>{scan.unknownDomainCount} unknown domains</span>}
          </div>

          {scan.findings.length > 0 && (
            <div className="row gap-4" style={{ flexWrap: "wrap" }}>
              {scan.findings.map((f) => (
                <span key={f.vendorId} className={`badge badge-${f.category}`} style={{ fontSize: 10.5 }}>
                  {f.vendorName}
                </span>
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
