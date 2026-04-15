/**
 * Repository for the `donors` table.
 */
import type { Donor, CreateDonor, UpdateDonor } from "@cloud-saas-engine/types";

export class DonorRepo {
  async create(db: D1Database, donor: CreateDonor): Promise<Donor> {
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO donors (id, tenant_id, name, email, address, city, state, zip, phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        donor.id,
        donor.tenant_id,
        donor.name,
        donor.email ?? null,
        donor.address ?? null,
        donor.city ?? null,
        donor.state ?? null,
        donor.zip ?? null,
        donor.phone ?? null,
        now,
        now
      )
      .first<Donor>();

    if (!row) throw new Error(`Failed to create donor ${donor.id}`);
    return row;
  }

  async getById(db: D1Database, id: string): Promise<Donor | null> {
    return db.prepare(`SELECT * FROM donors WHERE id = ?`).bind(id).first<Donor>();
  }

  async findByEmail(db: D1Database, tenantId: string, email: string): Promise<Donor | null> {
    return db
      .prepare(`SELECT * FROM donors WHERE tenant_id = ? AND email = ? LIMIT 1`)
      .bind(tenantId, email)
      .first<Donor>();
  }

  async findByName(db: D1Database, tenantId: string, name: string): Promise<Donor | null> {
    return db
      .prepare(`SELECT * FROM donors WHERE tenant_id = ? AND name = ? LIMIT 1`)
      .bind(tenantId, name)
      .first<Donor>();
  }

  async list(db: D1Database, tenantId: string, limit = 100, offset = 0): Promise<Donor[]> {
    const { results } = await db
      .prepare(`SELECT * FROM donors WHERE tenant_id = ? ORDER BY name ASC LIMIT ? OFFSET ?`)
      .bind(tenantId, limit, offset)
      .all<Donor>();
    return results;
  }

  async update(db: D1Database, id: string, data: UpdateDonor): Promise<void> {
    const sets: string[] = ["updated_at = ?"];
    const binds: unknown[] = [new Date().toISOString()];

    if (data.name !== undefined) { sets.push("name = ?"); binds.push(data.name); }
    if (data.email !== undefined) { sets.push("email = ?"); binds.push(data.email); }
    if (data.address !== undefined) { sets.push("address = ?"); binds.push(data.address); }
    if (data.city !== undefined) { sets.push("city = ?"); binds.push(data.city); }
    if (data.state !== undefined) { sets.push("state = ?"); binds.push(data.state); }
    if (data.zip !== undefined) { sets.push("zip = ?"); binds.push(data.zip); }
    if (data.phone !== undefined) { sets.push("phone = ?"); binds.push(data.phone); }

    binds.push(id);
    await db.prepare(`UPDATE donors SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  }

  async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare(`DELETE FROM donors WHERE id = ?`).bind(id).run();
  }
}
