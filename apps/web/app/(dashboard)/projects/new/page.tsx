"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

type Repo = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  pushedAt: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json())
      .then((d) => {
        setOrgs(d.orgs ?? []);
        if (d.orgs?.length > 0) setOrgId(d.orgs[0].id);
      });

    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((d) => {
        setRepos(d.repos ?? []);
        setReposLoading(false);
      })
      .catch(() => setReposLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return repos.slice(0, 30);
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [repos, search]);

  async function handleImport() {
    if (!selectedRepo) return;
    setCreating(true);
    setError("");

    try {
      let targetOrgId = orgId;

      if (!targetOrgId && newOrgName.trim()) {
        const res = await fetch("/api/orgs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: newOrgName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create org");
        targetOrgId = data.org.id;
      }

      if (!targetOrgId) {
        setError("Please select or create an organization.");
        setCreating(false);
        return;
      }

      // Create project
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgId: targetOrgId,
          name: selectedRepo.name,
          description: selectedRepo.description ?? "",
          repoUrl: `https://github.com/${selectedRepo.fullName}`,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to create project");

      const projectId = createData.project.id;

      // Immediately trigger a GitHub scan
      const formData = new FormData();
      formData.append("type", "github");
      await fetch(`/api/projects/${projectId}/scan`, {
        method: "POST",
        body: formData,
      });

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="heading-lg">Import from GitHub</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Select a repository to import. We'll scan it immediately for API vendors and spend.
        </p>
      </div>

      {/* Org */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="heading-sm" style={{ marginBottom: 14 }}>Organization</div>
        {orgs.length > 0 ? (
          <div className="form-group">
            <label className="label">Select organization</label>
            <select className="select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              <option value="">+ Create new organization</option>
            </select>
          </div>
        ) : null}
        {(!orgId || orgs.length === 0) && (
          <div className="form-group" style={{ marginTop: orgs.length > 0 ? 12 : 0 }}>
            <label className="label">Organization name</label>
            <input
              className="input"
              placeholder="Acme Corp"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required={!orgId}
            />
          </div>
        )}
      </div>

      {/* Repo picker */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="heading-sm" style={{ marginBottom: 14 }}>Repository</div>

        <input
          className="input"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {reposLoading ? (
          <p className="muted small">Loading repositories…</p>
        ) : repos.length === 0 ? (
          <p className="muted small">No repositories found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => setSelectedRepo(repo)}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${selectedRepo?.id === repo.id ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
                  background: selectedRepo?.id === repo.id ? "rgba(99,102,241,0.12)" : "transparent",
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{repo.fullName}</span>
                  {repo.private && (
                    <span style={{ fontSize: 11, opacity: 0.6, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 5px" }}>
                      private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{repo.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRepo && (
        <div className="card-sm" style={{ marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <span style={{ fontSize: 13 }}>
            Selected: <strong>{selectedRepo.fullName}</strong> — will be imported and scanned immediately.
          </span>
        </div>
      )}

      {error && (
        <div className="card-sm" style={{ marginBottom: 16, background: "var(--danger-bg)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <div className="row gap-12">
        <button
          type="button"
          className="btn btn-primary"
          disabled={creating || !selectedRepo || (!orgId && !newOrgName.trim())}
          onClick={handleImport}
        >
          {creating ? "Importing…" : "Import & scan →"}
        </button>
        <a href="/projects" className="btn btn-ghost">Cancel</a>
      </div>
    </div>
  );
}
