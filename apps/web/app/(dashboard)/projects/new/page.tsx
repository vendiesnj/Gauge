"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json())
      .then((d) => {
        setOrgs(d.orgs ?? []);
        if (d.orgs?.length > 0) setOrgId(d.orgs[0].id);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      let targetOrgId = orgId;

      // Create org if needed
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

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: targetOrgId, name, description, repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");

      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="heading-lg">New project</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          A project tracks one codebase — vendors, usage, and spend.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stack gap-16">
        {/* Org */}
        <div className="card">
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

        {/* Project details */}
        <div className="card">
          <div className="heading-sm" style={{ marginBottom: 14 }}>Project details</div>

          <div className="stack gap-12">
            <div className="form-group">
              <label className="label">Project name *</label>
              <input
                className="input"
                placeholder="my-backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="Optional — e.g. Main API backend"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">GitHub repository URL</label>
              <input
                className="input"
                placeholder="https://github.com/org/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <span className="muted small" style={{ marginTop: 4 }}>
                Optional. Used to display context — GitHub App integration coming soon.
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="card-sm" style={{ background: "var(--danger-bg)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="row gap-12">
          <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create project →"}
          </button>
          <a href="/projects" className="btn btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
  );
}
