import { pendingMigrations } from "./migration-plan.mjs";

const MIGRATION_LOCK_ID = 731204095;

/**
 * Apply bundled SQL migrations atomically while serializing concurrent deploys
 * and serverless instances with the same PostgreSQL advisory transaction lock.
 *
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ name: string }> }> }} client
 * @param {Record<string, string>} migrations
 * @param {{ requiredRelations?: Record<string, string[]> }} [options]
 */
export async function applyMigrations(client, migrations, { requiredRelations = {} } = {}) {
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID}::bigint)`);
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (row) => row.name,
    );

    const pending = pendingMigrations(Object.keys(migrations), applied);
    for (const { name, path } of pending) {
      await client.query(migrations[path]);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
    }

    // The ledger can outlive a restored or partially replaced schema. Verify
    // critical relations and replay their idempotent migration when needed.
    for (const [path, relations] of Object.entries(requiredRelations)) {
      if (!migrations[path]) {
        throw new Error(`Required schema migration is missing: ${path}`);
      }
      if (relations.length === 0) continue;
      const checks = relations
        .map((_, index) => "to_regclass($" + (index + 1) + ") IS NOT NULL AS relation_" + index)
        .join(", ");
      const { rows } = await client.query(`SELECT ${checks}`, relations);
      const status = rows[0];
      const complete = relations.every((_, index) => status?.[`relation_${index}`]);
      if (!complete) {
        await client.query(migrations[path]);
        await client.query(
          "INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
          [path.split("/").pop()],
        );
      }
    }

    await client.query("COMMIT");
    return pending.length;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original migration error if the connection has already failed.
    }
    throw error;
  }
}

