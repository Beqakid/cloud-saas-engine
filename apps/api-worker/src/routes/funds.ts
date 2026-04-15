/**
 * CRUD routes for funds.
 * GET /funds, POST /funds, PUT /funds/:id, DELETE /funds/:id
 */
import type { Env } from "@cloud-saas-engine/types";
import { FundRepo } from "@cloud-saas-engine/core-data";
import { json } from "../router";

const repo = new FundRepo();

/** GET /funds?tenant_id=xxx */
export async function listFundsHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const tenantId = ctx.url.searchParams.get("tenant_id") || "default";
  const funds = await repo.list(ctx.env.DB, tenantId);
  return json({ ok: true, data: funds });
}

/** POST /funds — body: { tenant_id?, name, description? } */
export async function createFundHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const body = await ctx.request.json<{ tenant_id?: string; name?: string; description?: string }>();
  if (!body.name) return json({ ok: false, error: "name is required" }, 400);

  const fund = await repo.create(ctx.env.DB, {
    id: crypto.randomUUID(),
    tenant_id: body.tenant_id || "default",
    name: body.name,
    description: body.description,
  });
  return json({ ok: true, data: fund }, 201);
}

/** PUT /funds/:id — body: { name?, description? } */
export async function updateFundHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Fund not found" }, 404);

  const body = await ctx.request.json<{ name?: string; description?: string }>();
  await repo.update(ctx.env.DB, id, body);
  const updated = await repo.getById(ctx.env.DB, id);
  return json({ ok: true, data: updated });
}

/** DELETE /funds/:id */
export async function deleteFundHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Fund not found" }, 404);

  await repo.delete(ctx.env.DB, id);
  return json({ ok: true });
}
