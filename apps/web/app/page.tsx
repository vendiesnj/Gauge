"use client";

import { useState } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";


const KPI_ROWS = [
  { label: "Monthly spend",   value: "$1,240", sub: "3 vendors tracked" },
  { label: "Wasted spend",    value: "$94",    sub: "Unused capacity" },
  { label: "Switch & save",   value: "$186/mo", sub: "OpenAI → Anthropic" },
];

const TABLE_ROWS = [
  { vendor: "OpenAI",    monthly: "$780", usage: "4.2M tokens",  wasted: "$0",  alt: "Anthropic",  savings: "~24%" },
  { vendor: "Twilio",    monthly: "$318", usage: "9,400 SMS",    wasted: "$94", alt: "—",           savings: "—"   },
  { vendor: "Stripe",    monthly: "$142", usage: "$47k vol.",     wasted: "$0",  alt: "—",           savings: "—"   },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Connect your vendors", body: "Link OpenAI, Stripe, Twilio, and AWS with your API keys. Under 2 minutes. Keys stored encrypted — never shared." },
  { step: "2", title: "See your real spend",  body: "Gauge pulls live billing data directly from each vendor API. No estimates — actual dollars by service." },
  { step: "3", title: "Find savings",         body: "See unused capacity, cheaper alternatives, and exactly how much you'd save by switching." },
];

export default function LandingPage() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg]       = useState("");

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
    <div className="retro-desktop">

      {/* ── Menu bar ── */}
      <nav className="retro-menubar">
        {/* Left: nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1 }}>
          {["Products", "Pricing", "Docs"].map(item => (
            <span key={item} className="retro-menubar-item">{item}</span>
          ))}
        </div>

        {/* Center: logo */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <img src="/logo.png" alt="Gauge" style={{ height: 42, width: "auto", display: "block" }} />
        </div>

        {/* Right: theme switcher */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 155 }}>
            <ThemeSwitcher direction="down" />
          </div>
        </div>
      </nav>

      {/* ── Main desktop area ── */}
      <div style={{ paddingTop: 54 }}>
        <div className="container">

          {/* Hero: 2-col */}
          <div
            className="retro-hero-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", padding: "64px 0 40px" }}
          >
            {/* Left: text + form + icons */}
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.55)", border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 999, padding: "4px 12px",
                fontSize: 11.5, fontWeight: 600, color: "#5a4530",
                marginBottom: 22, backdropFilter: "blur(6px)",
              }}>
                🔒 Private beta — join the waitlist
              </div>

              <h1 style={{
                fontSize: 50, fontWeight: 900, lineHeight: 1.05,
                marginBottom: 18, letterSpacing: "-0.03em", color: "var(--text)",
              }}>
                See exactly what you&apos;re spending<br />
                across{" "}
                <span style={{
                  background: "linear-gradient(135deg, #1a56db, #0ea47a)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>every API</span>
              </h1>

              <p style={{ fontSize: 17, lineHeight: 1.7, marginBottom: 32, color: "var(--muted)" }}>
                Connect OpenAI, Stripe, Twilio, and AWS. Gauge pulls real billing data,
                spots wasted spend, and shows you what switching vendors would actually save.
              </p>

              {status === "done" ? (
                <div style={{
                  padding: "16px 20px", borderRadius: 12,
                  background: "rgba(14,164,122,0.1)", border: "1px solid rgba(14,164,122,0.25)",
                  color: "#0a7a5a", fontWeight: 600, fontSize: 15,
                }}>{msg}</div>
              ) : (
                <form onSubmit={joinWaitlist} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      flex: 1, padding: "11px 15px", borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                      background: "var(--panel)",
                      color: "var(--text)", fontSize: 15, outline: "none",
                      backdropFilter: "blur(4px)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    style={{
                      padding: "11px 18px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #1a56db 0%, #0ea47a 100%)",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap",
                      opacity: status === "loading" ? 0.6 : 1,
                      boxShadow: "0 2px 10px rgba(26, 86, 219, 0.3)",
                    }}
                  >
                    {status === "loading" ? "Joining…" : "Join waitlist"}
                  </button>
                </form>
              )}
              {status === "error" && (
                <p style={{ color: "#dc2626", marginTop: 8, fontSize: 13 }}>{msg}</p>
              )}
              <p style={{ color: "#8a7255", fontSize: 12, marginTop: 10 }}>
                No spam. Just an email when your spot is ready.
              </p>

              {/* Vendor pill badges */}
              <div style={{ display: "flex", gap: 8, marginTop: 44, flexWrap: "wrap" }}>
                {["OpenAI", "Stripe", "Twilio", "AWS", "Anthropic"].map(v => (
                  <span key={v} style={{
                    padding: "5px 13px", borderRadius: 999,
                    background: "var(--panel)", border: "1px solid var(--border)",
                    fontSize: 12.5, fontWeight: 600, color: "var(--text)",
                    backdropFilter: "blur(4px)",
                  }}>{v}</span>
                ))}
              </div>
            </div>

            {/* Right: OS window */}
            <div className="retro-window-col">
              <div className="os-window">
                <div className="os-titlebar">
                  <div className="os-dots">
                    <span className="os-dot dot-red" />
                    <span className="os-dot dot-yellow" />
                    <span className="os-dot dot-green" />
                  </div>
                  <span className="os-window-title">Gauge — my-startup / production</span>
                </div>
                <div style={{ padding: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
                    {KPI_ROWS.map(k => (
                      <div key={k.label} style={{
                        background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.07)",
                        borderRadius: 10, padding: "12px 13px",
                      }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", fontFamily: "ui-monospace, monospace", letterSpacing: "-0.02em" }}>{k.value}</div>
                        <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {["Vendor", "Monthly", "Usage", "Wasted", "Alternative", "Save"].map(h => (
                          <th key={h} style={{ padding: "7px 9px", textAlign: "left", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TABLE_ROWS.map(r => (
                        <tr key={r.vendor}>
                          <td style={{ padding: "9px", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#0f172a" }}>{r.vendor}</td>
                          <td style={{ padding: "9px", fontFamily: "ui-monospace, monospace", fontWeight: 600, borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#0f172a" }}>{r.monthly}</td>
                          <td style={{ padding: "9px", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#64748b" }}>{r.usage}</td>
                          <td style={{ padding: "9px", fontFamily: "ui-monospace, monospace", borderBottom: "1px solid rgba(0,0,0,0.05)", color: r.wasted !== "$0" ? "#d97706" : "#94a3b8" }}>{r.wasted}</td>
                          <td style={{ padding: "9px", borderBottom: "1px solid rgba(0,0,0,0.05)", color: r.alt !== "—" ? "#2563eb" : "#94a3b8", fontWeight: r.alt !== "—" ? 600 : 400 }}>{r.alt}</td>
                          <td style={{ padding: "9px", borderBottom: "1px solid rgba(0,0,0,0.05)", color: r.savings !== "—" ? "#059669" : "#94a3b8", fontWeight: r.savings !== "—" ? 700 : 400 }}>{r.savings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div style={{ padding: "20px 0 80px" }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 28, letterSpacing: "-0.02em", color: "var(--text)" }}>
              How it works
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {HOW_IT_WORKS.map(f => (
                <div key={f.step} style={{
                  background: "var(--panel)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "22px 20px", backdropFilter: "blur(6px)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg, #1a56db, #0ea47a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 13, marginBottom: 14,
                  }}>{f.step}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{f.title}</div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(0,0,0,0.08)",
        padding: "18px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "var(--panel-2)", backdropFilter: "blur(8px)",
      }}>
        <span style={{ fontWeight: 800, background: "linear-gradient(135deg, #1a56db, #0ea47a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Gauge</span>
        <span style={{ color: "#8a7255", fontSize: 12 }}>© 2026 Gauge. Built in public.</span>
      </footer>
    </div>
  );
}
