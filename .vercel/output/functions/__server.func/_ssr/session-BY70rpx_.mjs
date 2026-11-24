import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, Y as require_react, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Pause, c as ExternalLink, i as Play, l as Copy, r as Search, s as LoaderCircle, t as Users, u as Check } from "../_libs/lucide-react.mjs";
import { a as formatTime, i as drumLaneLabel, r as drumGlyph, s as tabStringLabel, t as barAt } from "./timeline-BdA5J-Hy.mjs";
import { a as pushTransport, i as pollRoom, n as extractSongId, o as searchSongs, r as loadSong } from "./songsterr.functions-4a7kZvaQ.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-BY70rpx_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var BG = "#1a1b1e";
var GUTTER_BG = "#141518";
var LINE = "#3c4048";
var BAR = "#9aa1ab";
var FRET = "#f3f4f6";
var FRET_DIM = "#8d939c";
var ACTIVE = "#ffb020";
var CHORD = "#f7f7f8";
var MARKER = "#8eb7ff";
var NUM = "#8b919a";
var CURSOR = "#ff9a1f";
var GUTTER = 54;
function layoutAt(view, pos, width, height) {
	const strings = view.kind === 2 ? 6 : Math.max(4, view.strings);
	const header = 56;
	const usable = Math.max(strings * 16, height - header - 20);
	const gap = Math.max(16, Math.min(44, usable / Math.max(1, strings - 1)));
	const staffH = (strings - 1) * gap;
	const top = header + Math.max(0, (usable - staffH) / 2);
	const bar = barAt(view.bars, pos) ?? view.bars[0];
	const barPx = Math.min(560, Math.max(200, width * .34));
	return {
		strings,
		gap,
		top,
		staffH,
		pxPerMs: bar && bar.d > 0 ? barPx / bar.d : .08,
		playX: Math.max(82, Math.min(width * .2, 220)),
		bottom: top + staffH
	};
}
var TabStage = (0, import_react.memo)(function TabStage({ view, getPosition, onSeek }) {
	const canvasRef = (0, import_react.useRef)(null);
	const viewRef = (0, import_react.useRef)(view);
	viewRef.current = view;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let frame = 0;
		const paint = () => {
			const current = viewRef.current;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const rect = canvas.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const w = Math.max(1, rect.width);
			const h = Math.max(1, rect.height);
			if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
				canvas.width = Math.floor(w * dpr);
				canvas.height = Math.floor(h * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = BG;
			ctx.fillRect(0, 0, w, h);
			if (!current) {
				ctx.fillStyle = NUM;
				ctx.font = "500 15px Manrope, sans-serif";
				ctx.fillText("Таб появится здесь", 24, h / 2);
				frame = requestAnimationFrame(paint);
				return;
			}
			const pos = getPosition.current();
			const { strings, gap, top, pxPerMs, playX, bottom } = layoutAt(current, pos, w, h);
			const fretPx = Math.round(Math.min(20, Math.max(13, gap * .46)));
			const yOf = (s) => top + s * gap;
			const t0 = pos - playX / pxPerMs;
			const t1 = pos + (w - playX) / pxPerMs;
			const here = barAt(current.bars, pos);
			ctx.save();
			ctx.beginPath();
			ctx.rect(GUTTER, 0, w - GUTTER, h);
			ctx.clip();
			for (const bar of current.bars) {
				if (bar.t + bar.d < t0 || bar.t > t1) continue;
				const x = playX + (bar.t - pos) * pxPerMs;
				const x2 = playX + (bar.t + bar.d - pos) * pxPerMs;
				if (here && bar.i === here.i) {
					ctx.fillStyle = "rgba(255, 176, 32, 0.07)";
					ctx.fillRect(x, top - 18, Math.max(1, x2 - x), bottom - top + 28);
				}
				ctx.strokeStyle = BAR;
				ctx.globalAlpha = .55;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(x, top - 8);
				ctx.lineTo(x, bottom + 8);
				ctx.stroke();
				ctx.globalAlpha = 1;
				ctx.fillStyle = NUM;
				ctx.font = "600 12px Manrope, sans-serif";
				ctx.textAlign = "left";
				ctx.textBaseline = "alphabetic";
				if (x2 - x > 18) ctx.fillText(String(bar.i), x + 8, top - 34);
				if (bar.marker && x2 - x > 36) {
					ctx.fillStyle = MARKER;
					ctx.font = "700 13px Manrope, sans-serif";
					ctx.fillText(bar.marker, x + 8, top - 50);
				}
				const [beats, den] = bar.sig.split("/").map(Number);
				const pulse = bar.d / (beats || 4);
				ctx.fillStyle = "#5c6370";
				for (let p = 0; p < (beats || 4); p++) {
					if (den === 8 && p % 3 !== 0) continue;
					const bx = x + p * pulse * pxPerMs;
					if (bx < GUTTER || bx > w) continue;
					ctx.beginPath();
					ctx.arc(bx, bottom + 16, p === 0 ? 2.2 : 1.5, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			ctx.strokeStyle = LINE;
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let s = 0; s < strings; s++) {
				const y = yOf(s);
				ctx.moveTo(GUTTER, y);
				ctx.lineTo(w, y);
			}
			ctx.stroke();
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			for (const ev of current.events) {
				if (ev.t + ev.d < t0 - 40 || ev.t > t1 + 20) continue;
				const x = playX + (ev.t - pos) * pxPerMs;
				const hot = ev.t <= pos + 30 && pos < ev.t + Math.max(ev.d, 70);
				if (ev.chord) {
					ctx.fillStyle = hot ? ACTIVE : CHORD;
					ctx.font = "700 14px Manrope, sans-serif";
					ctx.fillText(ev.chord, x, top - 16);
				}
				ctx.font = `${hot ? 700 : 600} ${fretPx}px Manrope, sans-serif`;
				for (const note of ev.notes) {
					if (note.s < 0 || note.s > strings - 1) continue;
					const y = yOf(note.s);
					const glyph = current.kind === 2 ? drumGlyph(note.m) : note.ghost ? `(${note.f})` : String(note.f);
					const width = ctx.measureText(glyph).width;
					const plate = Math.max(16, fretPx);
					ctx.fillStyle = BG;
					ctx.fillRect(x - width / 2 - 4, y - plate / 2, width + 8, plate);
					ctx.fillStyle = note.tie ? FRET_DIM : hot ? ACTIVE : FRET;
					ctx.fillText(glyph, x, y + .5);
					if (note.art && !note.tie) {
						ctx.fillStyle = hot ? ACTIVE : MARKER;
						ctx.font = "700 11px Manrope, sans-serif";
						ctx.textAlign = "left";
						ctx.fillText(note.art === "h" ? "h" : note.art, x + width / 2 + 3, y - 8);
						ctx.textAlign = "center";
						ctx.font = `${hot ? 700 : 600} ${fretPx}px Manrope, sans-serif`;
					}
				}
			}
			ctx.restore();
			ctx.fillStyle = GUTTER_BG;
			ctx.fillRect(0, 0, GUTTER, h);
			ctx.strokeStyle = "#2a2d33";
			ctx.beginPath();
			ctx.moveTo(53.5, 0);
			ctx.lineTo(53.5, h);
			ctx.stroke();
			ctx.strokeStyle = LINE;
			ctx.beginPath();
			for (let s = 0; s < strings; s++) {
				const y = yOf(s);
				ctx.moveTo(10, y);
				ctx.lineTo(46, y);
			}
			ctx.stroke();
			ctx.fillStyle = "#c6cbd3";
			ctx.font = "700 12px Manrope, sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			if (current.kind === 2) for (let s = 0; s < strings; s++) ctx.fillText(drumLaneLabel(s), 28, yOf(s));
			else if (current.tuning) current.tuning.forEach((midi, i) => {
				if (i < strings) ctx.fillText(tabStringLabel(midi), 28, yOf(i));
			});
			ctx.strokeStyle = CURSOR;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(playX, top - 22);
			ctx.lineTo(playX, bottom + 10);
			ctx.stroke();
			ctx.fillStyle = CURSOR;
			ctx.beginPath();
			ctx.moveTo(playX - 6, top - 22);
			ctx.lineTo(playX + 6, top - 22);
			ctx.lineTo(playX, top - 12);
			ctx.closePath();
			ctx.fill();
			frame = requestAnimationFrame(paint);
		};
		frame = requestAnimationFrame(paint);
		return () => cancelAnimationFrame(frame);
	}, [getPosition]);
	const seekFrom = (clientX, commit) => {
		const canvas = canvasRef.current;
		const current = viewRef.current;
		if (!canvas || !current) return;
		const rect = canvas.getBoundingClientRect();
		const x = clientX - rect.left;
		const pos = getPosition.current();
		const { pxPerMs, playX } = layoutAt(current, pos, rect.width, rect.height);
		const ms = pos + (x - playX) / pxPerMs;
		onSeek.current(Math.max(0, Math.min(current.durationMs, ms)), commit);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "h-full w-full touch-none bg-[#1a1b1e]",
		"aria-label": "Табулатура",
		onPointerDown: (event) => {
			event.currentTarget.setPointerCapture(event.pointerId);
			seekFrom(event.clientX, false);
		},
		onPointerMove: (event) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFrom(event.clientX, false);
		},
		onPointerUp: (event) => seekFrom(event.clientX, true),
		onPointerCancel: (event) => seekFrom(event.clientX, true)
	});
});
function useBarLabel(view, ms) {
	const bar = view ? barAt(view.bars, ms) : null;
	if (!bar) return "";
	return bar.marker ? `Такт ${bar.i} · ${bar.marker}` : `Такт ${bar.i}`;
}
var LOOKAHEAD_MS = 200;
var MAX_VOICES = 72;
/**
* One clock for every track. Notes are scheduled from the same AudioContext
* origin, so guitar, bass and drums cannot drift apart once their times match.
*/
var BandEngine = class {
	ctx = null;
	master = null;
	pcm = /* @__PURE__ */ new Map();
	buffers = /* @__PURE__ */ new Map();
	notes = [];
	focus = 0;
	vocal = /* @__PURE__ */ new Set();
	playing = false;
	speed = 1;
	originAudio = 0;
	originSong = 0;
	pausedAt = 0;
	scheduledUntil = 0;
	cursor = 0;
	live = [];
	strings = /* @__PURE__ */ new Map();
	openHat = null;
	timer = 0;
	epoch = 0;
	get suspended() {
		return !this.ctx || this.ctx.state !== "running";
	}
	load(notes, focus, vocalTracks) {
		this.notes = notes;
		this.focus = focus;
		this.vocal = new Set(vocalTracks);
		this.cursor = 0;
		this.scheduledUntil = 0;
		this.silence();
		if (this.ctx) this.warm(notes);
	}
	setFocus(track) {
		this.focus = track;
	}
	async unlock() {
		const ctx = this.ensure();
		if (ctx.state !== "running") await ctx.resume();
		this.warm(this.notes);
	}
	position() {
		if (!this.playing || !this.ctx) return this.pausedAt;
		return this.originSong + (this.ctx.currentTime - this.originAudio) * 1e3 * this.speed;
	}
	play(fromMs) {
		const ctx = this.ensure();
		ctx.resume();
		this.warm(this.notes);
		this.silence();
		this.playing = true;
		this.originSong = Math.max(0, fromMs);
		this.originAudio = ctx.currentTime + .04;
		this.scheduledUntil = this.originSong;
		this.cursor = this.seekIndex(this.originSong);
		this.pausedAt = this.originSong;
		this.kick();
	}
	pause() {
		const pos = this.playing ? this.position() : this.pausedAt;
		this.playing = false;
		this.pausedAt = Math.max(0, pos);
		this.silence();
		return this.pausedAt;
	}
	seek(ms) {
		const was = this.playing;
		const clamped = Math.max(0, ms);
		if (was) this.play(clamped);
		else {
			this.pausedAt = clamped;
			this.silence();
		}
	}
	setSpeed(speed, atMs) {
		const pos = atMs ?? this.position();
		this.speed = clampSpeed(speed);
		if (this.playing) this.play(pos);
		else this.pausedAt = pos;
	}
	correct(desiredMs) {
		const err = desiredMs - this.position();
		const abs = Math.abs(err);
		if (abs < 45) return "ok";
		if (abs < 120 && this.playing && this.ctx) {
			const now = this.ctx.currentTime;
			this.originSong = desiredMs - (now - this.originAudio) * 1e3 * this.speed;
			if (desiredMs + 20 < this.scheduledUntil) this.scheduledUntil = this.position();
			return "nudge";
		}
		this.seek(desiredMs);
		return "seek";
	}
	destroy() {
		this.silence();
		window.clearInterval(this.timer);
		this.ctx?.close();
		this.ctx = null;
		this.master = null;
		this.buffers.clear();
	}
	ensure() {
		if (this.ctx && this.master) return this.ctx;
		const ctx = new AudioContext();
		const master = ctx.createGain();
		master.gain.value = .82;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.knee.value = 16;
		comp.ratio.value = 2.6;
		comp.attack.value = .006;
		comp.release.value = .2;
		master.connect(comp);
		comp.connect(ctx.destination);
		this.ctx = ctx;
		this.master = master;
		return ctx;
	}
	warm(notes) {
		const ctx = this.ctx;
		if (!ctx) return;
		const want = /* @__PURE__ */ new Set();
		for (const note of notes) {
			const key = bufferKey(note);
			if (key) want.add(key);
		}
		for (const key of want) this.buffer(ctx, key);
	}
	kick() {
		window.clearInterval(this.timer);
		this.timer = window.setInterval(() => this.tick(), 24);
		this.tick();
	}
	seekIndex(ms) {
		let lo = 0;
		let hi = this.notes.length;
		while (lo < hi) {
			const mid = lo + hi >> 1;
			if (this.notes[mid].t < ms) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}
	tick() {
		if (!this.playing || !this.ctx || !this.master) return;
		const epoch = this.epoch;
		const nowSong = this.position();
		const horizon = nowSong + LOOKAHEAD_MS;
		if (this.cursor > 0 && this.notes[this.cursor - 1] && this.notes[this.cursor - 1].t > nowSong + 50) this.cursor = this.seekIndex(nowSong);
		if (this.scheduledUntil > horizon + 40) return;
		const from = Math.max(this.scheduledUntil - 8, nowSong - 20);
		while (this.cursor < this.notes.length && this.notes[this.cursor].t < horizon) {
			const note = this.notes[this.cursor++];
			if (epoch !== this.epoch) return;
			if (note.t < from) continue;
			this.schedule(note);
		}
		this.scheduledUntil = horizon;
		this.gc();
	}
	gainFor(note) {
		const vel = note.v ?? .9;
		if (this.vocal.has(note.track)) return 0;
		if (note.z === 2) return (note.track === this.focus ? .22 : .12) * vel;
		if (note.track === this.focus) {
			if (note.k === 2) return .42 * vel;
			if (note.k === 1) return .34 * vel;
			if (note.z === 1) return .26 * vel;
			return .22 * vel;
		}
		if (note.k === 2) return .3 * vel;
		if (note.k === 1) return .2 * vel;
		if (note.z === 1) return .12 * vel;
		return .09 * vel;
	}
	schedule(note) {
		const ctx = this.ctx;
		const master = this.master;
		if (!ctx || !master) return;
		const peak = this.gainFor(note);
		if (peak <= .001) return;
		const key = bufferKey(note);
		if (!key) return;
		const audio = this.buffer(ctx, key);
		if (!audio) return;
		const when = this.originAudio + (note.t - this.originSong) / (1e3 * this.speed);
		if (when < ctx.currentTime - .06) return;
		const start = Math.max(when, ctx.currentTime + .005);
		const dur = Math.max(.045, Math.min(3.1, note.d / 1e3 / this.speed));
		if (this.live.length > MAX_VOICES) this.gc();
		if (this.live.length > MAX_VOICES && note.track !== this.focus && note.k !== 2) return;
		const src = ctx.createBufferSource();
		src.buffer = audio;
		const amp = ctx.createGain();
		const pan = ctx.createStereoPanner();
		pan.pan.value = panFor(note, this.focus);
		amp.gain.setValueAtTime(1e-4, start);
		amp.gain.exponentialRampToValueAtTime(peak, start + .006);
		const release = note.k === 2 ? .03 : .045;
		const hold = start + Math.max(.02, dur - release);
		amp.gain.setValueAtTime(Math.max(peak, 2e-4), hold);
		amp.gain.exponentialRampToValueAtTime(1e-4, hold + release);
		src.connect(amp);
		amp.connect(pan);
		pan.connect(master);
		src.start(start);
		const stopAt = start + dur + .06;
		src.stop(stopAt);
		const voice = {
			end: stopAt,
			peak,
			gain: amp,
			stop: () => {
				try {
					src.stop();
				} catch {}
			},
			choke: (time) => {
				const at = Math.max(time, ctx.currentTime);
				try {
					amp.gain.cancelScheduledValues(at);
					amp.gain.setValueAtTime(Math.max(2e-4, peak * .65), at);
					amp.gain.exponentialRampToValueAtTime(1e-4, at + .018);
				} catch {}
			}
		};
		this.live.push(voice);
		if (note.k !== 2 && note.z !== 1 && note.s != null) {
			const slot = `${note.track}:${note.s}`;
			this.strings.get(slot)?.choke(start);
			this.strings.set(slot, voice);
		}
		if (note.k === 2 && (note.m === 42 || note.m === 44)) this.openHat?.choke(start);
		if (note.k === 2 && note.m === 46) this.openHat = voice;
	}
	buffer(ctx, key) {
		const cached = this.buffers.get(key);
		if (cached) return cached;
		let pcm = this.pcm.get(key);
		if (!pcm) {
			const rendered = renderKey(key, ctx.sampleRate);
			if (!rendered) return null;
			pcm = rendered;
			this.pcm.set(key, pcm);
		}
		const audio = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
		audio.getChannelData(0).set(pcm);
		this.buffers.set(key, audio);
		return audio;
	}
	gc() {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		if (this.live.length < 16) return;
		this.live = this.live.filter((voice) => voice.end > now - .02);
	}
	silence() {
		this.epoch++;
		for (const voice of this.live) voice.stop();
		this.live = [];
		this.strings.clear();
		this.openHat = null;
		this.scheduledUntil = 0;
		window.clearInterval(this.timer);
		this.timer = 0;
	}
};
function clampSpeed(speed) {
	if (!Number.isFinite(speed)) return 1;
	return Math.min(1.25, Math.max(.5, Math.round(speed * 100) / 100));
}
function panFor(note, focus) {
	if (note.k === 2 || note.k === 1) return 0;
	if (note.track === focus) return -.12;
	return .2;
}
function bufferKey(note) {
	if (!Number.isFinite(note.m)) return null;
	if (note.z === 2) return "chuck";
	if (note.k === 2) return `d${drumClass(note.m)}`;
	const midi = Math.max(20, Math.min(108, Math.round(note.m)));
	if (note.k === 1) return `b${midi}`;
	if (note.z === 1) return `k${midi}`;
	return `g${midi}`;
}
function drumClass(midi) {
	if (midi === 35 || midi === 36) return "kick";
	if (midi === 38 || midi === 40 || midi === 37 || midi === 39) return "snare";
	if (midi === 42 || midi === 44) return "hat";
	if (midi === 46) return "ohat";
	if (midi === 49 || midi === 52 || midi === 55 || midi === 57) return "crash";
	if (midi === 51 || midi === 53 || midi === 59) return "ride";
	if (midi >= 41 && midi <= 50) return `tom${midi}`;
	return `perc${midi}`;
}
function renderKey(key, sr) {
	if (key === "chuck") return renderChuck(sr);
	if (key.startsWith("d")) return renderDrum(key.slice(1), sr);
	const midi = Number(key.slice(1));
	if (!Number.isFinite(midi)) return null;
	if (key.startsWith("b")) return renderBass(sr, midi);
	if (key.startsWith("k")) return renderKeys(sr, midi);
	return renderGuitar(sr, midi);
}
function midiFreq(midi) {
	return 440 * Math.pow(2, (midi - 69) / 12);
}
function normalize(buf, peak = .92) {
	let max = 0;
	for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
	if (max < 1e-5) return;
	const g = peak / max;
	for (let i = 0; i < buf.length; i++) buf[i] *= g;
}
function fadeEnds(buf, sr) {
	const a = Math.min(buf.length, Math.floor(sr * .004));
	const b = Math.min(buf.length, Math.floor(sr * .02));
	for (let i = 0; i < a; i++) buf[i] *= i / a;
	for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
}
function karplus(sr, freq, length, decay, passes) {
	const n = Math.max(8, length);
	const period = Math.max(2, Math.round(sr / Math.max(30, freq)));
	const line = new Float32Array(period);
	for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
	const pick = Math.floor(period * .22);
	for (let i = 0; i < period; i++) line[i] -= line[(i + pick) % period] * .72;
	for (let pass = 0; pass < passes; pass++) {
		let prev = 0;
		for (let i = 0; i < period; i++) {
			const x = line[i];
			line[i] = (x + prev) * .5;
			prev = x;
		}
	}
	let peak = 0;
	for (let i = 0; i < period; i++) peak = Math.max(peak, Math.abs(line[i]));
	if (peak > 0) for (let i = 0; i < period; i++) line[i] /= peak;
	const buf = new Float32Array(n);
	let idx = 0;
	let dc = 0;
	for (let i = 0; i < n; i++) {
		const y = line[idx];
		const next = line[(idx + 1) % period];
		line[idx] = decay * (.52 * y + .48 * next);
		dc = dc * .996 + y * .004;
		buf[i] = y - dc;
		idx++;
		if (idx >= period) idx = 0;
	}
	return buf;
}
function renderGuitar(sr, midi) {
	const freq = midiFreq(midi);
	const n = Math.floor(sr * (freq < 180 ? 2.8 : freq < 360 ? 2.3 : 1.7));
	const buf = karplus(sr, freq, n, freq < 160 ? .9975 : freq < 320 ? .994 : .988, freq > 500 ? 1 : 2);
	const click = Math.floor(sr * .007);
	for (let i = 0; i < click; i++) {
		const env = Math.exp(-i / (sr * .0018));
		buf[i] += (Math.random() * 2 - 1) * .22 * env;
	}
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		buf[i] += Math.sin(2 * Math.PI * freq * t) * .07 * Math.exp(-t * 5.5);
		buf[i] = Math.tanh(buf[i] * 1.25);
	}
	fadeEnds(buf, sr);
	normalize(buf, .9);
	return buf;
}
function renderBass(sr, midi) {
	const freq = midiFreq(midi);
	const n = Math.floor(sr * 2.4);
	const pluck = karplus(sr, freq, n, .997, 4);
	const buf = new Float32Array(n);
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		const f = freq * (1 + .02 * Math.exp(-t * 36));
		phase += 2 * Math.PI * f / sr;
		const body = Math.sin(phase) * (.78 * Math.exp(-t * 1.15) + .22);
		const growl = Math.sin(phase * 2) * .22 * Math.exp(-t * 3.4);
		const edge = Math.sin(phase * 3) * .07 * Math.exp(-t * 8);
		const finger = Math.sin(phase * 5) * .045 * Math.exp(-t * 18);
		buf[i] = body + growl + edge + finger + pluck[i] * .18;
	}
	let lp = 0;
	const cut = Math.exp(-2 * Math.PI * 680 / sr);
	for (let i = 0; i < n; i++) {
		lp += (1 - cut) * (buf[i] - lp);
		buf[i] = Math.tanh(lp * 1.35);
	}
	fadeEnds(buf, sr);
	normalize(buf, .95);
	return buf;
}
function renderKeys(sr, midi) {
	const freq = midiFreq(midi);
	const n = Math.floor(sr * 2.6);
	const buf = new Float32Array(n);
	const amps = [
		1,
		.52,
		.24,
		.12,
		.07,
		.04
	];
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		let s = 0;
		for (let h = 0; h < amps.length; h++) s += Math.sin(2 * Math.PI * freq * (h + 1) * t) * amps[h] * Math.exp(-t * (1.6 + h * 1.7));
		const hammer = (Math.random() * 2 - 1) * Math.exp(-t * 90) * .18;
		buf[i] = Math.tanh((s * .7 + hammer) * 1.15);
	}
	fadeEnds(buf, sr);
	normalize(buf, .88);
	return buf;
}
function renderChuck(sr) {
	const n = Math.floor(sr * .09);
	const buf = new Float32Array(n);
	let dull = 0;
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		const noise = Math.random() * 2 - 1;
		dull = dull * .8 + noise * .2;
		buf[i] = (noise - dull) * Math.exp(-t * 48);
	}
	fadeEnds(buf, sr);
	normalize(buf, .75);
	return buf;
}
function noiseHat(sr, dur, decay, cutoff, metal) {
	const n = Math.floor(sr * dur);
	const buf = new Float32Array(n);
	const ratios = [
		1,
		1.42,
		1.67,
		1.94,
		2.27,
		2.71,
		3.19,
		3.83
	];
	const base = 340;
	const phases = ratios.map(() => Math.random() * Math.PI * 2);
	let prevIn = 0;
	let prevOut = 0;
	const rc = 1 / (2 * Math.PI * cutoff);
	const alpha = rc / (rc + 1 / sr);
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		let tone = 0;
		for (let k = 0; k < ratios.length; k++) {
			phases[k] += 2 * Math.PI * base * ratios[k] / sr;
			tone += Math.sin(phases[k]) / (1 + k * .45);
		}
		const mixed = (Math.random() * 2 - 1) * .75 + tone * metal;
		const out = alpha * (prevOut + mixed - prevIn);
		prevIn = mixed;
		prevOut = out;
		buf[i] = out * Math.exp(-t * decay);
	}
	fadeEnds(buf, sr);
	normalize(buf, .8);
	return buf;
}
function renderDrum(kind, sr) {
	if (kind === "kick") return renderKick(sr);
	if (kind === "snare") return renderSnare(sr);
	if (kind === "hat") return noiseHat(sr, .055, 62, 7200, .18);
	if (kind === "ohat") return noiseHat(sr, .38, 8.5, 5600, .28);
	if (kind === "crash") return noiseHat(sr, 1.35, 2.4, 4800, .55);
	if (kind === "ride") return noiseHat(sr, 1.05, 3.1, 5200, .42);
	if (kind.startsWith("tom")) return renderTom(sr, 70 + (50 - (Number(kind.slice(3)) || 47)) * 6);
	return noiseHat(sr, .12, 28, 2500, .2);
}
function renderKick(sr) {
	const n = Math.floor(sr * .48);
	const buf = new Float32Array(n);
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		const f = 46 + 155 * Math.exp(-t * 26);
		phase += 2 * Math.PI * f / sr;
		const body = Math.sin(phase) * Math.exp(-t * 6.2);
		const click = (Math.random() * 2 - 1) * Math.exp(-t * 210) * .35;
		const sub = Math.sin(2 * Math.PI * 50 * t) * Math.exp(-t * 4.2) * .45;
		buf[i] = Math.tanh((body * .95 + sub + click) * 1.2);
	}
	fadeEnds(buf, sr);
	normalize(buf, .98);
	return buf;
}
function renderSnare(sr) {
	const n = Math.floor(sr * .32);
	const buf = new Float32Array(n);
	let bp = 0;
	let hp = 0;
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		const noise = Math.random() * 2 - 1;
		bp += .18 * (noise - bp);
		hp = noise - bp;
		const snap = hp * Math.exp(-t * 23);
		const body = bp * Math.exp(-t * 16) * .65;
		const tone = Math.sin(2 * Math.PI * 186 * t) * Math.exp(-t * 28) * .55;
		const ring = Math.sin(2 * Math.PI * 332 * t) * Math.exp(-t * 36) * .22;
		buf[i] = snap * .7 + body + tone + ring;
	}
	fadeEnds(buf, sr);
	normalize(buf, .9);
	return buf;
}
function renderTom(sr, freq) {
	const n = Math.floor(sr * .42);
	const buf = new Float32Array(n);
	let phase = 0;
	const f0 = Math.max(70, Math.min(240, freq));
	for (let i = 0; i < n; i++) {
		const t = i / sr;
		const f = f0 * (1 + .55 * Math.exp(-t * 22));
		phase += 2 * Math.PI * f / sr;
		const noise = (Math.random() * 2 - 1) * Math.exp(-t * 70) * .18;
		buf[i] = Math.tanh(Math.sin(phase) * Math.exp(-t * 7.5) + noise);
	}
	fadeEnds(buf, sr);
	normalize(buf, .9);
	return buf;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
/** Where the shared clock says the playhead is, in song milliseconds. */
function roomPosition(room, serverNow) {
	if (!room.playing) return Math.max(0, room.positionMs);
	return Math.max(0, room.positionMs + (serverNow - room.anchorMs) * room.speed);
}
function smoothOffset(prev, sentAt, serverNow, receivedAt) {
	const sample = serverNow - (sentAt + (receivedAt - sentAt) / 2);
	if (prev == null || !Number.isFinite(prev)) return sample;
	return prev * .72 + sample * .28;
}
var SPEEDS = [
	.5,
	.75,
	1,
	1.25
];
function readPeer() {
	const key = "vtakt-peer";
	try {
		let id = localStorage.getItem(key);
		if (!id || !/^[a-zA-Z0-9-]{8,48}$/.test(id)) {
			id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
			localStorage.setItem(key, id);
		}
		return id;
	} catch {
		return "peerlocal01";
	}
}
function messageOf(err) {
	if (err instanceof Error && err.message) return err.message;
	return "Что-то пошло не так";
}
function Session(props) {
	const code = props.mode === "room" ? props.code.toUpperCase() : "";
	const [meta, setMeta] = (0, import_react.useState)(null);
	const [view, setView] = (0, import_react.useState)(null);
	const [phase, setPhase] = (0, import_react.useState)("loading");
	const [error, setError] = (0, import_react.useState)("");
	const [missing, setMissing] = (0, import_react.useState)(false);
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [speed, setSpeed] = (0, import_react.useState)(1);
	const [clock, setClock] = (0, import_react.useState)(0);
	const [listeners, setListeners] = (0, import_react.useState)(0);
	const [drift, setDrift] = (0, import_react.useState)("синхрон");
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [needGesture, setNeedGesture] = (0, import_react.useState)(false);
	const [finder, setFinder] = (0, import_react.useState)("");
	const [hits, setHits] = (0, import_react.useState)([]);
	const [finding, setFinding] = (0, import_react.useState)(false);
	const [showFinder, setShowFinder] = (0, import_react.useState)(false);
	const engineRef = (0, import_react.useRef)(null);
	const metaRef = (0, import_react.useRef)(null);
	const viewRef = (0, import_react.useRef)(null);
	const mixRef = (0, import_react.useRef)([]);
	const offsetRef = (0, import_react.useRef)(null);
	const seqRef = (0, import_react.useRef)(0);
	const driving = (0, import_react.useRef)(false);
	const playingRef = (0, import_react.useRef)(false);
	const speedRef = (0, import_react.useRef)(1);
	const armed = (0, import_react.useRef)(false);
	const genRef = (0, import_react.useRef)(0);
	const loadingRef = (0, import_react.useRef)(false);
	const peerRef = (0, import_react.useRef)("");
	const lastRoom = (0, import_react.useRef)(null);
	const getPosition = (0, import_react.useRef)(() => engineRef.current?.position() ?? 0);
	const onSeek = (0, import_react.useRef)(() => {});
	const barLabel = useBarLabel(view, clock);
	function adopt(song, takeMix) {
		if (takeMix && song.mix.length) mixRef.current = song.mix;
		const next = {
			songId: song.songId,
			title: song.title,
			artist: song.artist,
			songUrl: song.songUrl,
			durationMs: song.durationMs,
			tracks: song.tracks
		};
		metaRef.current = next;
		viewRef.current = song.view;
		setMeta(next);
		setView(song.view);
		const engine = engineRef.current;
		const vocals = song.tracks.filter((t) => t.vocal).map((t) => t.index);
		if (!engine) return;
		if (takeMix && mixRef.current.length) engine.load(mixRef.current, song.view.trackIndex, vocals);
		else engine.setFocus(song.view.trackIndex);
		setPhase("ready");
		setError("");
	}
	async function ensureTrack(songId, trackIndex, withMix) {
		const gen = ++genRef.current;
		loadingRef.current = true;
		setPhase("loading");
		try {
			const song = await loadSong({ data: {
				songId,
				trackIndex,
				withMix
			} });
			if (gen !== genRef.current) return false;
			adopt(song, withMix && song.mix.length > 0);
			return true;
		} catch (err) {
			if (gen === genRef.current) throw err;
			return false;
		} finally {
			if (gen === genRef.current) loadingRef.current = false;
		}
	}
	async function syncToRoom(room) {
		lastRoom.current = room;
		speedRef.current = room.speed;
		setSpeed(room.speed);
		const sameSong = metaRef.current?.songId === room.songId;
		const needMix = !sameSong || mixRef.current.length === 0;
		const needView = !sameSong || viewRef.current?.trackIndex !== room.trackIndex;
		if (needMix || needView) {
			if (loadingRef.current) return;
			try {
				if (!await ensureTrack(room.songId, room.trackIndex, needMix)) return;
			} catch (err) {
				setError(messageOf(err));
				setPhase("error");
				return;
			}
		}
		const engine = engineRef.current;
		const current = metaRef.current;
		if (!engine || !current) return;
		let target = roomPosition(room, Date.now() + (offsetRef.current ?? 0));
		if (current.durationMs > 0) target = Math.min(target, Math.max(0, current.durationMs - 1));
		if (!armed.current) {
			engine.seek(target);
			engine.setSpeed(room.speed, target);
			playingRef.current = false;
			setPlaying(false);
			setNeedGesture(room.playing);
			seqRef.current = room.seq;
			return;
		}
		if (room.seq !== seqRef.current) {
			seqRef.current = room.seq;
			if (room.playing) {
				engine.setSpeed(room.speed, target);
				playingRef.current = true;
				setPlaying(true);
			} else {
				engine.pause();
				engine.setSpeed(room.speed, target);
				engine.seek(target);
				playingRef.current = false;
				setPlaying(false);
			}
			setDrift("синхрон");
		} else if (room.playing) {
			if (!playingRef.current) {
				engine.setSpeed(room.speed, target);
				playingRef.current = true;
				setPlaying(true);
			}
			const how = engine.correct(target);
			setDrift(how === "ok" ? "синхрон" : "подстройка");
		} else if (playingRef.current) {
			engine.pause();
			engine.seek(target);
			playingRef.current = false;
			setPlaying(false);
		}
	}
	async function publish(partial) {
		if (props.mode !== "room") return;
		const current = metaRef.current;
		const part = viewRef.current;
		if (!current || !part) return;
		driving.current = true;
		const sent = Date.now();
		try {
			const res = await pushTransport({ data: {
				code,
				peer: peerRef.current,
				songId: partial.songId ?? current.songId,
				trackIndex: partial.trackIndex ?? part.trackIndex,
				title: partial.title ?? current.title,
				artist: partial.artist ?? current.artist,
				playing: partial.playing ?? playingRef.current,
				positionMs: partial.positionMs ?? engineRef.current?.position() ?? 0,
				speed: partial.speed ?? speedRef.current
			} });
			offsetRef.current = smoothOffset(offsetRef.current, sent, res.serverNow, Date.now());
			if (!res.room) {
				setMissing(true);
				return;
			}
			seqRef.current = res.room.seq;
			lastRoom.current = res.room;
			setListeners(res.room.listeners);
			const target = Math.min(roomPosition(res.room, Date.now() + (offsetRef.current ?? 0)), current.durationMs || Number.POSITIVE_INFINITY);
			const how = engineRef.current?.correct(target) ?? "ok";
			setDrift(how === "ok" ? "синхрон" : "подстройка");
		} catch (err) {
			setError(messageOf(err));
		} finally {
			driving.current = false;
		}
	}
	onSeek.current = (ms, commit) => {
		const engine = engineRef.current;
		if (!engine) return;
		engine.seek(ms);
		setClock(ms);
		if (!commit) return;
		publish({
			positionMs: ms,
			playing: playingRef.current
		});
	};
	(0, import_react.useEffect)(() => {
		const engine = new BandEngine();
		engineRef.current = engine;
		peerRef.current = readPeer();
		return () => engine.destroy();
	}, []);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			const pos = engineRef.current?.position() ?? 0;
			setClock(pos);
		}, 200);
		return () => window.clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		if (props.mode !== "solo") return;
		let cancel = false;
		setPhase("loading");
		setMissing(false);
		(async () => {
			try {
				const song = await loadSong({ data: {
					songId: props.songId,
					trackIndex: props.track,
					withMix: true
				} });
				if (cancel) return;
				adopt(song, true);
				engineRef.current?.seek(0);
				playingRef.current = false;
				setPlaying(false);
			} catch (err) {
				if (!cancel) {
					setError(messageOf(err));
					setPhase("error");
				}
			}
		})();
		return () => {
			cancel = true;
		};
	}, [props.mode === "solo" ? props.songId : 0]);
	(0, import_react.useEffect)(() => {
		if (props.mode !== "room") return;
		let stop = false;
		const tick = async () => {
			if (stop || driving.current) return;
			const sent = Date.now();
			try {
				const res = await pollRoom({ data: {
					code,
					peer: peerRef.current || readPeer()
				} });
				if (stop || driving.current) return;
				offsetRef.current = smoothOffset(offsetRef.current, sent, res.serverNow, Date.now());
				if (!res.room) {
					setMissing(true);
					setPhase("ready");
					return;
				}
				setMissing(false);
				setListeners(res.room.listeners);
				await syncToRoom(res.room);
			} catch (err) {
				if (!stop) setError(messageOf(err));
			}
		};
		tick();
		const id = window.setInterval(() => void tick(), 800);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [code]);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
			if (event.code !== "Space") return;
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	(0, import_react.useEffect)(() => {
		if (!showFinder) return;
		const q = finder.trim();
		if (extractSongId(q)) {
			setHits([]);
			return;
		}
		if (q.length < 2) {
			setHits([]);
			return;
		}
		const handle = window.setTimeout(() => {
			setFinding(true);
			searchSongs({ data: { q } }).then(setHits).catch((err) => setError(messageOf(err))).finally(() => setFinding(false));
		}, 280);
		return () => window.clearTimeout(handle);
	}, [finder, showFinder]);
	async function toggle() {
		const engine = engineRef.current;
		const current = metaRef.current;
		if (!engine || !current) return;
		await engine.unlock();
		armed.current = true;
		setNeedGesture(false);
		if (!playingRef.current) {
			let from = engine.position();
			if (current.durationMs && from >= current.durationMs - 80) from = 0;
			engine.play(from);
			playingRef.current = true;
			setPlaying(true);
			await publish({
				playing: true,
				positionMs: from
			});
		} else {
			const pos = engine.pause();
			playingRef.current = false;
			setPlaying(false);
			await publish({
				playing: false,
				positionMs: pos
			});
		}
	}
	async function armAndJoin() {
		const engine = engineRef.current;
		if (!engine) return;
		await engine.unlock();
		armed.current = true;
		setNeedGesture(false);
		if (lastRoom.current) await syncToRoom(lastRoom.current);
	}
	async function chooseSpeed(next) {
		const engine = engineRef.current;
		if (!engine) return;
		const pos = engine.position();
		speedRef.current = next;
		setSpeed(next);
		engine.setSpeed(next, pos);
		if (!playingRef.current) {
			engine.pause();
			engine.seek(pos);
		}
		await publish({
			speed: next,
			positionMs: pos,
			playing: playingRef.current
		});
	}
	async function chooseTrack(index) {
		const current = metaRef.current;
		if (!current || index === viewRef.current?.trackIndex) return;
		const pos = engineRef.current?.position() ?? 0;
		const was = playingRef.current;
		try {
			if (!await ensureTrack(current.songId, index, mixRef.current.length === 0)) return;
			const engine = engineRef.current;
			if (!engine) return;
			if (was && armed.current) engine.play(pos);
			else engine.seek(pos);
			playingRef.current = was && armed.current;
			setPlaying(playingRef.current);
			await publish({
				trackIndex: index,
				positionMs: pos,
				playing: playingRef.current
			});
		} catch (err) {
			setError(messageOf(err));
			setPhase("error");
		}
	}
	async function chooseSong(songId, title, artist, trackIndex) {
		const wasRoom = props.mode === "room";
		try {
			if (wasRoom) {
				engineRef.current?.pause();
				playingRef.current = false;
				setPlaying(false);
			}
			if (!await ensureTrack(songId, trackIndex, true)) return;
			engineRef.current?.seek(0);
			playingRef.current = false;
			setPlaying(false);
			setShowFinder(false);
			setFinder("");
			const loaded = metaRef.current;
			if (wasRoom && loaded) await publish({
				songId: loaded.songId,
				trackIndex: viewRef.current?.trackIndex ?? loaded.tracks[0]?.index ?? 0,
				title: loaded.title || title,
				artist: loaded.artist || artist,
				playing: false,
				positionMs: 0
			});
		} catch (err) {
			setError(messageOf(err));
			setPhase("error");
		}
	}
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}
	const duration = meta?.durationMs ?? 0;
	const shown = Math.min(clock, duration || clock);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "font-serif text-xl font-semibold tracking-tight text-fg",
						children: "В такт"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 truncate font-serif text-2xl font-semibold text-fg md:text-3xl",
						children: meta ? meta.title : phase === "loading" ? "Собираем таб…" : "Без названия"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-sm text-muted",
						children: meta?.artist || "Songsterr"
					})
				]
			}), props.mode === "room" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-line bg-surface px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs uppercase tracking-widest text-muted",
							children: "Комната"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-2xl font-semibold tracking-[0.18em] text-accent",
							children: code
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => void copyCode(),
						className: "inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink",
						children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), copied ? "Скопирован" : "Код"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "inline-flex items-center gap-1.5 text-sm text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" }),
							listeners > 1 ? `${listeners} в комнате` : "только вы",
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-ok",
								children: ["· ", drift]
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-xs text-sm text-muted",
				children: "Сейчас играет только этот экран. Комнату можно открыть с главной."
			})]
		}), missing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-2xl border border-line bg-surface px-5 py-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-serif text-2xl",
					children: "Такой комнаты нет"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-muted",
					children: "Проверьте код из пяти символов."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink",
					children: "На главную"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2 overflow-x-auto pb-1",
				children: (meta?.tracks ?? []).map((track) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => void chooseTrack(track.index),
					className: cn("h-11 shrink-0 rounded-full border px-3 text-left text-sm", view?.trackIndex === track.index ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-fg"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold",
						children: track.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: view?.trackIndex === track.index ? "text-accent-ink/80" : "text-muted",
						children: [
							" ",
							"· ",
							track.instrument
						]
					})]
				}, track.index))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative overflow-hidden rounded-2xl border border-black/50 bg-[#1a1b1e] shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-[54vh] min-h-72 max-h-[640px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabStage, {
							view,
							getPosition,
							onSeek
						})
					}),
					phase === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-center justify-center bg-[#1a1b1e]/85 text-fg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "inline-flex items-center gap-2 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Загружаем партии Songsterr"]
						})
					}) : null,
					needGesture ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 flex items-end justify-center bg-ink/25 p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => void armAndJoin(),
							className: "inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-ink",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 fill-current" }), "Включить звук и войти в такт"]
						})
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-line bg-surface p-3 md:p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void toggle(),
						disabled: !meta || phase === "loading",
						className: "inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40",
						"aria-label": playing ? "Пауза" : "Играть",
						children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-6 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-6 fill-current" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-1 flex items-baseline justify-between gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-fg",
								children: barLabel || "Такт"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-muted",
								children: [
									formatTime(shown),
									" / ",
									formatTime(duration)
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "range",
							min: 0,
							max: Math.max(duration, 1),
							step: 50,
							value: Math.min(shown, Math.max(duration, 1)),
							"aria-label": "Позиция",
							disabled: !duration,
							onPointerDown: () => {
								driving.current = true;
							},
							onInput: (event) => {
								const ms = Number(event.currentTarget.value);
								engineRef.current?.seek(ms);
								setClock(ms);
							},
							onPointerUp: (event) => {
								driving.current = false;
								publish({
									positionMs: Number(event.currentTarget.value),
									playing: playingRef.current
								});
							},
							onKeyUp: (event) => {
								if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
								publish({
									positionMs: Number(event.currentTarget.value),
									playing: playingRef.current
								});
							}
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs uppercase tracking-widest text-muted",
							children: "Скорость"
						}),
						SPEEDS.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void chooseSpeed(value),
							className: cn("h-10 min-w-14 rounded-full border px-3 text-sm font-semibold", speed === value ? "border-accent bg-accent text-accent-ink" : "border-line text-fg"),
							children: value === 1 ? "1×" : `${value}×`
						}, value)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-auto inline-flex h-3 w-3 items-center justify-center",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("beat-pip size-2.5 rounded-full", playing ? "bg-ember" : "bg-line") }, barLabel)
						})
					]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ember",
				role: "alert",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-wrap items-center gap-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setShowFinder((v) => !v),
						className: "inline-flex h-11 items-center gap-2 rounded-full border border-line px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }), "Другая песня"]
					}),
					meta ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: meta.songUrl,
						target: "_blank",
						rel: "noreferrer",
						className: "inline-flex h-11 items-center gap-2 rounded-full border border-line px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-4" }), "Открыть на Songsterr"]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-xl text-muted",
						children: "Все партии идут по одной сетке тактов. Звук синтезируется в браузере — гитара, бас, клавиши и ударные, — это не запись Songsterr."
					})
				]
			}),
			showFinder ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-sm text-muted",
						htmlFor: "finder",
						children: "Название или ссылка Songsterr"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "finder",
						value: finder,
						onChange: (event) => setFinder(event.target.value),
						placeholder: "enter sandman",
						className: "mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 text-fg outline-none"
					}),
					finding ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted",
						children: "Ищем…"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-line",
						children: hits.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex w-full flex-col items-start py-3 text-left",
							onClick: () => void chooseSong(hit.songId, hit.title, hit.artist, hit.defaultTrack),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold",
								children: hit.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm text-muted",
								children: [
									hit.artist,
									" · ",
									hit.trackCount,
									" партий"
								]
							})]
						}) }, hit.songId))
					}),
					extractSongId(finder) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-3 inline-flex h-11 items-center rounded-full bg-accent px-4 font-semibold text-accent-ink",
						onClick: () => {
							const id = extractSongId(finder);
							if (id) chooseSong(id, meta?.title ?? "", meta?.artist ?? "", -1);
						},
						children: "Открыть ссылку"
					}) : null
				]
			}) : null
		] })]
	});
}
//#endregion
export { Session as t };
