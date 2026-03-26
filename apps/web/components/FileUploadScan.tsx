"use client";

import { useState } from "react";

export function FileUploadScan() {
  const [result, setResult] = useState<string>("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    setResult(raw);
  }

  return (
    <div className="card">
      <div className="section-title">Import scan JSON</div>
      <p className="muted small">Use the VS Code extension to generate a scan, then import it here for review.</p>
      <input className="input" type="file" accept=".json" onChange={onChange} />
      {result ? (
        <pre className="code" style={{ marginTop: 12, maxHeight: 320 }}>{result}</pre>
      ) : null}
    </div>
  );
}
