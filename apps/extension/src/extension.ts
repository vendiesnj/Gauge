import * as vscode from "vscode";
import { scanWorkspace } from "@api-spend/scanner";
import { ScanSummary } from "@api-spend/shared";

let lastScan: ScanSummary | null = null;

function renderHtml(scan: ScanSummary): string {
  const findingRows = scan.findings.map((finding) => {
    const evidence = finding.evidences.slice(0, 5).map((ev) => `<li>${ev.filePath}:${ev.line} — ${ev.source} — <code>${escapeHtml(ev.match)}</code></li>`).join("");
    const keys = finding.detectedApiKeys.slice(0, 5).map((k) => `<li>${k.filePath}:${k.line} — ${escapeHtml(k.redactedValue)}</li>`).join("");
    return `
      <section style="background:#12182b;border:1px solid rgba(255,255,255,.12);padding:16px;border-radius:16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <h2 style="margin:0;font-size:18px;">${finding.vendorName}</h2>
          <span style="font-size:12px;border:1px solid rgba(255,255,255,.18);padding:5px 8px;border-radius:999px;">${finding.confidence}</span>
        </div>
        <div style="opacity:.74;font-size:13px;margin-top:6px;">${finding.category} · ${finding.pricingModel}</div>
        <div style="margin-top:12px;font-size:14px;"><strong>Plan discovery:</strong> ${finding.planDiscovery.notes}</div>
        <div style="margin-top:12px;">
          <strong>Evidence</strong>
          <ul>${evidence || "<li>No evidence</li>"}</ul>
        </div>
        <div style="margin-top:12px;">
          <strong>Redacted key patterns</strong>
          <ul>${keys || "<li>None found</li>"}</ul>
        </div>
      </section>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Inter, Arial, sans-serif; background:#0a1020; color:#eef2ff; padding:20px;">
        <h1 style="margin-top:0;">API Spend Scout Pro Report</h1>
        <p style="opacity:.78;">Project: <strong>${escapeHtml(scan.projectName)}</strong> · files scanned: ${scan.totalFilesScanned}</p>
        <p style="opacity:.78;">Scanned at: ${escapeHtml(scan.scannedAt)}</p>
        <div style="margin:16px 0;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#10182d;">
          <strong>Notes</strong>
          <ul>${scan.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>
        ${findingRows || "<p>No known vendors detected.</p>"}
      </body>
    </html>
  `;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand("apiSpendScout.scanWorkspace", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showErrorMessage("Open a workspace folder first.");
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Scanning workspace for API vendors…" },
      async () => {
        lastScan = await scanWorkspace(folder.uri.fsPath);
      }
    );
    vscode.window.showInformationMessage(`Scan complete. Detected ${lastScan.findings.length} vendors.`);
    await vscode.commands.executeCommand("apiSpendScout.openReport");
  }));

  context.subscriptions.push(vscode.commands.registerCommand("apiSpendScout.openReport", async () => {
    if (!lastScan) {
      vscode.window.showWarningMessage("No scan available yet. Run a workspace scan first.");
      return;
    }
    const panel = vscode.window.createWebviewPanel("apiSpendScoutReport", "API Spend Scout Report", vscode.ViewColumn.One, {});
    panel.webview.html = renderHtml(lastScan);
  }));

  context.subscriptions.push(vscode.commands.registerCommand("apiSpendScout.pushToDashboard", async () => {
    if (!lastScan) {
      vscode.window.showWarningMessage("No scan available yet. Run a workspace scan first.");
      return;
    }

    const config = vscode.workspace.getConfiguration();
    const dashboardUrl = config.get<string>("apiSpendScout.dashboardUrl", "http://localhost:3000");
    const token = config.get<string>("apiSpendScout.uploadToken", "dev-local-token");

    const res = await fetch(`${dashboardUrl}/api/scan/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scan-upload-token": token,
      },
      body: JSON.stringify(lastScan),
    });

    if (!res.ok) {
      const body = await res.text();
      vscode.window.showErrorMessage(`Upload failed: ${res.status} ${body}`);
      return;
    }

    vscode.window.showInformationMessage("Scan uploaded to dashboard.");
  }));
}

export function deactivate() {}
