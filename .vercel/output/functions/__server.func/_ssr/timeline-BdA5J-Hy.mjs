//#region node_modules/.nitro/vite/services/ssr/assets/timeline-BdA5J-Hy.js
function isVocalName(name, instrument) {
	return /vocal|voice|lyrics|singing|choir|бэк/i.test(`${name} ${instrument}`);
}
function mixKind(instrumentId, instrument, tuning) {
	if (instrumentId === 1024 || /drum/i.test(instrument) || !tuning?.length) return 2;
	if (/bass/i.test(instrument) || instrumentId >= 33 && instrumentId <= 40) return 1;
	return 0;
}
function isKeys(instrumentId, instrument, kind) {
	if (kind !== 0) return false;
	if (/piano|keyboard|organ|rhodes|clav|harpsi|synth|strings|violin|cello|viola|flute|sax|recorder|pad/i.test(instrument)) return true;
	return instrumentId > 0 && instrumentId <= 24;
}
/** Songsterr `duration` already includes dots and tuplets. Adding dots again stretches that track. */
function beatQuarters(b) {
	if (b.graceNote || b.grace) return 0;
	const dur = b.duration;
	if (Array.isArray(dur) && dur.length >= 2 && dur[0] > 0 && dur[1] > 0) {
		const q = dur[0] / dur[1] * 4;
		if (Number.isFinite(q) && q > 0 && q < 64) return q;
	}
	let q = 1 / (b.type || 4) * 4;
	if (!Number.isFinite(q) || q <= 0) q = 1;
	let extra = q / 2;
	for (let i = 0; i < (b.dots ?? 0); i++) {
		q += extra;
		extra /= 2;
	}
	if (typeof b.tuplet === "number" && b.tuplet > 1) q *= 2 / b.tuplet;
	return q;
}
function velocityGain(v, ghost, dead) {
	let g = .9;
	if (typeof v === "number" && Number.isFinite(v)) g = v > 1 ? Math.min(1.15, v / 127) : Math.min(1.15, Math.max(.3, v));
	else if (typeof v === "string") g = {
		ppp: .35,
		pp: .45,
		p: .58,
		mp: .75,
		mf: .9,
		f: 1,
		ff: 1.08,
		fff: 1.12
	}[v] ?? .9;
	if (ghost) g *= .55;
	if (dead) g *= .7;
	return g;
}
function artOf(n) {
	if (n.hp) return "h";
	if (n.slide === "above" || n.slide === "up" || n.slide === "shift") return "/";
	if (typeof n.slide === "string" || n.slide === true) return "\\";
}
function consensusLength(lengths, nominal) {
	if (!lengths.length) return nominal;
	const snapped = lengths.map((l) => Math.abs(l - nominal) < .06 ? nominal : Math.round(l * 64) / 64);
	const hist = /* @__PURE__ */ new Map();
	for (const l of snapped) hist.set(l, (hist.get(l) ?? 0) + 1);
	let best = nominal;
	let bestC = -1;
	for (const [l, c] of hist) {
		const closer = c === bestC && Math.abs(l - nominal) < Math.abs(best - nominal);
		if (c > bestC || closer) {
			best = l;
			bestC = c;
		}
	}
	return best > .05 ? best : nominal;
}
function buildMaster(parts) {
	const count = parts.reduce((max, part) => Math.max(max, part.measures?.length ?? 0), 0);
	let sig = [4, 4];
	const lens = [];
	for (let i = 0; i < count; i++) {
		const lengths = [];
		for (const part of parts) {
			const measure = part.measures?.[i];
			if (!measure) continue;
			if (measure.signature && measure.signature.length === 2 && measure.signature[0] && measure.signature[1]) sig = [measure.signature[0], measure.signature[1]];
			let maxV = 0;
			for (const voice of measure.voices ?? []) {
				let q = 0;
				for (const beat of voice.beats ?? []) q += beatQuarters(beat);
				if (q > maxV) maxV = q;
			}
			if (maxV > .02) lengths.push(maxV);
		}
		const nominal = sig[0] * (4 / sig[1]);
		lens.push(consensusLength(lengths, nominal));
	}
	const starts = [];
	let cursor = 0;
	for (const len of lens) {
		starts.push(cursor);
		cursor += len;
	}
	let tempoPart = parts[0];
	let tempoCount = -1;
	let gradual = false;
	for (const part of parts) {
		const n = part?.automations?.tempo?.length ?? 0;
		if (n > tempoCount) {
			tempoPart = part;
			tempoCount = n;
		}
		if (part?.automations?.gradualTempo) gradual = true;
	}
	return {
		starts,
		lens,
		tempos: tempoPoints(tempoPart, starts, gradual),
		totalQ: cursor
	};
}
function tempoPoints(part, starts, gradual) {
	const raw = (part?.automations?.tempo ?? []).filter((t) => typeof t.bpm === "number" && t.bpm > 20 && t.bpm < 400).map((t) => ({
		measure: Math.max(0, t.measure ?? 0),
		position: typeof t.position === "number" && t.position > 0 && t.position < 64 ? t.position : 0,
		bpm: t.bpm,
		linear: Boolean(t.linear) || gradual
	}));
	const pts = [];
	for (const t of raw) {
		const origin = starts[Math.min(t.measure, Math.max(0, starts.length - 1))] ?? 0;
		pts.push({
			q: origin + t.position,
			bpm: t.bpm,
			linear: t.linear
		});
	}
	pts.sort((a, b) => a.q - b.q);
	const dedup = [];
	for (const p of pts) {
		const prev = dedup[dedup.length - 1];
		if (prev && Math.abs(prev.q - p.q) < 1e-4) dedup[dedup.length - 1] = p;
		else dedup.push(p);
	}
	return dedup;
}
function bpmAt(q, points) {
	if (!points.length) return 120;
	if (q <= points[0].q) return points[0].bpm;
	let i = 0;
	while (i < points.length - 1 && points[i + 1].q <= q + 1e-9) i++;
	const a = points[i];
	const b = points[i + 1];
	if (!b || b.q <= a.q) return a.bpm;
	if (a.linear || b.linear) {
		const t = Math.min(1, Math.max(0, (q - a.q) / (b.q - a.q)));
		return a.bpm + (b.bpm - a.bpm) * t;
	}
	return a.bpm;
}
function quarterToMs(qTarget, points) {
	if (qTarget <= 0) return 0;
	const knots = [
		0,
		...points.map((p) => p.q).filter((q) => q > 0 && q < qTarget),
		qTarget
	];
	const uniq = [...new Set(knots.map((n) => Math.round(n * 1e3) / 1e3))].sort((a, b) => a - b);
	if (uniq[uniq.length - 1] !== qTarget) uniq.push(qTarget);
	let ms = 0;
	for (let i = 0; i < uniq.length - 1; i++) {
		const a = uniq[i];
		const b = uniq[i + 1];
		const dq = b - a;
		if (dq <= 0) continue;
		const bpmA = Math.max(20, bpmAt(a, points));
		const bpmB = Math.max(20, bpmAt(Math.max(a, b - 1e-4), points));
		if (Math.abs(bpmA - bpmB) < .35) ms += dq * (6e4 / bpmA);
		else ms += dq * 6e4 * Math.log(bpmB / bpmA) / (bpmB - bpmA);
	}
	return ms;
}
function midiOf(kind, tuning, fret, string) {
	if (kind === 2) return Number.isFinite(fret) ? fret : null;
	const open = tuning?.[string];
	if (open == null || !Number.isFinite(open + fret)) return null;
	return open + fret;
}
function compileTrack(part, trackIndex, master, songMs) {
	const instrument = part.instrument ?? "Track";
	const name = part.name ?? instrument;
	const instrumentId = part.instrumentId ?? 0;
	const tuning = Array.isArray(part.tuning) && part.tuning.length ? part.tuning : null;
	const kind = mixKind(instrumentId, instrument, tuning);
	const keys = isKeys(instrumentId, instrument, kind);
	const vocal = isVocalName(name, instrument);
	const strings = part.strings && part.strings > 0 ? part.strings : tuning?.length || 6;
	const measures = part.measures ?? [];
	const bars = [];
	const events = [];
	const voiceSounds = [];
	let sig = [4, 4];
	const stretchRing = (bucket, string, atQ) => {
		let best;
		for (const prev of bucket) {
			if (prev.s !== string || prev.q > atQ + 1e-4) continue;
			if (!best || prev.q >= best.q) best = prev;
		}
		if (!best) return;
		if (best.ring && best.endQ < atQ) best.endQ = atQ;
		best.ring = false;
	};
	const extendTie = (bucket, string, midi, endQ) => {
		for (let i = bucket.length - 1; i >= 0; i--) {
			const prev = bucket[i];
			if (prev.s !== string || Math.abs(prev.m - midi) > .5) continue;
			prev.endQ = Math.max(prev.endQ, endQ);
			return true;
		}
		return false;
	};
	for (let i = 0; i < measures.length && i < master.starts.length; i++) {
		const measure = measures[i];
		if (measure.signature && measure.signature.length === 2 && measure.signature[0] && measure.signature[1]) sig = [measure.signature[0], measure.signature[1]];
		const qStart = master.starts[i];
		const qLen = master.lens[i];
		const startMs = quarterToMs(qStart, master.tempos);
		const endMs = quarterToMs(qStart + qLen, master.tempos);
		const marker = measure.marker?.text?.trim();
		bars.push({
			i: i + 1,
			t: Math.round(startMs),
			d: Math.max(1, Math.round(endMs - startMs)),
			marker: marker ? marker.slice(0, 48) : void 0,
			sig: `${sig[0]}/${sig[1]}`
		});
		(measure.voices ?? []).forEach((voice, vi) => {
			const bucket = voiceSounds[vi] ??= [];
			let q = qStart;
			for (const beat of voice.beats ?? []) {
				const bq = beatQuarters(beat);
				const grace = Boolean(beat.graceNote || beat.grace);
				const at = grace ? Math.max(qStart, q - .045) : q;
				const viewNotes = [];
				for (const note of beat.notes ?? []) {
					if (note.rest || note.fret == null || note.string == null) continue;
					const fret = note.fret;
					const midi = midiOf(kind, tuning, fret, note.string);
					if (midi == null) continue;
					viewNotes.push({
						s: kind === 2 ? drumLine(fret) : note.string,
						f: fret,
						m: midi,
						tie: note.tie || void 0,
						art: artOf(note),
						ghost: note.ghost || void 0
					});
					if (vocal) continue;
					const dead = Boolean(note.dead);
					if (note.tie && kind !== 2 && extendTie(bucket, note.string, midi, q + Math.max(bq, .05))) continue;
					const staccato = Boolean(note.staccato);
					const span = grace ? .07 : staccato || dead ? Math.max(.08, bq * .42) : Math.max(bq, .05);
					if (kind !== 2) stretchRing(bucket, note.string, at);
					bucket.push({
						s: note.string,
						m: midi,
						q: at,
						endQ: at + span,
						v: velocityGain(beat.velocity, Boolean(note.ghost), dead) * (note.hp ? .84 : 1),
						z: dead ? 2 : keys ? 1 : void 0,
						ring: Boolean(beat.letRing) && !staccato && !dead && !grace && kind !== 2
					});
				}
				if (viewNotes.length || beat.chord?.text) {
					const t = quarterToMs(at, master.tempos);
					const end = quarterToMs(at + Math.max(bq, .1), master.tempos);
					events.push({
						t: Math.round(t),
						d: Math.max(36, Math.round(end - t)),
						chord: beat.chord?.text?.trim() || void 0,
						notes: viewNotes
					});
				}
				q += bq;
			}
		});
	}
	const notes = [];
	for (const bucket of voiceSounds) for (const item of bucket) {
		if (item.ring) item.endQ += .65;
		const t = quarterToMs(item.q, master.tempos);
		const end = quarterToMs(item.endQ, master.tempos);
		const mix = {
			t: Math.round(t),
			d: Math.max(36, Math.round(end - t)),
			m: item.m,
			k: kind,
			track: trackIndex,
			v: item.v
		};
		if (kind !== 2 && Number.isInteger(item.s)) mix.s = item.s;
		if (item.z) mix.z = item.z;
		notes.push(mix);
	}
	events.sort((a, b) => a.t - b.t);
	notes.sort((a, b) => a.t - b.t);
	return {
		view: {
			trackIndex,
			name,
			instrument,
			instrumentId,
			strings: kind === 2 ? 6 : strings,
			tuning: kind === 2 ? null : tuning,
			kind,
			vocal,
			durationMs: songMs,
			bars,
			events
		},
		notes
	};
}
function compileSong(parts, indices) {
	const master = buildMaster(parts);
	const durationMs = Math.max(1, Math.round(quarterToMs(master.totalQ, master.tempos)));
	const views = /* @__PURE__ */ new Map();
	const mix = [];
	parts.forEach((part, i) => {
		const trackIndex = indices[i] ?? i;
		const compiled = compileTrack(part, trackIndex, master, durationMs);
		views.set(trackIndex, compiled.view);
		if (!compiled.view.vocal && compiled.notes.length) mix.push(...compiled.notes);
	});
	mix.sort((a, b) => a.t - b.t || a.track - b.track);
	return {
		views,
		mix,
		durationMs
	};
}
function songsterrUrl(artist, title, songId) {
	const slug = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	return `https://www.songsterr.com/a/wsa/${slug(artist) || "artist"}-${slug(title) || "tab"}-tab-s${songId}`;
}
var NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B"
];
function pitchName(midi) {
	return NOTE_NAMES[(Math.round(midi) % 12 + 12) % 12];
}
function tabStringLabel(midi) {
	const name = pitchName(midi);
	if (name === "E" && midi >= 64) return "e";
	return name;
}
function formatTime(ms) {
	if (!Number.isFinite(ms) || ms < 0) ms = 0;
	const total = Math.floor(ms / 1e3);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}
function drumLine(midi) {
	if (midi === 49 || midi === 52 || midi === 55 || midi === 57) return 0;
	if (midi === 51 || midi === 53 || midi === 59) return 1;
	if (midi === 42 || midi === 44 || midi === 46) return 0;
	if (midi === 38 || midi === 40 || midi === 37 || midi === 39) return 2;
	if (midi === 41 || midi === 43 || midi === 45 || midi === 47 || midi === 48 || midi === 50) return 3;
	if (midi === 35 || midi === 36) return 5;
	return 4;
}
function drumGlyph(midi) {
	if (midi === 35 || midi === 36) return "K";
	if (midi === 38 || midi === 40) return "S";
	if (midi === 42 || midi === 44) return "x";
	if (midi === 46) return "o";
	if (midi === 49 || midi === 52 || midi === 55 || midi === 57) return "C";
	if (midi === 51 || midi === 53 || midi === 59) return "R";
	if (midi === 41 || midi === 43 || midi === 45 || midi === 47 || midi === 48 || midi === 50) return "T";
	return "·";
}
var DRUM_LABELS = [
	"C",
	"R",
	"S",
	"T",
	"·",
	"K"
];
function drumLaneLabel(line) {
	return DRUM_LABELS[line] ?? "·";
}
function barAt(bars, ms) {
	if (!bars.length) return null;
	let lo = 0;
	let hi = bars.length - 1;
	while (lo < hi) {
		const mid = lo + hi + 1 >> 1;
		if (bars[mid].t <= ms) lo = mid;
		else hi = mid - 1;
	}
	return bars[lo];
}
//#endregion
export { formatTime as a, drumLaneLabel as i, compileSong as n, songsterrUrl as o, drumGlyph as r, tabStringLabel as s, barAt as t };
