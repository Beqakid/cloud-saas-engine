/**
 * Repository for the `funds` table.
 */
import type { Fund, CreateFund, UpdateFund } from "@cloud-saas-engine/types";

export class FundRepo {
  async create(db: D1Database, fund: CreateFund): Promise<Fund> {
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO funds (id, tenant_id, name, description, created_at)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(fund.id, fund.tenant_id, fund.name, fund.description ?? null, now)
      .first<Fund>();

    if (!row) throw new Error(`Failed to create fund ${fund.id}`);
    return row;
  }

  async getById(db: D1Database, id: string): Promise<Fund | null> {
    return db.prepare(`SELECT * FROM funds WHERE id = ?`).bind(id).first<Fund>();
  }

  async findByName(db: D1Database, tenantId: string, name: string): Promise<Fund | null> {
    return db
      .prepare(`SELECT * FROM funds WHERE tenant_id = ? AND name = ? LIMIT 1`)
      .bind(tenantId, name)
      .first<Fund>();
  }

  async list(db: D1Database, tenantId: string): Promise<Fund[]> {
    const { results } = await db
      .prepare(`SELECT * FROM funds WHERE tenant_id = ? ORDER BY name ASC`)
      .bind(tenantId)
      .all<Fund>();
    return results;
  }

  async update(db: D1Database, id: string, data: UpdateFund): Promise<void> {
    const sets: string[] = [];
    const binds: unknown[] = [];

    if (data.name !== undefined) { sets.push("name = ?"); binds.push(data.name); }
    if (data.description !== undefined) { sets.push("description = ?"); binds.push(data.description); }

    if (sets.length === 0) return;
    binds.push(id);
    await db.prepare(`UPDATE funds SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  }

  async delete(db: D1Database, id: string): Promise<void> {
    await db.prepare(`DELETE FROM funds WHERE id = ?`).bind(id).run();
  }
}
