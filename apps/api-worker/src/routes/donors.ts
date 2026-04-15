/**
 * CRUD routes for donors.
 * GET /donors, POST /donors, GET /donors/:id, PUT /donors/:id, DELETE /donors/:id
 */
import type { Env } from "@cloud-saas-engine/types";
import { DonorRepo } from "@cloud-saas-engine/core-data";
import { json } from "../router";

const repo = new DonorRepo();

/** GET /donors?tenant_id=xxx&search=xxx */
export async function listDonorsHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const tenantId = ctx.url.searchParams.get("tenant_id") || "default";
  const limit = parseInt(ctx.url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(ctx.url.searchParams.get("offset") || "0", 10);
  const donors = await repo.list(ctx.env.DB, tenantId, limit, offset);
  return json({ ok: true, data: donors });
}

/** GET /donors/:id */
export async function getDonorHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const donor = await repo.getById(ctx.env.DB, ctx.params.id);
  if (!donor) return json({ ok: false, error: "Donor not found" }, 404);
  return json({ ok: true, data: donor });
}

/** POST /donors — body: { tenant_id?, name, email?, address?, city?, state?, zip?, phone? } */
export async function createDonorHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const body = await ctx.request.json<{
    tenant_id?: string;
    name?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  }>();
  if (!body.name) return json({ ok: false, error: "name is required" }, 400);

  const donor = await repo.create(ctx.env.DB, {
    id: crypto.randomUUID(),
    tenant_id: body.tenant_id || "default",
    name: body.name,
    email: body.email,
    address: body.address,
    city: body.city,
    state: body.state,
    zip: body.zip,
    phone: body.phone,
  });
  return json({ ok: true, data: donor }, 201);
}

/** PUT /donors/:id — body: { name?, email?, address?, city?, state?, zip?, phone? } */
export async function updateDonorHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Donor not found" }, 404);

  const body = await ctx.request.json<{
    name?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  }>();
  await repo.update(ctx.env.DB, id, body);
  const updated = await repo.getById(ctx.env.DB, id);
  return json({ ok: true, data: updated });
}

/** DELETE /donors/:id */
export async function deleteDonorHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Donor not found" }, 404);

  await repo.delete(ctx.env.DB, id);
  return json({ ok: true });
}
