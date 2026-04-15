/**
 * Repository for the `donations` table.
 */
import type { Donation, CreateDonation, UpdateDonation } from "@cloud-saas-engine/types";

export class DonationRepo {
  async create(db: D1Database, donation: CreateDonation): Promise<Donation> {
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO donations (id, tenant_id, donor_id, fund_id, amount, date, method, check_number, notes, import_row_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        donation.id,
        donation.tenant_id,
        donation.donor_id,
        donation.fund_id ?? null,
        donation.amount,
        donation.date,
        donation.method ?? null,
        donation.check_number ?? null,
        donation.notes ?? null,
        donation.import_row_id ?? null,
        now
      )
      .first<Donation>();

    if (!row) throw new Error(`Failed to create donation ${donation.id}`);
    return row;
  }

  async batchCreate(db: D1Database, donations: CreateDonation[]): Promise<void> {
    if (donations.length === 0) return;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO donations (id, tenant_id, donor_id, fund_id, amount, date, method, check_number, notes, import_row_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const batch = donations.map((d) =>
      stmt.bind(
        d.id, d.tenant_id, d.donor_id, d.fund_id ?? null,
        d.amount, d.date, d.method ?? null, d.check_number ?? null,
        d.notes ?? null, d.import_row_id ?? null, now
      )
    );
    await db.batch(batch);
  }

  async getById(db: D1Database, id: string): Promise<Donation | null> {
    return db.prepare(`SELECT * FROM donations WHERE id = ?`).bind(id).first<Donation>();
  }

  async list(db: D1Database, tenantId: string, limit = 100, offset = 0): Promise<Donation[]> {
    const { results } = await db
      .prepare(`SELECT * FROM donations WHERE tenant_id = ? ORDER BY date DESC LIMIT ? OFFSET ?`)
      .bind(tenantId, limit, offset)
      .all<Donation>();
    return results;
  }

  async listByDonor(db: D1Database, donorId: string, limit = 100, offset = 0): Promise<Donation[]> {
    const { results } = await db
      .prepare(`SELECT * FROM donations WHERE donor_id = ? ORDER BY date DESC LIMIT ? OFFSET ?`)
      .bind(donorId, limit, offset)
      .all<Donation>();
    return results;
  }

  async listByFund(db: D1Database, fundId: string, limit = 100, offset = 0): Promise<Donation[]> {
    const { results } = await db
      .prepare(`SELECT * FROM donations WHERE fund_id = ? ORDER BY date DESC LIMIT ? OFFSET ?`)
      .bind(fundId, limit, offset)
      .all<Donation>();
    return results;
  }

  async listByDateRange(
    db: D1Database,
    tenantId: string,
    from: string,
    to: string,
    limit = 100,
    offset = 0
  ): Promise<Donation[]> {
    const { results } = await db
      .prepare(
        `SELECT * FROM donations WHERE tenant_id = ? AND date >= ? AND date <= ? ORDER BY date DESC LIMIT ? OFFSET ?`
      )
      .bind(tenantId, from, to, limit, offset)
      .all<Donation>();
    return results;
  }

  async update(db: D1Database, id: string, data: UpdateDonation): Promise<void> {
    const sets: string[] = [];
    const binds: unknown[] = [];

    if (data.donor_id !== undefined) { sets.push("donor_id = ?"); binds.push(data.donor_id); }
    if (data.fund_id !== undefined) { sets.push("fund_id = ?"); binds.push(data.fund_id); }
    if (data.amount !== undefined) { sets.push("amount = ?"); binds.push(data.amount); }
    if (data.date !== undefined) { sets.push("date = ?"); binds.push(data.date); }
    if (data.method !== undefined) { sets.push("method = ?"); binds.push(data.method); }
    if (data.check_number !== undefined) { sets.push("check_number = ?"); binds.push(data.check_number); }
    if (data.notes !== undefined) { sets.push("notes = ?"); binds.push(data.notes); }

    if (sets.length === 0) return;
    binds.push(id);
    await db.prepare(`UPDATE donations SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  }

  async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare(`DELETE FROM donations WHERE id = ?`).bind(id).run();
  }

  async sumByDonor(
    db: D1Database,
    tenantId: string,
    from: string,
    to: string
  ): Promise<{ donor_id: string; total: number }[]> {
    const { results } = await db
      .prepare(
        `SELECT donor_id, SUM(amount) as total FROM donations
         WHERE tenant_id = ? AND date >= ? AND date <= ?
         GROUP BY donor_id ORDER BY total DESC`
      )
      .bind(tenantId, from, to)
      .all<{ donor_id: string; total: number }>();
    return results;
  }
}
