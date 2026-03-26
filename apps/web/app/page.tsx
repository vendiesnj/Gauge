import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const features = [
    {
      icon: "⬡",
      title: "Detect every vendor",
      body: "Static analysis across imports, env vars, HTTP calls, package manifests, and API key patterns. 35+ vendors out of the box.",
    },
    {
      icon: "⚡",
      title: "Track runtime usage",
      body: "Ingest real usage events from your services. Map requests, tokens, and cost to each vendor per environment.",
    },
    {
      icon: "💡",
      title: "Find wasted spend",
      body: "Compare included plan capacity against observed usage. Surface underused subscriptions automatically.",
    },
    {
      icon: "⇌",
      title: "Recommend alternatives",
      body: "Get vendor-specific recommendations with estimated savings percentages and tradeoff notes.",
    },
    {
      icon: "🔒",
      title: "Secrets stay redacted",
      body: "API key patterns are detected and redacted during scanning. Raw values are never stored.",
    },
    {
      icon: "▸",
      title: "VS Code extension",
      body: "Scan your local workspace in one click and push findings to your dashboard without leaving the editor.",
    },
  ];

  return (
    <>
      <nav className="landing-nav">
        <div className="row gap-8" style={{ fontWeight: 800, fontSize: 17 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg, #1a56db 0%, #0ea47a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: "#fff"
          }}>G</div>
          <span className="gradient-text">Gauge</span>
        </div>
        <div className="row gap-12">
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/login" className="btn btn-primary btn-sm">Get started free</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="container" style={{ paddingTop: 80 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: "80px 20px 60px" }}>
            <div className="badge badge-accent" style={{ marginBottom: 20, fontSize: 12 }}>
              Open beta — free to start
            </div>
            <h1 style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.03em" }}>
              <span className="gradient-text">Gauge</span> your API spend.<br />
              Stop wasting money.
            </h1>
            <p className="muted" style={{ fontSize: 19, lineHeight: 1.65, marginBottom: 36 }}>
              Connect your codebase. Gauge detects every third-party API, tracks runtime usage,
              finds underused plans, and recommends cheaper alternatives — all in one dashboard.
            </p>
            <div className="row gap-12" style={{ justifyContent: "center" }}>
              <Link href="/login" className="btn btn-primary btn-lg">Start for free →</Link>
              <a href="#features" className="btn btn-secondary btn-lg">See how it works</a>
            </div>
            <p className="muted small" style={{ marginTop: 16 }}>
              Sign in with GitHub · No credit card required
            </p>
          </div>

          {/* Mini dashboard preview */}
          <div style={{ maxWidth: 860, margin: "0 auto 80px", padding: "0 20px" }}>
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div style={{ background: "var(--panel-2)", borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d3a8" }} />
                <span className="muted small" style={{ marginLeft: 8 }}>Gauge Dashboard — my-saas / production</span>
              </div>
              <div style={{ padding: 20 }}>
                <div className="grid-3" style={{ marginBottom: 16 }}>
                  {[
                    { label: "Monthly API Spend", value: "$799", sub: "3 active vendors" },
                    { label: "Unused Spend", value: "$74", sub: "Detected underuse" },
                    { label: "Alt Stack Estimate", value: "$340", sub: "57% savings possible" },
                  ].map((k) => (
                    <div key={k.label} className="card-sm">
                      <div className="kpi-label">{k.label}</div>
                      <div className="kpi">{k.value}</div>
                      <div className="muted small" style={{ marginTop: 4 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Detected via</th>
                      <th>Monthly</th>
                      <th>Unused</th>
                      <th>Best alternative</th>
                      <th>Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { vendor: "OpenAI", via: "import", cat: "ai", monthly: "$480", unused: "$0", alt: "Groq (Llama 3)", savings: "60%" },
                      { vendor: "SendGrid", via: "env var", cat: "email", monthly: "$99", unused: "$74", alt: "Resend", savings: "30%" },
                      { vendor: "Stripe", via: "dependency", cat: "payments", monthly: "$220", unused: "$0", alt: "—", savings: "5%" },
                    ].map((r) => (
                      <tr key={r.vendor}>
                        <td><span style={{ fontWeight: 600 }}>{r.vendor}</span></td>
                        <td><span className="badge badge-accent">{r.via}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.monthly}</td>
                        <td style={{ color: r.unused !== "$0" ? "var(--warn)" : "var(--muted)" }}>{r.unused}</td>
                        <td className="muted">{r.alt}</td>
                        <td><span style={{ color: "var(--good)", fontWeight: 700 }}>{r.savings}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={{ padding: "80px 0", background: "var(--panel)", borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <h2 style={{ fontSize: 36, fontWeight: 900, textAlign: "center", marginBottom: 12, letterSpacing: "-0.02em" }}>
            Everything you need to control API costs
          </h2>
          <p className="muted" style={{ textAlign: "center", fontSize: 16, marginBottom: 48 }}>
            From static code analysis to runtime telemetry to actionable recommendations.
          </p>
          <div className="grid-3" style={{ gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div className="heading-sm" style={{ marginBottom: 8 }}>{f.title}</div>
                <p className="muted small" style={{ lineHeight: 1.65 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 20px", textAlign: "center", background: "var(--bg)" }}>
        <h2 style={{ fontSize: 36, fontWeight: 900, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Ready to stop overpaying?
        </h2>
        <p className="muted" style={{ fontSize: 16, marginBottom: 32 }}>
          Sign in with GitHub and run your first scan in under 2 minutes.
        </p>
        <Link href="/login" className="btn btn-primary btn-lg">Get started for free →</Link>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700 }} className="gradient-text">Gauge</span>
        <span className="muted small">Gauge your API spend. Stop wasting money.</span>
      </footer>
    </>
  );
}
