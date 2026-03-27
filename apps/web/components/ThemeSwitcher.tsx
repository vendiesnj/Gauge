"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "gauge",    label: "Cloud",  colors: ["#2563eb", "#0ea47a"] },
  { id: "terminal", label: "Slate",  colors: ["#6366f1", "#06b6d4"] },
  { id: "obsidian", label: "Warm",   colors: ["#0d9488", "#d97706"] },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export function ThemeSwitcher({ direction = "up" }: { direction?: "up" | "down" }) {
  const [current, setCurrent] = useState<ThemeId>("gauge");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gauge-theme") as ThemeId | null;
    if (saved) apply(saved);
  }, []);

  function apply(id: ThemeId) {
    document.documentElement.setAttribute("data-theme", id);
    localStorage.setItem("gauge-theme", id);
    setCurrent(id);
  }

  const active = THEMES.find((t) => t.id === current)!;
  const dropdownPos = direction === "up"
    ? { bottom: "calc(100% + 6px)" }
    : { top: "calc(100% + 6px)" };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 11px", borderRadius: 9,
          background: "var(--panel-2)", border: "1px solid var(--border-strong)",
          color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          width: "100%",
        }}
      >
        <span style={{ display: "flex", gap: 3 }}>
          {active.colors.map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </span>
        {active.label}
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", ...dropdownPos, left: 0, right: 0,
          background: "var(--panel-2)", border: "1px solid var(--border-strong)",
          borderRadius: 10, overflow: "hidden", zIndex: 200,
        }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { apply(t.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "9px 12px",
                background: t.id === current ? "var(--accent-glow)" : "transparent",
                color: t.id === current ? "var(--accent)" : "var(--text)",
                border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", gap: 3 }}>
                {t.colors.map((c) => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                ))}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
