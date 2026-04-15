-- Migration: 0002_create_church_tables
-- Description: Church domain tables — donors, funds, donations
-- Date: 2025-04-15

-- Donors table
CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_donors_tenant ON donors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_donors_name ON donors(tenant_id, name);

-- Funds table (e.g., "General Fund", "Building Fund", "Missions")
CREATE TABLE IF NOT EXISTS funds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funds_tenant ON funds(tenant_id);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  donor_id TEXT NOT NULL REFERENCES donors(id),
  fund_id TEXT REFERENCES funds(id),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  method TEXT,
  check_number TEXT,
  notes TEXT,
  import_row_id INTEGER REFERENCES import_rows(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_donations_tenant ON donations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_fund ON donations(fund_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_donations_import ON donations(import_row_id);
