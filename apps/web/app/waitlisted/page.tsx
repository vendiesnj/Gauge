export default function WaitlistedPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "linear-gradient(135deg, #1a56db 0%, #0ea47a 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 900, color: "#fff",
          margin: "0 auto 24px",
        }}>G</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>You're on the list</h1>
        <p className="muted" style={{ lineHeight: 1.65, marginBottom: 24 }}>
          Gauge is in private beta right now. You'll get an email when your spot opens up — usually within a few days.
        </p>
        <p className="muted small">
          Questions? Reply to your confirmation email or find us on{" "}
          <a href="https://twitter.com/getgaugedev" style={{ color: "var(--accent)" }}>X / Twitter</a>.
        </p>
      </div>
    </div>
  );
}
