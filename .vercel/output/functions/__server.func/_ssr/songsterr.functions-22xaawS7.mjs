import { n as compileSong, o as songsterrUrl } from "./timeline-BdA5J-Hy.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/songsterr.functions-22xaawS7.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
var HOSTS = [
	"dqsljvtekg760",
	"d34shlm8p2ums2",
	"d3cqchs6g3b5ew"
];
var cache = /* @__PURE__ */ new Map();
var TTL = 6e5;
function asRecord(v) {
	return v && typeof v === "object" ? v : null;
}
async function getJson(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent": UA,
			Accept: "application/json,text/plain,*/*",
			"Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
			Referer: "https://www.songsterr.com/",
			Origin: "https://www.songsterr.com",
			"sec-ch-ua": "\"Chromium\";v=\"122\", \"Not(A:Brand\";v=\"24\", \"Google Chrome\";v=\"122\"",
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": "\"Windows\"",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin"
		},
		signal: AbortSignal.timeout(18e3)
	});
	if (!res.ok) throw new Error(`Songsterr ответил ${res.status}`);
	const text = await res.text();
	if (text.startsWith("<!") || text.startsWith("<html")) throw new Error("Songsterr временно закрыл запрос. Попробуйте ещё раз.");
	return JSON.parse(text);
}
async function fetchPart(songId, revisionId, image, partId) {
	const urls = image ? HOSTS.map((h) => `https://${h}.cloudfront.net/${songId}/${revisionId}/${image}/${partId}.json`) : HOSTS.map((h) => `https://${h}.cloudfront.net/part/${revisionId}/${partId}`);
	let last = "недоступен";
	for (const url of urls) try {
		return await getJson(url);
	} catch (err) {
		last = err instanceof Error ? err.message : "ошибка";
	}
	throw new Error(last);
}
function shortName(name, instrument) {
	const head = name.split("|")[0]?.trim();
	if (head && head.length < 42) return head;
	return instrument;
}
async function buildSong(songId) {
	const hit = cache.get(songId);
	if (hit && Date.now() - hit.at < TTL) return hit;
	const meta = asRecord(await getJson(`https://www.songsterr.com/api/meta/${songId}`));
	if (!meta) throw new Error("Пустой ответ Songsterr");
	const revisionId = Number(meta.revisionId);
	const image = typeof meta.image === "string" ? meta.image : "";
	const title = typeof meta.title === "string" ? meta.title : "Без названия";
	const artist = typeof meta.artist === "string" ? meta.artist : "";
	const rawTracks = Array.isArray(meta.tracks) ? meta.tracks : [];
	if (!revisionId || !rawTracks.length) throw new Error("У песни нет партий");
	const parts = await Promise.all(rawTracks.map(async (_track, index) => {
		try {
			return await fetchPart(songId, revisionId, image, index);
		} catch {
			return null;
		}
	}));
	const tracks = [];
	const present = [];
	rawTracks.forEach((raw, index) => {
		const row = asRecord(raw);
		const part = parts[index];
		const instrument = part?.instrument || (typeof row?.instrument === "string" ? row.instrument : "Track");
		const fullName = part?.name || (typeof row?.name === "string" ? row.name : instrument);
		const instrumentId = Number(part?.instrumentId ?? row?.instrumentId ?? 0);
		const vocal = /vocal|voice|lyrics/i.test(`${fullName} ${instrument}`);
		if (part) present.push({
			index,
			part
		});
		tracks.push({
			index,
			name: shortName(fullName, instrument),
			instrument,
			instrumentId,
			vocal,
			strings: part?.strings && part.strings > 0 ? part.strings : 6
		});
	});
	const compiled = compileSong(present.map((item) => item.part), present.map((item) => item.index));
	const views = compiled.views;
	const mix = compiled.mix;
	const durationMs = compiled.durationMs;
	for (const track of tracks) {
		const view = views.get(track.index);
		if (!view) continue;
		track.vocal = view.vocal || track.vocal;
		track.strings = view.strings;
	}
	const guitar = Number(meta.popularTrackGuitar);
	const fallback = Number(meta.defaultTrack);
	let defaultTrack = Number.isFinite(guitar) && views.has(guitar) ? guitar : Number.isFinite(fallback) ? fallback : 0;
	if (!views.has(defaultTrack)) defaultTrack = tracks.find((t) => views.has(t.index) && !t.vocal)?.index ?? tracks[0]?.index ?? 0;
	const entry = {
		at: Date.now(),
		songId,
		revisionId,
		title,
		artist,
		image,
		defaultTrack,
		tracks,
		views,
		mix,
		durationMs
	};
	cache.set(songId, entry);
	return entry;
}
function payload(entry, trackIndex, withMix) {
	const view = entry.views.get(trackIndex) ?? entry.views.get(entry.defaultTrack);
	if (!view) throw new Error("Партия не найдена");
	return {
		songId: entry.songId,
		revisionId: entry.revisionId,
		title: entry.title,
		artist: entry.artist,
		songUrl: songsterrUrl(entry.artist, entry.title, entry.songId),
		durationMs: entry.durationMs,
		defaultTrack: entry.defaultTrack,
		tracks: entry.tracks,
		view,
		mix: withMix ? entry.mix : []
	};
}
function parseSongId(value) {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0 || id > 2e7) throw new Error("Некорректный id песни");
	return id;
}
var searchSongs_createServerFn_handler = createServerRpc({
	id: "e342b614523a38a8b06960b1d9b8e0a64f98efd68c042294bbd5e9c523f42612",
	name: "searchSongs",
	filename: "src/lib/songsterr.functions.ts"
}, (opts) => searchSongs.__executeServer(opts));
var searchSongs = createServerFn({ method: "POST" }).validator((input) => {
	const q = asRecord(input)?.q;
	if (typeof q !== "string") throw new Error("Пустой запрос");
	const query = q.trim().slice(0, 80);
	if (query.length < 2) throw new Error("Введите хотя бы 2 символа");
	return { q: query };
}).handler(searchSongs_createServerFn_handler, async ({ data }) => {
	const url = `https://www.songsterr.com/api/songs?pattern=${encodeURIComponent(data.q)}&size=12`;
	let raw;
	try {
		raw = await getJson(url);
	} catch {
		raw = await getJson(`https://www.songsterr.com/a/ra/songs.json?pattern=${encodeURIComponent(data.q)}`);
	}
	const list = Array.isArray(raw) ? raw : [];
	const hits = [];
	for (const item of list) {
		const row = asRecord(item);
		if (!row || row.isJunk === true) continue;
		const songId = Number(row.songId);
		if (!songId) continue;
		const tracks = Array.isArray(row.tracks) ? row.tracks : [];
		const guitar = Number(row.popularTrackGuitar);
		const def = Number(row.defaultTrack);
		hits.push({
			songId,
			artist: typeof row.artist === "string" ? row.artist : "",
			title: typeof row.title === "string" ? row.title : "Без названия",
			trackCount: tracks.length,
			defaultTrack: Number.isFinite(guitar) ? guitar : Number.isFinite(def) ? def : 0
		});
		if (hits.length >= 10) break;
	}
	return hits;
});
var loadSong_createServerFn_handler = createServerRpc({
	id: "053d48872d6ce0e045fdc2f8a25ce9cd51131ac563aa4aa9daf582c30d8eed50",
	name: "loadSong",
	filename: "src/lib/songsterr.functions.ts"
}, (opts) => loadSong.__executeServer(opts));
var loadSong = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord(input);
	const songId = parseSongId(row?.songId);
	const requested = Number(row?.trackIndex);
	return {
		songId,
		trackIndex: Number.isInteger(requested) && requested >= 0 && requested < 64 ? requested : -1,
		withMix: row?.withMix !== false
	};
}).handler(loadSong_createServerFn_handler, async ({ data }) => {
	const entry = await buildSong(data.songId);
	return payload(entry, data.trackIndex >= 0 && entry.views.has(data.trackIndex) ? data.trackIndex : entry.defaultTrack, data.withMix);
});
//#endregion
export { loadSong_createServerFn_handler, searchSongs_createServerFn_handler };
