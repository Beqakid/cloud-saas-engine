/**
 * Repository for the `import_jobs` table.
 * All D1 queries for jobs live here — no raw SQL elsewhere.
 */
import type {
  ImportJob,
  ImportJobStatus,
  CreateImportJob,
} from "@cloud-saas-engine/types";

export class ImportJobRepo {
  /**
   * Insert a new import job. Sets defaults for status, counters, timestamps.
   */
  async create(db: D1Database, job: CreateImportJob): Promise<ImportJob> {
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO import_jobs (id, tenant_id, filename, r2_key, status, total_rows, processed_rows, error_count, error_log, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 0, 0, 0, NULL, ?, ?)
         RETURNING *`
      )
      .bind(job.id, job.tenant_id, job.filename, job.r2_key, now, now)
      .first<ImportJob>();

    if (!row) throw new Error(`Failed to create import job ${job.id}`);
    return row;
  }

  /**
   * Get a single job by ID. Returns null if not found.
   */
  async getById(db: D1Database, id: string): Promise<ImportJob | null> {
    return db
      .prepare(`SELECT * FROM import_jobs WHERE id = ?`)
      .bind(id)
      .first<ImportJob>();
  }

  /**
   * List jobs, optionally filtered by tenant. Most recent first.
   */
  async list(
    db: D1Database,
    tenantId?: string,
    limit = 50,
    offset = 0
  ): Promise<ImportJob[]> {
    if (tenantId) {
      const { results } = await db
        .prepare(
          `SELECT * FROM import_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(tenantId, limit, offset)
        .all<ImportJob>();
      return results;
    }

    const { results } = await db
      .prepare(
        `SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<ImportJob>();
    return results;
  }

  /**
   * Update job status and optional counters / error log.
   * Only touches the fields you pass — everything else stays unchanged.
   */
  async updateStatus(
    db: D1Database,
    id: string,
    status: ImportJobStatus,
    opts?: {
      totalRows?: number;
      processedRows?: number;
      errorCount?: number;
      errorLog?: string | null;
    }
  ): Promise<void> {
    const sets: string[] = ["status = ?", "updated_at = ?"];
    const binds: unknown[] = [status, new Date().toISOString()];

    if (opts?.totalRows !== undefined) {
      sets.push("total_rows = ?");
      binds.push(opts.totalRows);
    }
    if (opts?.processedRows !== undefined) {
      sets.push("processed_rows = ?");
      binds.push(opts.processedRows);
    }
    if (opts?.errorCount !== undefined) {
      sets.push("error_count = ?");
      binds.push(opts.errorCount);
    }
    if (opts?.errorLog !== undefined) {
      sets.push("error_log = ?");
      binds.push(opts.errorLog);
    }

    binds.push(id);

    await db
      .prepare(`UPDATE import_jobs SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
  }
}
