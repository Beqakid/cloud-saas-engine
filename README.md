# Cloud SaaS Engine

A Cloudflare-native AI platform for launching multiple SaaS apps.

## Architecture

- **Runtime:** Cloudflare Workers, Durable Objects, Workflows, Queues, D1, R2, KV, AI Gateway
- **Monorepo:** Turborepo with apps/, packages/, products/
- **First product:** Church donations & tax-statement app

## Structure

- `apps/api-worker` — Main API Worker
- `apps/admin-web` — Admin console (Cloudflare Pages)
- `apps/church-web` — Church-facing app
- `packages/*` — Shared platform packages
- `products/church-plugin` — Church domain logic
- `infra/` — Wrangler configs and D1 migrations

## Getting Started

```bash
npm install
npx turbo build
cd apps/api-worker && npx wrangler dev
```
