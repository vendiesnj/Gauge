"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecalculateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function recalculate() {
    setLoading(true);
    try {
      await fetch(`/api/projects/${projectId}/billing/recalculate`, { method: "POST" });
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={recalculate}
      disabled={loading}
      title="Recalculate spend totals and savings from current plan data"
    >
      {loading ? "Recalculating…" : "Recalculate"}
    </button>
  );
}
