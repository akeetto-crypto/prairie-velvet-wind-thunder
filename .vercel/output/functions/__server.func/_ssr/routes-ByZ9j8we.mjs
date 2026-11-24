import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, Y as require_react, b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as Music, s as LoaderCircle, t as Users } from "../_libs/lucide-react.mjs";
import { n as extractSongId, o as searchSongs, t as createRoom } from "./songsterr.functions-4a7kZvaQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ByZ9j8we.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FEATURED = [
	{
		songId: 27,
		artist: "Led Zeppelin",
		title: "Stairway to Heaven",
		trackCount: 11,
		defaultTrack: 1
	},
	{
		songId: 19,
		artist: "Metallica",
		title: "Enter Sandman",
		trackCount: 9,
		defaultTrack: 2
	},
	{
		songId: 269,
		artist: "Nirvana",
		title: "Smells Like Teen Spirit",
		trackCount: 8,
		defaultTrack: 3
	},
	{
		songId: 1024,
		artist: "AC/DC",
		title: "Back In Black",
		trackCount: 6,
		defaultTrack: 2
	}
];
function messageOf(err) {
	if (err instanceof Error && err.message) return err.message;
	return "Не вышло";
}
function Lobby() {
	const navigate = useNavigate();
	const [query, setQuery] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [searching, setSearching] = (0, import_react.useState)(false);
	const [searchError, setSearchError] = (0, import_react.useState)("");
	const [code, setCode] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		const q = query.trim();
		if (extractSongId(q) || q.length < 2) {
			setHits([]);
			setSearchError("");
			return;
		}
		const handle = window.setTimeout(() => {
			setSearching(true);
			searchSongs({ data: { q } }).then((rows) => {
				setHits(rows);
				setSearchError("");
			}).catch((err) => setSearchError(messageOf(err))).finally(() => setSearching(false));
		}, 280);
		return () => window.clearTimeout(handle);
	}, [query]);
	function openSolo(hit) {
		navigate({
			to: "/s/$songId",
			params: { songId: String(hit.songId) },
			search: { track: hit.defaultTrack }
		});
	}
	async function openRoom(hit) {
		setBusy(`room-${hit.songId}`);
		setError("");
		try {
			const res = await createRoom({ data: {
				songId: hit.songId,
				trackIndex: hit.defaultTrack,
				title: hit.title,
				artist: hit.artist
			} });
			if (!res.room) throw new Error("Комната не создалась");
			await navigate({
				to: "/r/$code",
				params: { code: res.room.code }
			});
		} catch (err) {
			setError(messageOf(err));
		} finally {
			setBusy(null);
		}
	}
	function openPasted() {
		const id = extractSongId(query);
		if (!id) return;
		navigate({
			to: "/s/$songId",
			params: { songId: String(id) },
			search: { track: -1 }
		});
	}
	function join() {
		const next = code.trim().toUpperCase();
		if (!/^[A-Z0-9]{5}$/.test(next)) {
			setError("Код комнаты — 5 символов, без пробелов.");
			return;
		}
		navigate({
			to: "/r/$code",
			params: { code: next }
		});
	}
	const list = hits.length ? hits : query.trim().length < 2 ? FEATURED : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-6 md:py-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "max-w-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Music, { className: "size-4" }), "Songsterr · вместе"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 font-serif text-4xl font-semibold leading-tight text-fg md:text-6xl",
					children: "В такт"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-xl text-lg leading-relaxed text-muted",
					children: "Одна комната на телефон, ноутбук и репетицию. Play, пауза, перемотка и скорость считаются от общих часов — таб Songsterr стартует в одном месте."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-8 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-line bg-surface p-4 md:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "song-query",
						className: "text-sm font-medium text-fg",
						children: "Песня или ссылка с songsterr.com"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "song-query",
						value: query,
						onChange: (event) => setQuery(event.target.value),
						placeholder: "metallica sandman",
						className: "mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 text-base text-fg outline-none"
					}),
					extractSongId(query) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: openPasted,
						className: "mt-3 inline-flex h-11 items-center rounded-full bg-accent px-4 font-semibold text-accent-ink",
						children: "Открыть эту ссылку"
					}) : null,
					searching ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 inline-flex items-center gap-2 text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Ищем на Songsterr"]
					}) : null,
					searchError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-ember",
						children: searchError
					}) : null,
					query.trim().length < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-xs uppercase tracking-widest text-muted",
						children: "С чего начать"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-line",
						children: list.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate font-semibold text-fg",
									children: hit.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "truncate text-sm text-muted",
									children: [hit.artist, hit.trackCount ? ` · ${hit.trackCount} партий` : ""]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex shrink-0 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => openSolo(hit),
									className: "h-11 rounded-full border border-line px-4 text-sm font-semibold",
									children: "Слушать"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busy === `room-${hit.songId}`,
									onClick: () => void openRoom(hit),
									className: "h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50",
									children: busy === `room-${hit.songId}` ? "Создаём…" : "В комнату"
								})]
							})]
						}, hit.songId))
					}),
					!searching && query.trim().length >= 2 && !extractSongId(query) && hits.length === 0 && !searchError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Ничего не нашлось. Попробуйте имя артиста."
					}) : null
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-line bg-paper p-4 text-ink md:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-ink-soft",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" }), "Войти в комнату"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-3 font-serif text-3xl leading-tight",
						children: "Код с другого экрана"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-ink-soft",
						children: "На каждом устройстве откройте «В такт», введите пять символов и нажмите play. Дальше плеер держит общий такт сам."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: code,
						onChange: (event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)),
						placeholder: "K7QMP",
						"aria-label": "Код комнаты",
						className: "mt-4 h-14 w-full rounded-xl border border-staff bg-paper px-3 text-center font-mono text-2xl tracking-[0.28em] text-ink outline-none"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: join,
						className: "mt-3 h-12 w-full rounded-full bg-ink text-sm font-semibold text-paper",
						children: "Присоединиться"
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-ember",
						children: error
					}) : null
				]
			})]
		})]
	});
}
var SplitComponent = Lobby;
//#endregion
export { SplitComponent as component };
