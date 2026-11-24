import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/songsterr.functions-4a7kZvaQ.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function asRecord$1(v) {
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
var createRoom = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord$1(input);
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
}).handler(createSsrRpc("e7bddbdbaf628b8a083e544dc7a0cba79f459eb99f93035405f151125b56da2e"));
var pollRoom = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord$1(input);
	return {
		code: cleanCode(row?.code),
		peer: cleanPeer(row?.peer)
	};
}).handler(createSsrRpc("48bdcc7f2eec30dbb490c6439f13cfb5e608aab90450ff4cc61d20240bd63405"));
var pushTransport = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord$1(input);
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
}).handler(createSsrRpc("2d4b16729e236cd7ccf4964d271907187f29692d1ae9ca6a0468abfac0c14ad4"));
function extractSongId(input) {
	const text = input.trim();
	if (/^\d{1,9}$/.test(text)) return Number(text);
	const marked = text.match(/-s(\d+)\b/);
	if (marked) return Number(marked[1]);
	try {
		const url = new URL(text);
		const q = url.searchParams.get("songId") ?? url.searchParams.get("id");
		if (q && /^\d+$/.test(q)) return Number(q);
	} catch {}
	return null;
}
function asRecord(v) {
	return v && typeof v === "object" ? v : null;
}
function parseSongId(value) {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0 || id > 2e7) throw new Error("Некорректный id песни");
	return id;
}
var searchSongs = createServerFn({ method: "POST" }).validator((input) => {
	const q = asRecord(input)?.q;
	if (typeof q !== "string") throw new Error("Пустой запрос");
	const query = q.trim().slice(0, 80);
	if (query.length < 2) throw new Error("Введите хотя бы 2 символа");
	return { q: query };
}).handler(createSsrRpc("e342b614523a38a8b06960b1d9b8e0a64f98efd68c042294bbd5e9c523f42612"));
var loadSong = createServerFn({ method: "POST" }).validator((input) => {
	const row = asRecord(input);
	const songId = parseSongId(row?.songId);
	const requested = Number(row?.trackIndex);
	return {
		songId,
		trackIndex: Number.isInteger(requested) && requested >= 0 && requested < 64 ? requested : -1,
		withMix: row?.withMix !== false
	};
}).handler(createSsrRpc("053d48872d6ce0e045fdc2f8a25ce9cd51131ac563aa4aa9daf582c30d8eed50"));
//#endregion
export { pushTransport as a, pollRoom as i, extractSongId as n, searchSongs as o, loadSong as r, createRoom as t };
