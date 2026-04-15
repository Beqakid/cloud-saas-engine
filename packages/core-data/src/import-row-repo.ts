/**
 * Repository for the `import_rows` table.
 * All D1 queries for import rows live here.
 */
import type { ImportRow, CreateImportRow } from "@cloud-saas-engine/types";

/** Row counts broken down by status. */
export interface ImportRowCounts {
  total: number;
  ok: number;
  error: number;
}

export class ImportRowRepo {
  /**
   * Batch-insert rows using D1's batch API.
   * Splits into chunks of 50 to stay within D1 bind-parameter limits.
   */
  async batchInsert(db: D1Database, rows: CreateImportRow[]): Promise<void> {
    if (rows.length === 0) return;

    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map((row) =>
        db
          .prepare(
            `INSERT INTO import_rows (job_id, row_number, raw_data, parsed_data, status, error, created_at)
             VALUES (?, ?, ?, NULL, ?, NULL, ?)`
          )
          .bind(
            row.job_id,
            row.row_number,
            row.raw_data,
            row.status,
            new Date().toISOString()
          )
      );
      await db.batch(stmts);
    }
  }

  /**
   * Get rows for a given job, ordered by row_number.
   */
  async getByJobId(
    db: D1Database,
    jobId: string,
    limit = 100,
    offset = 0
  ): Promise<ImportRow[]> {
    const { results } = await db
      .prepare(
        `SELECT * FROM import_rows WHERE job_id = ? ORDER BY row_number ASC LIMIT ? OFFSET ?`
      )
      .bind(jobId, limit, offset)
      .all<ImportRow>();
    return results;
  }

  /**
   * Count rows by status for a given job.
   */
  async countByJobId(db: D1Database, jobId: string): Promise<ImportRowCounts> {
    const row = await db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('valid', 'imported') THEN 1 ELSE 0 END) as ok,
           SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as error
         FROM import_rows WHERE job_id = ?`
      )
      .bind(jobId)
      .first<{ total: number; ok: number; error: number }>();

    return {
      total: row?.total ?? 0,
      ok: row?.ok ?? 0,
      error: row?.error ?? 0,
    };
  }
}
