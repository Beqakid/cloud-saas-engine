/**
 * CRUD routes for donations.
 * GET /donations, POST /donations, GET /donations/:id, PUT /donations/:id, DELETE /donations/:id
 */
import type { Env } from "@cloud-saas-engine/types";
import { DonationRepo } from "@cloud-saas-engine/core-data";
import { json } from "../router";

const repo = new DonationRepo();

/** GET /donations?tenant_id=xxx&donor_id=xxx&fund_id=xxx&from=xxx&to=xxx */
export async function listDonationsHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const tenantId = ctx.url.searchParams.get("tenant_id") || "default";
  const donorId = ctx.url.searchParams.get("donor_id");
  const fundId = ctx.url.searchParams.get("fund_id");
  const from = ctx.url.searchParams.get("from");
  const to = ctx.url.searchParams.get("to");
  const limit = parseInt(ctx.url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(ctx.url.searchParams.get("offset") || "0", 10);

  let donations;
  if (donorId) {
    donations = await repo.listByDonor(ctx.env.DB, donorId, limit, offset);
  } else if (fundId) {
    donations = await repo.listByFund(ctx.env.DB, fundId, limit, offset);
  } else if (from && to) {
    donations = await repo.listByDateRange(ctx.env.DB, tenantId, from, to, limit, offset);
  } else {
    donations = await repo.list(ctx.env.DB, tenantId, limit, offset);
  }

  return json({ ok: true, data: donations });
}

/** GET /donations/:id */
export async function getDonationHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const donation = await repo.getById(ctx.env.DB, ctx.params.id);
  if (!donation) return json({ ok: false, error: "Donation not found" }, 404);
  return json({ ok: true, data: donation });
}

/** POST /donations — body: { tenant_id?, donor_id, fund_id?, amount, date, method?, check_number?, notes? } */
export async function createDonationHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const body = await ctx.request.json<{
    tenant_id?: string;
    donor_id?: string;
    fund_id?: string;
    amount?: number;
    date?: string;
    method?: string;
    check_number?: string;
    notes?: string;
  }>();

  if (!body.donor_id) return json({ ok: false, error: "donor_id is required" }, 400);
  if (!body.amount || body.amount <= 0) return json({ ok: false, error: "amount must be positive" }, 400);
  if (!body.date) return json({ ok: false, error: "date is required" }, 400);

  const donation = await repo.create(ctx.env.DB, {
    id: crypto.randomUUID(),
    tenant_id: body.tenant_id || "default",
    donor_id: body.donor_id,
    fund_id: body.fund_id,
    amount: body.amount,
    date: body.date,
    method: body.method,
    check_number: body.check_number,
    notes: body.notes,
  });
  return json({ ok: true, data: donation }, 201);
}

/** PUT /donations/:id — body: { donor_id?, fund_id?, amount?, date?, method?, check_number?, notes? } */
export async function updateDonationHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Donation not found" }, 404);

  const body = await ctx.request.json<{
    donor_id?: string;
    fund_id?: string;
    amount?: number;
    date?: string;
    method?: string;
    check_number?: string;
    notes?: string;
  }>();
  await repo.update(ctx.env.DB, id, body);
  const updated = await repo.getById(ctx.env.DB, id);
  return json({ ok: true, data: updated });
}

/** DELETE /donations/:id */
export async function deleteDonationHandler(ctx: {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
}): Promise<Response> {
  const id = ctx.params.id;
  const existing = await repo.getById(ctx.env.DB, id);
  if (!existing) return json({ ok: false, error: "Donation not found" }, 404);

  await repo.delete(ctx.env.DB, id);
  return json({ ok: true });
}
