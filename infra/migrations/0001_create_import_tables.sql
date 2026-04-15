-- Migration: 0001_create_import_tables
-- Description: Create import_jobs and import_rows tables for CSV import pipeline

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_log TEXT,  -- JSON array of row-level errors
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);

CREATE TABLE IF NOT EXISTS import_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES import_jobs(id),
  row_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,       -- original CSV row as JSON
  parsed_data TEXT,             -- normalized/validated data as JSON
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | valid | invalid | imported
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(job_id, row_number)
);

CREATE INDEX idx_import_rows_job ON import_rows(job_id);
CREATE INDEX idx_import_rows_status ON import_rows(job_id, status);
