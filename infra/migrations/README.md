# D1 Migrations

## Overview

All database schema changes are tracked as numbered SQL files in this directory. Migrations run in order and each file executes exactly once.

## Naming Convention

```
{NNNN}_{description}.sql
```

- `NNNN` — zero-padded sequential number (0001, 0002, etc.)
- `description` — short snake_case description of the change

## Creating a New Migration

1. Create a new file: `{next_number}_{description}.sql`
2. Write idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
3. Test against a fresh database to verify it works from scratch
4. Test against the live database to verify it's a no-op on existing schema

## Applying Migrations

### Via Wrangler CLI

```bash
cd infra/wrangler
npx wrangler d1 migrations apply cloud-saas-engine-db
```

### Via Cloudflare API (from Tasklet or CI)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{db_id}/query" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "..."}'
```

## Current Migrations

| # | File | Description | Applied |
|---|------|-------------|---------|
| 0001 | `0001_create_import_tables.sql` | import_jobs + import_rows tables with indexes | ✅ Phase 0 |

## Rules

- **Never edit an applied migration** — create a new one instead
- **Always use IF NOT EXISTS / IF EXISTS** — migrations must be idempotent
- **One concern per migration** — keep them focused and reviewable
