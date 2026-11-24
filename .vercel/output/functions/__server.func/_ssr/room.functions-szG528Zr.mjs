import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/room.functions-szG528Zr.js
var _0002_rooms_default = "create table if not exists rooms (\n  code         text primary key,\n  song_id      integer not null,\n  track_index  integer not null default 0,\n  title        text not null default '',\n  artist       text not null default '',\n  playing      boolean not null default false,\n  position_ms  double precision not null default 0,\n  anchor_ms    bigint not null default 0,\n  speed        double precision not null default 1,\n  seq          bigint not null default 1,\n  created_at   timestamptz not null default now(),\n  updated_at   timestamptz not null default now()\n);\n\ncreate table if not exists room_presence (\n  room_code  text not null references rooms (code) on delete cascade,\n  peer_id    text not null,\n  last_seen  timestamptz not null default now(),\n  primary key (room_code, peer_id)\n);\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
/**
* Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
* sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
* the app has a working database even with nothing configured — the live preview
* included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
*/
var dbSource = databaseUrl ? "neon" : "pglite";
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({ "/migrations/0002_rooms.sql": _0002_rooms_default });
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function asRecord(v) {
	return v && typeof v === "object" ? v : null;
}
function cleanCode(value) {
	if (typeof value !== "string") throw new Error("Нет кода комнаты");
	const code = value.trim().toUpperCase();
	if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error("Код — 5 символов");
	return code;
}
function cleanPeer(value) {
	if (typeof value !== "string") return "";
	const peer = value.trim();
	if (!/^[a-zA-Z0-9-]{8,48}$/.test(peer)) return "";
	return peer;
}
function clampSpeed(speed) {
	if (!Number.isFinite(speed)) return 1;
	return Math.min(1.25, Math.max(.5, Math.round(speed * 100) / 100));
}
function mapRoom(row, listeners) {
	return {
		code: row.code,
		songId: Number(row.song_id),
		trackIndex: Number(row.track_index),
		title: row.title ?? "",
		artist: row.artist ?? "",
		playing: Boolean(row.playing),
		positionMs: Number(row.position_ms) || 0,
		anchorMs: Number(row.anchor_ms) || 0,
		speed: Number(row.speed) || 1,
		seq: Number(row.seq) || 0,
		listeners
	};
}
async function listenersOf(code, peer) {
	const sql = await getSql();
	if (peer) await sql`
      insert into room_presence (room_code, peer_id, last_seen)
      values (${code}, ${peer}, now())
      on conflict (room_code, peer_id)
      do update set last_seen = now()
    `;
	await sql`delete from room_presence where room_code = ${code} and last_seen < now() - interval '15 seconds'`;
	const rows = await sql`
    select count(*)::int as n
    from room_presence
    where room_code = ${code} and last_seen > now() - interval '15 seconds'
  `;
	return Number(rows[0]?.n ?? 0);
}
async function readRoom(code, peer) {
	const rows = await (await getSql())`select code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq from rooms where code = ${code}`;
	const serverNow = Date.now();
	if (!rows[0]) return {
		serverNow,
		room: null
	};
	const listeners = await listenersOf(code, peer);
	return {
		serverNow,
		room: mapRoom(rows[0], listeners)
	};
}
function newCode() {
	const bytes = /* @__PURE__ */ new Uint8Array(5);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) out += ALPHABET[b % 32];
	return out;
}
var createRoom_createServerFn_handler = createServerRpc({
	id: "e7bddbdbaf628b8a083e544dc7a0cba79f459eb99f93035405f151125b56da2e",
	name: "createRoom",
	filename: "src/lib/room.functions.ts"
}, (opts) => createRoom.__executeServer(opts));
var createRoom = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord(input);
	const songId = Number(row?.songId);
	if (!Number.isInteger(songId) || songId <= 0) throw new Error("Не выбрана песня");
	const trackIndex = Number(row?.trackIndex);
	const title = typeof row?.title === "string" ? row.title.trim().slice(0, 140) : "";
	const artist = typeof row?.artist === "string" ? row.artist.trim().slice(0, 140) : "";
	return {
		songId,
		trackIndex: Number.isInteger(trackIndex) && trackIndex >= 0 ? trackIndex : 0,
		title,
		artist
	};
}).handler(createRoom_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const now = Date.now();
	for (let attempt = 0; attempt < 6; attempt++) {
		const rows = await sql`
        insert into rooms (code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq)
        values (${newCode()}, ${data.songId}, ${data.trackIndex}, ${data.title}, ${data.artist}, false, 0, ${now}, 1, 1)
        on conflict (code) do nothing
        returning code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq
      `;
		if (rows[0]) return {
			serverNow: Date.now(),
			room: mapRoom(rows[0], 0)
		};
	}
	throw new Error("Не удалось создать комнату");
});
var pollRoom_createServerFn_handler = createServerRpc({
	id: "48bdcc7f2eec30dbb490c6439f13cfb5e608aab90450ff4cc61d20240bd63405",
	name: "pollRoom",
	filename: "src/lib/room.functions.ts"
}, (opts) => pollRoom.__executeServer(opts));
var pollRoom = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord(input);
	return {
		code: cleanCode(row?.code),
		peer: cleanPeer(row?.peer)
	};
}).handler(pollRoom_createServerFn_handler, async ({ data }) => readRoom(data.code, data.peer));
var pushTransport_createServerFn_handler = createServerRpc({
	id: "2d4b16729e236cd7ccf4964d271907187f29692d1ae9ca6a0468abfac0c14ad4",
	name: "pushTransport",
	filename: "src/lib/room.functions.ts"
}, (opts) => pushTransport.__executeServer(opts));
var pushTransport = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord(input);
	const songId = Number(row?.songId);
	const trackIndex = Number(row?.trackIndex);
	const positionMs = Number(row?.positionMs);
	const speed = clampSpeed(Number(row?.speed));
	if (!Number.isInteger(songId) || songId <= 0) throw new Error("Не выбрана песня");
	if (!Number.isFinite(positionMs) || positionMs < 0 || positionMs > 108e5) throw new Error("Некорректная позиция");
	const title = typeof row?.title === "string" ? row.title.trim().slice(0, 140) : "";
	const artist = typeof row?.artist === "string" ? row.artist.trim().slice(0, 140) : "";
	return {
		code: cleanCode(row?.code),
		peer: cleanPeer(row?.peer),
		songId,
		trackIndex: Number.isInteger(trackIndex) && trackIndex >= 0 && trackIndex < 64 ? trackIndex : 0,
		playing: row?.playing === true,
		positionMs,
		speed,
		title,
		artist
	};
}).handler(pushTransport_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const now = Date.now();
	const rows = await sql`
      update rooms set
        song_id = ${data.songId},
        track_index = ${data.trackIndex},
        title = ${data.title},
        artist = ${data.artist},
        playing = ${data.playing},
        position_ms = ${data.positionMs},
        anchor_ms = ${now},
        speed = ${data.speed},
        seq = seq + 1,
        updated_at = now()
      where code = ${data.code}
      returning code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq
    `;
	if (!rows[0]) return {
		serverNow: Date.now(),
		room: null
	};
	const listeners = await listenersOf(data.code, data.peer);
	return {
		serverNow: Date.now(),
		room: mapRoom(rows[0], listeners)
	};
});
//#endregion
export { createRoom_createServerFn_handler, pollRoom_createServerFn_handler, pushTransport_createServerFn_handler };
