import { pendingMigrations } from "./migration-plan.mjs";

const MIGRATION_LOCK_ID = 731204095;

/**
 * Apply bundled SQL migrations atomically while serializing concurrent deploys
 * and serverless instances with the same PostgreSQL advisory transaction lock.
 *
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ name: string }> }> }} client
 * @param {Record<string, string>} migrations
 */
export async function applyMigrations(client, migrations) {
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

