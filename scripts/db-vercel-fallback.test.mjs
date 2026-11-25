import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Vercel requires DATABASE_URL and never starts the PGlite fallback", () => {
  const script = `
    import assert from "node:assert/strict";
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;
    const { dbSource, getSql } = await import("./src/lib/db.ts");
    assert.equal(dbSource, "pglite");
    await assert.rejects(getSql(), /DATABASE_URL is required on Vercel/);
    assert.equal(globalThis.__pgliteInstance__, undefined);
  `;
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    {
      cwd: projectRoot,
      env: { ...process.env, VERCEL: "1", DATABASE_URL: "" },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
