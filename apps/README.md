# API Spend Scout Pro

A monorepo starter for an API discovery, spend tracking, and alternative-stack recommendation platform.

## What this includes

- **apps/web** — Next.js dashboard + API routes
- **apps/extension** — VS Code extension that scans a workspace and can push scans to the web app
- **packages/shared** — shared vendor catalog, detectors, types, pricing helpers
- **packages/scanner** — filesystem scanner / static analysis helpers
- **packages/runtime-ingest** — runtime event normalization helpers

## Product surfaces

1. **Connect code** by scanning a local workspace from VS Code
2. **Detect likely external vendors** from imports, env vars, domains, and API key patterns
3. **Track usage** from runtime event uploads
4. **Set or import plan/cost assumptions** in the dashboard
5. **Estimate unused spend**
6. **Compare alternative vendor stacks** from a lightweight benchmark catalog

## Quick start

```bash
pnpm install
pnpm dev
```

Then:

- web app: `http://localhost:3000`
- VS Code extension: open `apps/extension` and press `F5`

## Notes

This is a substantial starter, not a completed production SaaS. The hard parts that still require real integrations are:
- provider OAuth / API billing connectors
- exact invoice reconciliation
- runtime instrumentation rollout across customer apps
- production auth, storage, background jobs, and hardened security

## Environment

Copy `.env.example` to `.env.local` in `apps/web`.

## Demo flow

1. Start the web app.
2. In VS Code, launch the extension host from `apps/extension`.
3. Open any repository in the extension host.
4. Run **API Spend Scout Pro: Scan Workspace**
5. Open the dashboard and import the generated JSON or use the extension's push command.
