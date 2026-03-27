"use client";

import { useState } from "react";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
      setMsg("You're on the list — check your email.");
    } catch {
      setStatus("error");
      setMsg("Something went wrong. Try again.");
    }
  }

  return (
    <>
      <nav className="landing-nav">
        <div className="row gap-8" style={{ fontWeight: 800, fontSize: 17 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg, #1a56db 0%, #0ea47a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: "#fff",
          }}>G</div>
          <span className="gradient-text">Gauge</span>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="container" style={{ paddingTop: 80 }}>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", padding: "80px 20px 60px" }}>
            <div className="badge badge-accent" style={{ marginBottom: 20, fontSize: 12 }}>
              Private beta — join the waitlist
            </div>
            <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.03em" }}>
              See exactly what you&apos;re spending<br />
              across <span className="gradient-text">every API</span>
            </h1>
            <p className="muted" style={{ fontSize: 18, lineHeight: 1.65, marginBottom: 40 }}>
              Connect your OpenAI, Stripe, Twilio, and AWS accounts.
              Gauge pulls real billing data, spots wasted spend, and shows
              you what switching vendors would actually save.
            </p>

            {status === "done" ? (
              <div style={{
                padding: "16px 24px",
                borderRadius: 12,
                background: "rgba(14,164,122,0.1)",
                border: "1px solid rgba(14,164,122,0.3)",
                color: "var(--good)",
                fontWeight: 600,
                fontSize: 15,
              }}>
                {msg}
              </div>
            ) : (
              <form onSubmit={joinWaitlist} style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto" }}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "var(--fg)",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn btn-primary"
                  style={{ padding: "12px 20px", fontSize: 15, whiteSpace: "nowrap" }}
                >
                  {status === "loading" ? "Joining…" : "Join waitlist"}
                </button>
              </form>
            )}
            {status === "error" && (
              <p style={{ color: "var(--danger)", marginTop: 8, fontSize: 13 }}>{msg}</p>
            )}
            <p className="muted small" style={{ marginTop: 14 }}>
              No spam. Just an email when your spot is ready.
            </p>
          </div>

          {/* Dashboard preview */}
          <div style={{ maxWidth: 820, margin: "0 auto 80px", padding: "0 20px" }}>
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div style={{ background: "var(--panel-2)", borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d3a8" }} />
                <span className="muted small" style={{ marginLeft: 8 }}>Gauge — my-startup / production</span>
              </div>
              <div style={{ padding: 20 }}>
                <div className="grid-3" style={{ marginBottom: 16 }}>
                  {[
                    { label: "Monthly spend", value: "$843", sub: "4 vendors tracked" },
                    { label: "Wasted spend", value: "$210", sub: "Unused capacity" },
                    { label: "Potential savings", value: "$180/mo", sub: "vs cheaper alternatives" },
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
                      <th>Monthly</th>
                      <th>Wasted</th>
                      <th>Best alternative</th>
                      <th>Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { vendor: "OpenAI", monthly: "$480", wasted: "$0", alt: "Anthropic Claude", savings: "25%" },
                      { vendor: "Twilio", monthly: "$143", wasted: "$143", alt: "Vonage", savings: "15%" },
                      { vendor: "Stripe", monthly: "$220", wasted: "$0", alt: "—", savings: "—" },
                    ].map((r) => (
                      <tr key={r.vendor}>
                        <td style={{ fontWeight: 600 }}>{r.vendor}</td>
                        <td style={{ fontWeight: 600 }}>{r.monthly}</td>
                        <td style={{ color: r.wasted !== "$0" ? "var(--warn)" : "var(--muted)" }}>{r.wasted}</td>
                        <td className="muted">{r.alt}</td>
                        <td style={{ color: r.savings !== "—" ? "var(--good)" : "var(--muted)", fontWeight: r.savings !== "—" ? 700 : 400 }}>{r.savings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "80px 0", background: "var(--panel)", borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <h2 style={{ fontSize: 32, fontWeight: 900, textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>
            How it works
          </h2>
          <div className="grid-3" style={{ gap: 20 }}>
            {[
              { step: "1", title: "Connect your vendors", body: "Link OpenAI, Stripe, Twilio, and AWS with your API keys. Takes under 2 minutes. Keys are stored encrypted — never shared." },
              { step: "2", title: "See your real spend", body: "Gauge pulls live billing data directly from each vendor's API. No estimates, no guessing — actual dollars by service." },
              { step: "3", title: "Find savings", body: "See which plans have unused capacity, which vendors have cheaper alternatives, and exactly how much you'd save by switching." },
            ].map((f) => (
              <div key={f.step} className="card" style={{ padding: 24 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #1a56db, #0ea47a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, marginBottom: 14 }}>
                  {f.step}
                </div>
                <div className="heading-sm" style={{ marginBottom: 8 }}>{f.title}</div>
                <p className="muted small" style={{ lineHeight: 1.65 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700 }} className="gradient-text">Gauge</span>
        <span className="muted small">© 2026 Gauge. Built in public.</span>
      </footer>
    </>
  );
}
