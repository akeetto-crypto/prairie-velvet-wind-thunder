import type { Bar, MixNote } from "@/lib/timeline";

const LOOKAHEAD_MS = 200;
const MAX_VOICES = 72;

type Voice = {
  end: number;
  peak: number;
  gain: GainNode;
  stop: () => void;
  choke: (time: number) => void;
};

/**
 * One clock for every track. Notes are scheduled from the same AudioContext
 * origin, so guitar, bass and drums cannot drift apart once their times match.
 */
export class BandEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private clickBus: GainNode | null = null;
  private trackVolume = 1;
  private metronomeVolume = 0.65;
  private pcm = new Map<string, Float32Array>();
  private buffers = new Map<string, AudioBuffer>();
  private notes: MixNote[] = [];
  private focus = 0;
  private vocal = new Set<number>();
  private muted = new Set<number>();
  private metronome = false;
  private clicks: Array<{ t: number; accent: boolean }> = [];
  private clickCursor = 0;
  private playing = false;
  private speed = 1;
  private originAudio = 0;
  private originSong = 0;
  private pausedAt = 0;
  private scheduledUntil = 0;
  private cursor = 0;
  private live: Voice[] = [];
  private strings = new Map<string, Voice>();
  private openHat: Voice | null = null;
  private timer = 0;
  private epoch = 0;

  get suspended(): boolean {
    return !this.ctx || this.ctx.state !== "running";
  }

  load(notes: MixNote[], focus: number, vocalTracks: number[]): void {
    this.notes = notes;
    this.focus = focus;
    this.vocal = new Set(vocalTracks);
    this.cursor = 0;
    this.scheduledUntil = 0;
    this.silence();
    if (this.ctx) this.warm(notes);
  }

  setFocus(track: number): void {
    this.focus = track;
  }

  setMutedTracks(tracks: number[]): void {
    this.muted = new Set(tracks);
  }

  setTrackVolume(value: number): void {
    this.trackVolume = clampVolume(value);
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0.82 * this.trackVolume, this.ctx.currentTime, 0.02);
  }

  setMetronomeVolume(value: number): void {
    this.metronomeVolume = clampVolume(value);
    if (this.ctx && this.clickBus) this.clickBus.gain.setTargetAtTime(this.metronomeVolume, this.ctx.currentTime, 0.02);
  }

  setMetronome(enabled: boolean): void {
    this.metronome = enabled;
    this.clickCursor = this.seekClick(this.position());
  }

  setMetronomeGrid(bars: Bar[]): void {
    const clicks: Array<{ t: number; accent: boolean }> = [];
    for (const bar of bars) {
      const [numerator, denominator] = bar.sig.split("/").map(Number);
      const beats = Math.max(1, Math.min(12, numerator || 4));
      const beatMs = bar.d / beats;
      for (let beat = 0; beat < beats; beat++) {
        if (denominator === 8 && beats >= 6 && beat % 3 !== 0) continue;
        clicks.push({ t: bar.t + beat * beatMs, accent: beat === 0 });
      }
    }
    this.clicks = clicks;
    this.clickCursor = this.seekClick(this.position());
  }

  countIn(beatMs: number, beats = 4): void {
    if (!this.ctx || !this.playing || !Number.isFinite(beatMs) || beatMs <= 0) return;
    for (let beat = beats; beat > 0; beat--) {
      const when = this.originAudio - (beat * beatMs) / (1000 * this.speed);
      this.scheduleClickAt(when, beat === beats);
    }
  }

  async unlock(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume();
    this.warm(this.notes);
  }

  position(): number {
    if (!this.playing || !this.ctx) return this.pausedAt;
    if (this.ctx.currentTime < this.originAudio) return this.originSong;
    return Math.max(0, this.originSong + (this.ctx.currentTime - this.originAudio) * 1000 * this.speed);
  }

  play(fromMs: number, startAtMs = Date.now()): void {
    const ctx = this.ensure();
    void ctx.resume();
    this.warm(this.notes);
    this.silence();
    this.playing = true;
    this.originSong = Math.max(0, fromMs);
    this.originAudio = ctx.currentTime + Math.max(0, startAtMs - Date.now()) / 1000 + 0.04;
    this.scheduledUntil = this.originSong;
    this.cursor = this.seekIndex(this.originSong);
    this.clickCursor = this.seekClick(this.originSong);
    this.pausedAt = this.originSong;
    this.kick();
  }

  pause(): number {
    const pos = this.playing ? this.position() : this.pausedAt;
    this.playing = false;
    this.pausedAt = Math.max(0, pos);
    this.silence();
    return this.pausedAt;
  }

  seek(ms: number): void {
    const was = this.playing;
    const clamped = Math.max(0, ms);
    if (was) this.play(clamped);
    else {
      this.pausedAt = clamped;
      this.silence();
    }
  }

  setSpeed(speed: number, atMs?: number): void {
    const pos = atMs ?? this.position();
    this.speed = clampSpeed(speed);
    if (this.playing) this.play(pos);
    else this.pausedAt = pos;
  }

  correct(desiredMs: number): "ok" | "nudge" | "seek" {
    const err = desiredMs - this.position();
    const abs = Math.abs(err);
    if (abs < 45) return "ok";
    if (abs < 120 && this.playing && this.ctx) {
      const now = this.ctx.currentTime;
      this.originSong = desiredMs - (now - this.originAudio) * 1000 * this.speed;
      if (desiredMs + 20 < this.scheduledUntil) this.scheduledUntil = this.position();
      return "nudge";
    }
    this.seek(desiredMs);
    return "seek";
  }

  destroy(): void {
    this.silence();
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.clickBus = null;
    this.buffers.clear();
  }

  private ensure(): AudioContext {
    if (this.ctx && this.master && this.clickBus) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.82 * this.trackVolume;
    const clickBus = ctx.createGain();
    clickBus.gain.value = this.metronomeVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 16;
    comp.ratio.value = 2.6;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    master.connect(comp);
    clickBus.connect(comp);
    comp.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.clickBus = clickBus;
    return ctx;
  }

  private warm(notes: MixNote[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const want = new Set<string>();
    for (const note of notes) {
      const key = bufferKey(note);
      if (key) want.add(key);
    }
    for (const key of want) this.buffer(ctx, key);
  }

  private kick(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 24);
    this.tick();
  }

  private seekIndex(ms: number): number {
    let lo = 0;
    let hi = this.notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.notes[mid].t < ms) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private tick(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    const epoch = this.epoch;
    const nowSong = this.position();
    const horizon = nowSong + LOOKAHEAD_MS;
    if (this.cursor > 0 && this.notes[this.cursor - 1] && this.notes[this.cursor - 1].t > nowSong + 50) {
      this.cursor = this.seekIndex(nowSong);
    }
    if (this.scheduledUntil > horizon + 40) return;
    const from = Math.max(this.scheduledUntil - 8, nowSong - 20);
    while (this.cursor < this.notes.length && this.notes[this.cursor].t < horizon) {
      const note = this.notes[this.cursor++];
      if (epoch !== this.epoch) return;
      if (note.t < from) continue;
      this.schedule(note);
    }
    if (this.metronome) {
      while (this.clickCursor < this.clicks.length && this.clicks[this.clickCursor].t < horizon) {
        const click = this.clicks[this.clickCursor++];
        if (click.t >= from) this.scheduleClick(click.t, click.accent);
      }
    }
    this.scheduledUntil = horizon;
    this.gc();
  }

  private gainFor(note: MixNote): number {
    const vel = note.v ?? 0.9;
    if (this.muted.has(note.track)) return 0;
    if (this.vocal.has(note.track)) return 0;
    if (note.z === 2) return (note.track === this.focus ? 0.22 : 0.12) * vel;
    if (note.track === this.focus) {
      if (note.k === 2) return 0.42 * vel;
      if (note.k === 1) return 0.34 * vel;
      if (note.z === 1) return 0.26 * vel;
      return 0.22 * vel;
    }
    if (note.k === 2) return 0.3 * vel;
    if (note.k === 1) return 0.2 * vel;
    if (note.z === 1) return 0.12 * vel;
    return 0.09 * vel;
  }

  private seekClick(ms: number): number {
    let lo = 0;
    let hi = this.clicks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.clicks[mid].t < ms) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private scheduleClick(songMs: number, accent: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const when = this.originAudio + (songMs - this.originSong) / (1000 * this.speed);
    if (when < ctx.currentTime - 0.06) return;
    this.scheduleClickAt(when, accent);
  }

  private scheduleClickAt(when: number, accent: boolean): void {
    const ctx = this.ctx;
    const clickBus = this.clickBus;
    if (!ctx || !clickBus || when < ctx.currentTime - 0.06) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(accent ? 1500 : 1050, when);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, when + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    osc.connect(amp);
    amp.connect(clickBus);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  private schedule(note: MixNote): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const peak = this.gainFor(note);
    if (peak <= 0.001) return;
    const key = bufferKey(note);
    if (!key) return;
    const audio = this.buffer(ctx, key);
    if (!audio) return;

    const when = this.originAudio + (note.t - this.originSong) / (1000 * this.speed);
    if (when < ctx.currentTime - 0.06) return;
    const start = Math.max(when, ctx.currentTime + 0.005);
    const dur = Math.max(0.045, Math.min(3.1, note.d / 1000 / this.speed));

    if (this.live.length > MAX_VOICES) this.gc();
    if (this.live.length > MAX_VOICES && note.track !== this.focus && note.k !== 2) return;

    const src = ctx.createBufferSource();
    src.buffer = audio;
    const amp = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = panFor(note, this.focus);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.006);
    const release = note.k === 2 ? 0.03 : 0.045;
    const hold = start + Math.max(0.02, dur - release);
    amp.gain.setValueAtTime(Math.max(peak, 0.0002), hold);
    amp.gain.exponentialRampToValueAtTime(0.0001, hold + release);
    src.connect(amp);
    amp.connect(pan);
    pan.connect(master);
    src.start(start);
    const stopAt = start + dur + 0.06;
    src.stop(stopAt);

    const voice: Voice = {
      end: stopAt,
      peak,
      gain: amp,
      stop: () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      },
      choke: (time: number) => {
        const at = Math.max(time, ctx.currentTime);
        try {
          amp.gain.cancelScheduledValues(at);
          amp.gain.setValueAtTime(Math.max(0.0002, peak * 0.65), at);
          amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.018);
        } catch {
          /* node gone */
        }
      },
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

  private buffer(ctx: AudioContext, key: string): AudioBuffer | null {
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

  private gc(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.live.length < 16) return;
    this.live = this.live.filter((voice) => voice.end > now - 0.02);
  }

  private silence(): void {
    this.epoch++;
    for (const voice of this.live) voice.stop();
    this.live = [];
    this.strings.clear();
    this.openHat = null;
    this.scheduledUntil = 0;
    window.clearInterval(this.timer);
    this.timer = 0;
  }
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(1.25, Math.max(0.5, Math.round(speed * 100) / 100));
}

function panFor(note: MixNote, focus: number): number {
  if (note.k === 2 || note.k === 1) return 0;
  if (note.track === focus) return -0.12;
  return 0.2;
}

function bufferKey(note: MixNote): string | null {
  if (!Number.isFinite(note.m)) return null;
  if (note.z === 2) return "chuck";
  if (note.k === 2) return `d${drumClass(note.m)}`;
  const midi = Math.max(20, Math.min(108, Math.round(note.m)));
  if (note.k === 1) return `b${midi}`;
  if (note.z === 1) return `k${midi}`;
  return `g${midi}`;
}

function drumClass(midi: number): string {
  if (midi === 35 || midi === 36) return "kick";
  if (midi === 38 || midi === 40 || midi === 37 || midi === 39) return "snare";
  if (midi === 42 || midi === 44) return "hat";
  if (midi === 46) return "ohat";
  if (midi === 49 || midi === 52 || midi === 55 || midi === 57) return "crash";
  if (midi === 51 || midi === 53 || midi === 59) return "ride";
  if (midi >= 41 && midi <= 50) return `tom${midi}`;
  return `perc${midi}`;
}

function renderKey(key: string, sr: number): Float32Array | null {
  if (key === "chuck") return renderChuck(sr);
  if (key.startsWith("d")) return renderDrum(key.slice(1), sr);
  const midi = Number(key.slice(1));
  if (!Number.isFinite(midi)) return null;
  if (key.startsWith("b")) return renderBass(sr, midi);
  if (key.startsWith("k")) return renderKeys(sr, midi);
  return renderGuitar(sr, midi);
}

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function normalize(buf: Float32Array, peak = 0.92): void {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  if (max < 1e-5) return;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
}

function fadeEnds(buf: Float32Array, sr: number): void {
  const a = Math.min(buf.length, Math.floor(sr * 0.004));
  const b = Math.min(buf.length, Math.floor(sr * 0.02));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
}

function karplus(sr: number, freq: number, length: number, decay: number, passes: number): Float32Array {
  const n = Math.max(8, length);
  const period = Math.max(2, Math.round(sr / Math.max(30, freq)));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
  const pick = Math.floor(period * 0.22);
  for (let i = 0; i < period; i++) line[i] -= line[(i + pick) % period] * 0.72;
  for (let pass = 0; pass < passes; pass++) {
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const x = line[i];
      line[i] = (x + prev) * 0.5;
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
    line[idx] = decay * (0.52 * y + 0.48 * next);
    dc = dc * 0.996 + y * 0.004;
    buf[i] = y - dc;
    idx++;
    if (idx >= period) idx = 0;
  }
  return buf;
}

function renderGuitar(sr: number, midi: number): Float32Array {
  const freq = midiFreq(midi);
  const seconds = freq < 180 ? 2.8 : freq < 360 ? 2.3 : 1.7;
  const n = Math.floor(sr * seconds);
  const decay = freq < 160 ? 0.9975 : freq < 320 ? 0.994 : 0.988;
  const buf = karplus(sr, freq, n, decay, freq > 500 ? 1 : 2);
  const click = Math.floor(sr * 0.007);
  for (let i = 0; i < click; i++) {
    const env = Math.exp(-i / (sr * 0.0018));
    buf[i] += (Math.random() * 2 - 1) * 0.22 * env;
  }
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    buf[i] += Math.sin((2 * Math.PI * freq * t) ) * 0.07 * Math.exp(-t * 5.5);
    buf[i] = Math.tanh(buf[i] * 1.25);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.9);
  return buf;
}

function renderBass(sr: number, midi: number): Float32Array {
  const freq = midiFreq(midi);
  const n = Math.floor(sr * 2.4);
  const pluck = karplus(sr, freq, n, 0.997, 4);
  const buf = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = freq * (1 + 0.02 * Math.exp(-t * 36));
    phase += (2 * Math.PI * f) / sr;
    const body = Math.sin(phase) * (0.78 * Math.exp(-t * 1.15) + 0.22);
    const growl = Math.sin(phase * 2) * 0.22 * Math.exp(-t * 3.4);
    const edge = Math.sin(phase * 3) * 0.07 * Math.exp(-t * 8);
    const finger = Math.sin(phase * 5) * 0.045 * Math.exp(-t * 18);
    buf[i] = body + growl + edge + finger + pluck[i] * 0.18;
  }
  let lp = 0;
  const cut = Math.exp((-2 * Math.PI * 680) / sr);
  for (let i = 0; i < n; i++) {
    lp += (1 - cut) * (buf[i] - lp);
    buf[i] = Math.tanh(lp * 1.35);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.95);
  return buf;
}

function renderKeys(sr: number, midi: number): Float32Array {
  const freq = midiFreq(midi);
  const n = Math.floor(sr * 2.6);
  const buf = new Float32Array(n);
  const amps = [1, 0.52, 0.24, 0.12, 0.07, 0.04];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let h = 0; h < amps.length; h++) {
      s += Math.sin(2 * Math.PI * freq * (h + 1) * t) * amps[h] * Math.exp(-t * (1.6 + h * 1.7));
    }
    const hammer = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.18;
    buf[i] = Math.tanh((s * 0.7 + hammer) * 1.15);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.88);
  return buf;
}

function renderChuck(sr: number): Float32Array {
  const n = Math.floor(sr * 0.09);
  const buf = new Float32Array(n);
  let dull = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    dull = dull * 0.8 + noise * 0.2;
    buf[i] = (noise - dull) * Math.exp(-t * 48);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.75);
  return buf;
}

function noiseHat(sr: number, dur: number, decay: number, cutoff: number, metal: number): Float32Array {
  const n = Math.floor(sr * dur);
  const buf = new Float32Array(n);
  const ratios = [1, 1.42, 1.67, 1.94, 2.27, 2.71, 3.19, 3.83];
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
      phases[k] += (2 * Math.PI * base * ratios[k]) / sr;
      tone += Math.sin(phases[k]) / (1 + k * 0.45);
    }
    const mixed = (Math.random() * 2 - 1) * 0.75 + tone * metal;
    const out = alpha * (prevOut + mixed - prevIn);
    prevIn = mixed;
    prevOut = out;
    buf[i] = out * Math.exp(-t * decay);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.8);
  return buf;
}

function renderDrum(kind: string, sr: number): Float32Array {
  if (kind === "kick") return renderKick(sr);
  if (kind === "snare") return renderSnare(sr);
  if (kind === "hat") return noiseHat(sr, 0.055, 62, 7200, 0.18);
  if (kind === "ohat") return noiseHat(sr, 0.38, 8.5, 5600, 0.28);
  if (kind === "crash") return noiseHat(sr, 1.35, 2.4, 4800, 0.55);
  if (kind === "ride") return noiseHat(sr, 1.05, 3.1, 5200, 0.42);
  if (kind.startsWith("tom")) {
    const midi = Number(kind.slice(3)) || 47;
    return renderTom(sr, 70 + (50 - midi) * 6);
  }
  return noiseHat(sr, 0.12, 28, 2500, 0.2);
}

function renderKick(sr: number): Float32Array {
  const n = Math.floor(sr * 0.48);
  const buf = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 46 + 155 * Math.exp(-t * 26);
    phase += (2 * Math.PI * f) / sr;
    const body = Math.sin(phase) * Math.exp(-t * 6.2);
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 210) * 0.35;
    const sub = Math.sin(2 * Math.PI * 50 * t) * Math.exp(-t * 4.2) * 0.45;
    buf[i] = Math.tanh((body * 0.95 + sub + click) * 1.2);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.98);
  return buf;
}

function renderSnare(sr: number): Float32Array {
  const n = Math.floor(sr * 0.32);
  const buf = new Float32Array(n);
  let bp = 0;
  let hp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    bp += 0.18 * (noise - bp);
    hp = noise - bp;
    const snap = hp * Math.exp(-t * 23);
    const body = bp * Math.exp(-t * 16) * 0.65;
    const tone = Math.sin(2 * Math.PI * 186 * t) * Math.exp(-t * 28) * 0.55;
    const ring = Math.sin(2 * Math.PI * 332 * t) * Math.exp(-t * 36) * 0.22;
    buf[i] = snap * 0.7 + body + tone + ring;
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.9);
  return buf;
}

function renderTom(sr: number, freq: number): Float32Array {
  const n = Math.floor(sr * 0.42);
  const buf = new Float32Array(n);
  let phase = 0;
  const f0 = Math.max(70, Math.min(240, freq));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f0 * (1 + 0.55 * Math.exp(-t * 22));
    phase += (2 * Math.PI * f) / sr;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.18;
    buf[i] = Math.tanh(Math.sin(phase) * Math.exp(-t * 7.5) + noise);
  }
  fadeEnds(buf, sr);
  normalize(buf, 0.9);
  return buf;
}
