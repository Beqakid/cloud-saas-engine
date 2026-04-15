import { json } from "../router";
import type { RouteContext } from "../router";
import { ImportJobRepo, ImportRowRepo } from "@cloud-saas-engine/core-data";

const jobRepo = new ImportJobRepo();
const rowRepo = new ImportRowRepo();

/**
 * GET /jobs — list all jobs (newest first, limit 50).
 * Optional query param: ?tenant_id=xxx
 */
export async function listJobsHandler(ctx: RouteContext): Promise<Response> {
  const tenantId = ctx.url.searchParams.get("tenant_id") || undefined;
  const limit = parseInt(ctx.url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(ctx.url.searchParams.get("offset") || "0", 10);

  const jobs = await jobRepo.list(ctx.env.DB, tenantId, limit, offset);

  return json({ ok: true, data: jobs });
}

/**
 * GET /jobs/:id/status — single job with row counts.
 * Checks KV cache first for terminal states, falls back to D1.
 */
export async function jobStatusHandler(ctx: RouteContext): Promise<Response> {
  const jobId = ctx.params.id;

  // 1. Try KV cache first
  const cached = await ctx.env.CACHE.get(`job:${jobId}`);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.status === "completed" || data.status === "failed") {
        return json({ ok: true, data, source: "cache" });
      }
    } catch {
      // Corrupted cache — fall through to D1
    }
  }

  // 2. Fall back to D1
  const job = await jobRepo.getById(ctx.env.DB, jobId);
  if (!job) {
    return json({ ok: false, error: "Job not found" }, 404);
  }

  // 3. Cache the result
  const status = {
    id: job.id,
    status: job.status,
    total_rows: job.total_rows,
    processed_rows: job.processed_rows,
    error_count: job.error_count,
    updated_at: job.updated_at,
  };
  await ctx.env.CACHE.put(`job:${jobId}`, JSON.stringify(status), {
    expirationTtl: 3600,
  });

  return json({ ok: true, data: job, source: "d1" });
}

/**
 * GET /jobs/:id/rows — paginated list of imported rows for a job.
 */
export async function jobRowsHandler(ctx: RouteContext): Promise<Response> {
  const jobId = ctx.params.id;
  const limit = parseInt(ctx.url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(ctx.url.searchParams.get("offset") || "0", 10);

  const rows = await rowRepo.getByJobId(ctx.env.DB, jobId, limit, offset);
  const counts = await rowRepo.countByJobId(ctx.env.DB, jobId);

  return json({
    ok: true,
    data: {
      job_id: jobId,
      rows,
      counts,
    },
  });
}
