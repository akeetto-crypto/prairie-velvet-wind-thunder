import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMigrations } from "./apply-migrations.mjs";

function fakeClient(applied = []) {
  const queries = [];
  const client = {
    async query(text, params = []) {
      queries.push({ text, params });
      if (text === "SELECT name FROM _migrations") {
        return { rows: applied.map((name) => ({ name })) };
      }
      return { rows: [] };
    },
  };
  return { client, queries };
}

test("runtime migration runner serializes and applies only pending SQL atomically", async () => {
  const { client, queries } = fakeClient(["0001_existing.sql"]);
  const count = await applyMigrations(client, {
    "/migrations/0001_existing.sql": "select 'must not rerun'",
    "/migrations/0002_rooms.sql": "create table rooms (code text)",
  });

  assert.equal(count, 1);
  assert.match(queries[1].text, /pg_advisory_xact_lock/);
  assert.ok(queries.some(({ text }) => text === "create table rooms (code text)"));
  assert.deepEqual(
    queries.filter(({ text }) => text.startsWith("INSERT INTO _migrations")),
    [{ text: "INSERT INTO _migrations (name) VALUES ($1)", params: ["0002_rooms.sql"] }],
  );
  assert.equal(queries.at(-1).text, "COMMIT");
});

test("runtime migration runner rolls back and rethrows a migration failure", async () => {
  const queries = [];
  const error = new Error("invalid migration");
  const client = {
    async query(text) {
      queries.push(text);
      if (text === "SELECT name FROM _migrations") return { rows: [] };
      if (text === "broken sql") throw error;
      return { rows: [] };
    },
  };

  await assert.rejects(applyMigrations(client, { "0002_rooms.sql": "broken sql" }), error);
  assert.equal(queries.at(-1), "ROLLBACK");
});

