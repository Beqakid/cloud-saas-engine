/**
 * Church CSV Mapper
 *
 * Maps raw import rows → donors + donations.
 * Handles common church CSV formats with columns like:
 *   name, email, amount, date, fund, method, check_number, address, city, state, zip, phone
 *
 * Column detection is case-insensitive and tolerant of common variations.
 */
import type { Env, CreateDonor, CreateDonation } from "@cloud-saas-engine/types";
import { DonorRepo, DonationRepo, FundRepo, ImportRowRepo } from "@cloud-saas-engine/core-data";

const donorRepo = new DonorRepo();
const donationRepo = new DonationRepo();
const fundRepo = new FundRepo();
const importRowRepo = new ImportRowRepo();

export interface MapperResult {
  donorsCreated: number;
  donorsMatched: number;
  donationsCreated: number;
  fundsCreated: number;
  errors: string[];
}

/**
 * Process all imported rows for a job and create church domain records.
 */
export async function mapImportToChurch(
  env: Env,
  jobId: string,
  tenantId: string
): Promise<MapperResult> {
  const result: MapperResult = {
    donorsCreated: 0,
    donorsMatched: 0,
    donationsCreated: 0,
    fundsCreated: 0,
    errors: [],
  };

  // Fetch all imported rows for this job
  const rows = await importRowRepo.listByJob(env.DB, jobId);
  if (rows.length === 0) return result;

  // Cache for donor/fund lookups to minimize DB calls
  const donorCache = new Map<string, string>(); // "name|email" → donor_id
  const fundCache = new Map<string, string>();   // fund_name → fund_id

  // Pre-load existing funds
  const existingFunds = await fundRepo.list(env.DB, tenantId);
  for (const f of existingFunds) {
    fundCache.set(f.name.toLowerCase(), f.id);
  }

  // Collect donations for batch insert
  const donationsToCreate: CreateDonation[] = [];

  for (const row of rows) {
    if (row.status !== "imported") continue;

    try {
      const data = JSON.parse(row.raw_data) as Record<string, string>;
      const mapped = mapColumns(data);

      if (!mapped.name || !mapped.amount || !mapped.date) {
        result.errors.push(`Row ${row.row_number}: missing required field (name, amount, or date)`);
        continue;
      }

      // Find or create donor
      const donorKey = `${mapped.name.toLowerCase()}|${(mapped.email || "").toLowerCase()}`;
      let donorId = donorCache.get(donorKey);

      if (!donorId) {
        // Try email match first, then name match
        let existing = mapped.email
          ? await donorRepo.findByEmail(env.DB, tenantId, mapped.email)
          : null;
        if (!existing) {
          existing = await donorRepo.findByName(env.DB, tenantId, mapped.name);
        }

        if (existing) {
          donorId = existing.id;
          result.donorsMatched++;
        } else {
          const newDonor: CreateDonor = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            name: mapped.name,
            email: mapped.email || null,
            address: mapped.address || null,
            city: mapped.city || null,
            state: mapped.state || null,
            zip: mapped.zip || null,
            phone: mapped.phone || null,
          };
          await donorRepo.create(env.DB, newDonor);
          donorId = newDonor.id;
          result.donorsCreated++;
        }
        donorCache.set(donorKey, donorId);
      }

      // Find or create fund
      let fundId: string | null = null;
      if (mapped.fund) {
        const fundKey = mapped.fund.toLowerCase();
        fundId = fundCache.get(fundKey) || null;

        if (!fundId) {
          const existingFund = await fundRepo.findByName(env.DB, tenantId, mapped.fund);
          if (existingFund) {
            fundId = existingFund.id;
          } else {
            fundId = crypto.randomUUID();
            await fundRepo.create(env.DB, {
              id: fundId,
              tenant_id: tenantId,
              name: mapped.fund,
            });
            result.fundsCreated++;
          }
          fundCache.set(fundKey, fundId);
        }
      }

      // Queue donation for batch insert
      donationsToCreate.push({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        donor_id: donorId,
        fund_id: fundId,
        amount: mapped.amount,
        date: mapped.date,
        method: mapped.method || null,
        check_number: mapped.checkNumber || null,
        notes: mapped.notes || null,
        import_row_id: row.id,
      });
    } catch {
      result.errors.push(`Row ${row.row_number}: failed to parse`);
    }
  }

  // Batch insert donations (chunks of 50 for D1)
  const BATCH = 50;
  for (let i = 0; i < donationsToCreate.length; i += BATCH) {
    const chunk = donationsToCreate.slice(i, i + BATCH);
    await donationRepo.batchCreate(env.DB, chunk);
  }
  result.donationsCreated = donationsToCreate.length;

  return result;
}

// ── Column mapping ─────────────────────────────────────

interface MappedRow {
  name: string | null;
  email: string | null;
  amount: number | null;
  date: string | null;
  fund: string | null;
  method: string | null;
  checkNumber: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}

/** Maps raw CSV columns to church fields (case-insensitive, tolerant). */
function mapColumns(data: Record<string, string>): MappedRow {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      for (const [col, val] of Object.entries(data)) {
        if (col.toLowerCase().replace(/[_\s-]/g, "") === k.toLowerCase().replace(/[_\s-]/g, "")) {
          return val || null;
        }
      }
    }
    return null;
  };

  const rawAmount = get("amount", "donation", "donationamount", "gift", "giftamount", "total");
  const amount = rawAmount ? parseFloat(rawAmount.replace(/[$,]/g, "")) : null;

  const rawDate = get("date", "donationdate", "giftdate", "transactiondate");
  const date = rawDate ? normalizeDate(rawDate) : null;

  return {
    name: get("name", "donorname", "fullname", "donor", "givenby") ||
          joinNames(get("firstname", "first"), get("lastname", "last")),
    email: get("email", "emailaddress", "donoremail"),
    amount: amount && !isNaN(amount) ? amount : null,
    date,
    fund: get("fund", "fundname", "category", "designation", "purpose"),
    method: get("method", "paymentmethod", "paymenttype", "type"),
    checkNumber: get("checknumber", "checkno", "check"),
    notes: get("notes", "memo", "comment", "description"),
    address: get("address", "streetaddress", "street", "address1"),
    city: get("city"),
    state: get("state", "province"),
    zip: get("zip", "zipcode", "postalcode"),
    phone: get("phone", "phonenumber", "telephone"),
  };
}

function joinNames(first: string | null, last: string | null): string | null {
  if (first && last) return `${first} ${last}`;
  return first || last || null;
}

/** Normalize common date formats to YYYY-MM-DD */
function normalizeDate(raw: string): string | null {
  // Already ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try native parsing as fallback
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}
