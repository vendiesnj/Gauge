"use client";

import { useState, useEffect } from "react";

const VENDOR_GROUPS = [
  {
    label: "AI / LLM",
    vendors: [
      { id: "openai",      name: "OpenAI" },
      { id: "anthropic",   name: "Anthropic" },
      { id: "groq",        name: "Groq" },
      { id: "mistral",     name: "Mistral AI" },
      { id: "cohere",      name: "Cohere" },
      { id: "replicate",   name: "Replicate" },
      { id: "aws-bedrock", name: "AWS Bedrock" },
      { id: "elevenlabs",  name: "ElevenLabs" },
      { id: "assemblyai",  name: "AssemblyAI" },
      { id: "deepgram",    name: "Deepgram" },
      { id: "pinecone",    name: "Pinecone" },
      { id: "huggingface", name: "Hugging Face" },
      { id: "together",    name: "Together AI" },
      { id: "perplexity",  name: "Perplexity" },
    ],
  },
  {
    label: "Payments",
    vendors: [
      { id: "stripe",         name: "Stripe" },
      { id: "paddle",         name: "Paddle" },
      { id: "plaid",          name: "Plaid" },
      { id: "lemon-squeezy",  name: "Lemon Squeezy" },
      { id: "braintree",      name: "Braintree" },
      { id: "square",         name: "Square" },
    ],
  },
  {
    label: "SMS / Voice",
    vendors: [
      { id: "twilio",  name: "Twilio" },
      { id: "vonage",  name: "Vonage" },
      { id: "sinch",   name: "Sinch" },
      { id: "messagebird", name: "MessageBird" },
    ],
  },
  {
    label: "Email",
    vendors: [
      { id: "resend",    name: "Resend" },
      { id: "sendgrid",  name: "SendGrid" },
      { id: "mailgun",   name: "Mailgun" },
      { id: "postmark",  name: "Postmark" },
      { id: "ses",       name: "AWS SES" },
      { id: "mailchimp", name: "Mailchimp" },
    ],
  },
  {
    label: "Cloud / Infra",
    vendors: [
      { id: "aws",         name: "AWS" },
      { id: "gcp",         name: "Google Cloud" },
      { id: "azure",       name: "Azure" },
      { id: "vercel",      name: "Vercel" },
      { id: "cloudflare",  name: "Cloudflare" },
      { id: "railway",     name: "Railway" },
      { id: "render",      name: "Render" },
      { id: "fly",         name: "Fly.io" },
    ],
  },
  {
    label: "Database",
    vendors: [
      { id: "supabase",    name: "Supabase" },
      { id: "neon",        name: "Neon" },
      { id: "planetscale", name: "PlanetScale" },
      { id: "upstash",     name: "Upstash" },
      { id: "mongodb",     name: "MongoDB Atlas" },
      { id: "turso",       name: "Turso" },
    ],
  },
  {
    label: "Auth",
    vendors: [
      { id: "auth0",  name: "Auth0" },
      { id: "clerk",  name: "Clerk" },
      { id: "okta",   name: "Okta" },
      { id: "workos", name: "WorkOS" },
    ],
  },
  {
    label: "Monitoring / Analytics",
    vendors: [
      { id: "datadog",  name: "Datadog" },
      { id: "sentry",   name: "Sentry" },
      { id: "axiom",    name: "Axiom" },
      { id: "mixpanel", name: "Mixpanel" },
      { id: "posthog",  name: "PostHog" },
      { id: "segment",  name: "Segment" },
      { id: "logrocket", name: "LogRocket" },
    ],
  },
  {
    label: "Search / Other",
    vendors: [
      { id: "algolia",     name: "Algolia" },
      { id: "meilisearch", name: "Meilisearch" },
      { id: "google-maps", name: "Google Maps" },
      { id: "mapbox",      name: "Mapbox" },
      { id: "pusher",      name: "Pusher" },
      { id: "ably",        name: "Ably" },
    ],
  },
];


const FEATURES = [
  {
    icon: "📡",
    title: "Alerts when vendors reprice",
    body: "Gauge checks vendor pricing pages daily. When OpenAI, Twilio, or Stripe changes a rate, you get an email before it shows up on your bill.",
    badge: null,
  },
  {
    icon: "📊",
    title: "Direct from vendor APIs",
    body: "We pull usage and spend straight from each vendor's billing API, not inferred from your bank statement. Real token counts, SMS volumes, and dollar amounts.",
    badge: null,
  },
  {
    icon: "🗳️",
    title: "Built around actual demand",
    body: "Vote on which vendors to support next. Every integration we ship is driven by what developers are actually using, not what looks good on a feature list.",
    badge: null,
  },
  {
    icon: "📈",
    title: "Rate benchmarks",
    body: "See how your effective rate compares to teams your size. Know when you're paying above median, and when you've grown large enough to negotiate enterprise pricing.",
    badge: "Coming soon",
  },
];

const KPI_ROWS = [
  { label: "Monthly spend",  value: "$1,242", sub: "5 vendors tracked" },
  { label: "Wasted spend",   value: "$72",    sub: "Unused Twilio capacity" },
  { label: "Switch & save",  value: "$437/mo", sub: "OpenAI → Groq" },
];

const TABLE_ROWS = [
  { vendor: "OpenAI",  monthly: "$480", usage: "192M tokens",  wasted: "$0",  alt: "Groq",     savings: "~89%" },
  { vendor: "Twilio",  monthly: "$280", usage: "35,400 SMS",   wasted: "$72", alt: "Vonage",   savings: "~20%" },
  { vendor: "Stripe",  monthly: "$186", usage: "$64k vol.",     wasted: "$0",  alt: "—",        savings: "—"    },
  { vendor: "Resend",  monthly: "$68",  usage: "68k emails",   wasted: "$0",  alt: "SendGrid", savings: "~40%" },
  { vendor: "AWS",     monthly: "$228", usage: "pay-per-use",  wasted: "$0",  alt: "—",        savings: "—"    },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Connect your vendors", body: "Link OpenAI, Stripe, Twilio, and AWS with your API keys. Under 2 minutes. Keys stored encrypted, never shared." },
  { step: "2", title: "See your real spend",  body: "Gauge pulls live billing data directly from each vendor API. No estimates. Actual dollars by service." },
  { step: "3", title: "Find savings",         body: "See unused capacity, cheaper alternatives, and exactly how much you'd save by switching." },
];

export default function LandingPage() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg]       = useState("");

  // Vendor request state
  const [reqEmail,    setReqEmail]    = useState("");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [reqStatus,   setReqStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [reqMsg,      setReqMsg]      = useState("");
  const [counts,      setCounts]      = useState<Record<string, number>>({});
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    // Lock landing page to warm theme regardless of user's saved preference
    document.documentElement.setAttribute("data-theme", "gauge");
  }, []);

  useEffect(() => {
    fetch("/api/vendor-requests")
      .then(r => r.json())
      .then(setCounts)
      .catch(() => {});
    fetch("/api/stats")
      .then(r => r.json())
      .then((d: { waitlistCount: number }) => setWaitlistCount(d.waitlistCount))
      .catch(() => {});
  }, []);

  function toggleVendor(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submitVendorRequests(e: React.FormEvent) {
    e.preventDefault();
    if (!reqEmail.trim() || selected.size === 0) return;
    setReqStatus("loading");
    try {
      const res = await fetch("/api/vendor-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: reqEmail.trim(), vendorIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      // Update counts optimistically
      setCounts(prev => {
        const next = { ...prev };
        for (const id of selected) next[id] = (next[id] ?? 0) + 1;
        return next;
      });
      setReqStatus("done");
      setReqMsg(`Logged! We'll prioritize ${selected.size} vendor${selected.size !== 1 ? "s" : ""} based on demand.`);
      setSelected(new Set());
    } catch {
      setReqStatus("error");
      setReqMsg("Something went wrong. Try again.");
    }
  }

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
      setMsg("You're on the list. Check your email.");
    } catch {
      setStatus("error");
      setMsg("Something went wrong. Try again.");
    }
  }

  return (
    <div className="retro-desktop">
      <style>{`
        @media (max-width: 768px) {
          .retro-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; padding: 40px 0 24px !important; }
          .retro-window-col { display: none !important; }
          .retro-how-grid { grid-template-columns: 1fr 1fr !important; }
          @media (max-width: 480px) { .retro-how-grid { grid-template-columns: 1fr !important; } }
          .retro-menubar { padding: 0 16px !important; }
          .retro-menubar .retro-menubar-item { display: none !important; }
          .container { padding: 0 16px !important; }
          h1 { font-size: 36px !important; }
          .retro-desktop { padding-bottom: 60px; }
          .vendor-pill-grid { gap: 6px !important; }
        }
      `}</style>

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

        <div style={{ flex: 1 }} />
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
                🔒 Private beta{waitlistCount ? ` · ${waitlistCount.toLocaleString()} on the list` : " · join the waitlist"}
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
                Connect your vendors and Gauge pulls real billing data directly from their APIs.
                Spots wasted spend and shows you what switching would actually save.
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
              <div style={{ marginTop: 44 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a7255", marginBottom: 10 }}>
                  Live billing API · auto-connect
                </p>
                <div className="vendor-pill-grid" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {["OpenAI", "Anthropic", "Stripe", "Twilio", "AWS", "Resend"].map(v => (
                    <span key={v} style={{
                      padding: "5px 13px", borderRadius: 999,
                      background: "var(--panel)", border: "1px solid var(--border)",
                      fontSize: 12.5, fontWeight: 600, color: "var(--text)",
                      backdropFilter: "blur(4px)",
                    }}>{v}</span>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#8a7255", lineHeight: 1.6 }}>
                  + usage calculator for any vendor · more auto-connect coming soon
                </p>
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
                  <span className="os-window-title">Gauge · my-startup / production</span>
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

          {/* Vendor request section */}
          <div style={{ padding: "20px 0 60px" }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.02em", color: "var(--text)" }}>
              Which vendors do you want us to support?
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 28, lineHeight: 1.6 }}>
              We prioritize billing integrations based on demand. Select any vendors you use and we&apos;ll push harder to get them into Gauge.
            </p>

            {VENDOR_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 10 }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.vendors.map(v => {
                    const isSelected = selected.has(v.id);
                    const count = counts[v.id];
                    return (
                      <button
                        key={v.id}
                        onClick={() => toggleVendor(v.id)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                          cursor: "pointer", transition: "all 0.1s",
                          border: isSelected ? "1.5px solid #1a56db" : "1.5px solid var(--border)",
                          background: isSelected ? "rgba(26,86,219,0.08)" : "var(--panel)",
                          color: isSelected ? "#1a56db" : "var(--text)",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                        {v.name}
                        {count != null && count > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 5px",
                            borderRadius: 999,
                            background: isSelected ? "rgba(26,86,219,0.15)" : "rgba(0,0,0,0.06)",
                            color: isSelected ? "#1a56db" : "var(--muted)",
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selected.size > 0 && (
              <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 12, background: "var(--panel)", border: "1px solid var(--border)", backdropFilter: "blur(6px)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>
                  {selected.size} vendor{selected.size !== 1 ? "s" : ""} selected. Drop your email to log your vote.
                </p>
                {reqStatus === "done" ? (
                  <p style={{ color: "#059669", fontWeight: 600, fontSize: 14 }}>{reqMsg}</p>
                ) : (
                  <form onSubmit={submitVendorRequests} style={{ display: "flex", gap: 8, maxWidth: 440 }}>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={reqEmail}
                      onChange={e => setReqEmail(e.target.value)}
                      required
                      style={{
                        flex: 1, padding: "9px 13px", borderRadius: 8,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg)", color: "var(--text)",
                        fontSize: 14, outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={reqStatus === "loading"}
                      style={{
                        padding: "9px 16px", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg, #1a56db 0%, #0ea47a 100%)",
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", whiteSpace: "nowrap",
                        opacity: reqStatus === "loading" ? 0.6 : 1,
                      }}
                    >
                      {reqStatus === "loading" ? "Saving…" : "Submit"}
                    </button>
                  </form>
                )}
                {reqStatus === "error" && (
                  <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{reqMsg}</p>
                )}
              </div>
            )}
          </div>

          {/* How it works */}
          <div style={{ padding: "20px 0 60px" }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 28, letterSpacing: "-0.02em", color: "var(--text)" }}>
              How it works
            </h2>
            <div className="retro-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
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

          {/* What makes Gauge different */}
          <div style={{ padding: "0 0 80px" }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.02em", color: "var(--text)" }}>
              What makes Gauge different
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 28, lineHeight: 1.6 }}>
              Not another dashboard. Not estimates. Real data, automated alerts, and built around what developers actually need.
            </p>
            <div className="retro-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {FEATURES.map(f => (
                <div key={f.title} style={{
                  background: "var(--panel)", border: `1px solid ${f.badge ? "rgba(26,86,219,0.2)" : "var(--border)"}`,
                  borderRadius: 14, padding: "22px 20px", backdropFilter: "blur(6px)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  position: "relative",
                }}>
                  {f.badge && (
                    <span style={{
                      position: "absolute", top: 14, right: 14,
                      fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 999, background: "rgba(26,86,219,0.1)",
                      color: "#1a56db", textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{f.badge}</span>
                  )}
                  <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
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
