import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const user = session!.user!;

  return (
    <div className="page-body" style={{ maxWidth: 640 }}>
      <h1 className="heading-lg" style={{ marginBottom: 24 }}>Settings</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="heading-sm" style={{ marginBottom: 14 }}>Profile</div>
        <div className="row gap-12">
          {user.image ? (
            <img src={user.image} alt="" width={48} height={48} style={{ borderRadius: "50%" }} />
          ) : (
            <div className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
              {(user.name ?? user.email ?? "U").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{user.name}</div>
            <div className="muted small">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="heading-sm" style={{ marginBottom: 10 }}>VS Code extension setup</div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Configure the extension in VS Code settings:
        </p>
        <pre className="code" style={{ fontSize: 12 }}>{`{
  "apiSpendScout.dashboardUrl": "https://your-gauge-instance.com",
  "apiSpendScout.uploadToken": "gauge_your-project-api-token"
}`}</pre>
        <p className="muted small" style={{ marginTop: 10 }}>
          Get an API token from your project settings page.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="heading-sm" style={{ marginBottom: 10 }}>Runtime ingest</div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Send usage events from your application to track real API consumption:
        </p>
        <pre className="code" style={{ fontSize: 12 }}>{`POST /api/runtime/ingest
x-api-token: gauge_your-project-api-token

{
  "url": "https://api.openai.com/v1/chat/completions",
  "projectId": "your-project-id",
  "quantity": 1500,
  "unit": "tokens",
  "costUsd": 0.045,
  "environment": "production",
  "service": "api"
}`}</pre>
      </div>

      <div className="card" style={{ background: "var(--panel-2)" }}>
        <div className="heading-sm" style={{ marginBottom: 8 }}>Required environment variables</div>
        <p className="muted small" style={{ marginBottom: 10 }}>
          Copy <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4 }}>.env.example</code> to{" "}
          <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4 }}>.env.local</code> and fill in:
        </p>
        <ul className="muted small" style={{ listStyle: "disc", paddingLeft: 20 }}>
          <li><code>DATABASE_URL</code> — PostgreSQL connection string</li>
          <li><code>AUTH_SECRET</code> — Random secret for NextAuth</li>
          <li><code>GITHUB_CLIENT_ID</code> / <code>GITHUB_CLIENT_SECRET</code> — GitHub OAuth app</li>
        </ul>
      </div>
    </div>
  );
}
