/**
 * Church domain types — donors, funds, donations.
 */

// ── Donor ──────────────────────────────────────────────

export interface Donor {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDonor {
  id: string;
  tenant_id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
}

export interface UpdateDonor {
  name?: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
}

// ── Fund ───────────────────────────────────────────────

export interface Fund {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CreateFund {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
}

export interface UpdateFund {
  name?: string;
  description?: string | null;
}

// ── Donation ───────────────────────────────────────────

export type DonationMethod = "cash" | "check" | "card" | "ach" | "other";

export interface Donation {
  id: string;
  tenant_id: string;
  donor_id: string;
  fund_id: string | null;
  amount: number;
  date: string;
  method: string | null;
  check_number: string | null;
  notes: string | null;
  import_row_id: number | null;
  created_at: string;
}

export interface CreateDonation {
  id: string;
  tenant_id: string;
  donor_id: string;
  fund_id?: string | null;
  amount: number;
  date: string;
  method?: string | null;
  check_number?: string | null;
  notes?: string | null;
  import_row_id?: number | null;
}

export interface UpdateDonation {
  donor_id?: string;
  fund_id?: string | null;
  amount?: number;
  date?: string;
  method?: string | null;
  check_number?: string | null;
  notes?: string | null;
}
