/**
 * Import pipeline domain types.
 * Column names match the live D1 schema exactly (migration 0001).
 */

// ── Job status union ─────────────────────────────────────────────
export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

// ── Import row status union ──────────────────────────────────────
export type ImportRowStatus = "pending" | "valid" | "invalid" | "imported";

// ── import_jobs table ────────────────────────────────────────────
export interface ImportJob {
  /** UUID, TEXT PRIMARY KEY */
  id: string;
  tenant_id: string;
  /** Original upload filename */
  filename: string;
  /** R2 object key, e.g. imports/{tenant}/{jobId}/{filename} */
  r2_key: string;
  status: ImportJobStatus;
  total_rows: number;
  processed_rows: number;
  error_count: number;
  /** JSON array of row-level errors, nullable */
  error_log: string | null;
  /** ISO-8601 TEXT */
  created_at: string;
  /** ISO-8601 TEXT */
  updated_at: string;
}

// ── import_rows table ────────────────────────────────────────────
export interface ImportRow {
  /** INTEGER PRIMARY KEY AUTOINCREMENT */
  id: number;
  /** FK → import_jobs.id */
  job_id: string;
  row_number: number;
  /** Original CSV row as JSON string */
  raw_data: string;
  /** Normalized / validated data as JSON string, nullable */
  parsed_data: string | null;
  status: ImportRowStatus;
  /** Row-level error message, nullable */
  error: string | null;
  /** ISO-8601 TEXT */
  created_at: string;
}

// ── Convenience types for create operations ──────────────────────
/** Fields required to INSERT a new import_jobs row (DB handles defaults). */
export type CreateImportJob = Pick<
  ImportJob,
  "id" | "tenant_id" | "filename" | "r2_key"
>;

/** Fields required to INSERT a new import_rows row. */
export type CreateImportRow = Pick<
  ImportRow,
  "job_id" | "row_number" | "raw_data" | "status"
>;
