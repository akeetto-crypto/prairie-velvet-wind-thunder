import { memo, useEffect, useRef } from "react";
import { barAt, drumLaneLabel, tabStringLabel, type PartView, type Rhythm, type ViewNote } from "@/lib/timeline";

const BG = "#1a1b1e";
const GUTTER_BG = "#141518";
const LINE = "#3c4048";
const BAR = "#9aa1ab";
const FRET = "#f3f4f6";
const FRET_DIM = "#8d939c";
const ACTIVE = "#ffb020";
const CHORD = "#f7f7f8";
const MARKER = "#8eb7ff";
const NUM = "#8b919a";
const CURSOR = "#ff9a1f";

const GUTTER = 54;

function layoutAt(view: PartView, pos: number, width: number, height: number) {
  const drums = view.kind === 2;
  const strings = drums ? 5 : Math.max(4, view.strings);
  const header = drums ? 0 : 56;
  const footer = drums ? 0 : Math.max(56, Math.min(110, height * 0.22));
  const usable = Math.max(strings * 16, height - header - footer);
  const gap = drums ? Math.min(18, Math.max(12, (height - 80) / 4)) : Math.max(16, Math.min(44, usable / Math.max(1, strings - 1)));
  const staffH = (strings - 1) * gap;
  const top = drums ? Math.max(44, (height - staffH) / 2) : header + Math.max(0, (usable - staffH) / 2);
  const bar = barAt(view.bars, pos) ?? view.bars[0];
  const barPx = Math.min(560, Math.max(200, width * 0.34));
  const pxPerMs = bar && bar.d > 0 ? barPx / bar.d : 0.08;
  const playX = Math.max(GUTTER + 28, Math.min(width * 0.2, 220));
  return { strings, gap, top, pxPerMs, playX, bottom: top + staffH };
}

export const TabStage = memo(function TabStage({
  view,
  getPosition,
  onSeek,
}: {
  view: PartView | null;
  getPosition: { current: () => number };
  onSeek: { current: (ms: number, commit: boolean) => void };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
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
      const box = layoutAt(current, pos, w, h);
      const { strings, gap, top, pxPerMs, playX, bottom } = box;
      const fretPx = Math.round(Math.min(20, Math.max(13, gap * 0.46)));
      const yOf = (s: number) => top + s * gap;
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
        ctx.globalAlpha = 0.55;
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
        if (current.kind !== 2) {
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
      const beamed = new Set<number>();
      for (let eventIndex = 0; eventIndex < current.events.length; eventIndex++) {
        const ev = current.events[eventIndex];
        if (ev.t + ev.d < t0 - 40 || ev.t > t1 + 20) continue;
        const x = playX + (ev.t - pos) * pxPerMs;
        const hot = ev.t <= pos + 30 && pos < ev.t + Math.max(ev.d, 70);
        const next = current.events[eventIndex + 1];
        const eventBar = barAt(current.bars, ev.t);
        const nextBar = next ? barAt(current.bars, next.t) : null;
        const sameBar = next && eventBar && nextBar && nextBar.i === eventBar.i;
        const [beatsInBar, denominator] = (eventBar?.sig ?? "4/4").split("/").map(Number);
        const compound = denominator === 8 && beatsInBar % 3 === 0;
        const beatGroups = compound ? beatsInBar / 3 : beatsInBar;
        const groupDuration = eventBar && beatGroups > 0 ? eventBar.d / beatGroups : 0;
        const sameBeatGroup = Boolean(next && eventBar && groupDuration > 0
          && Math.floor((ev.t - eventBar.t) / groupDuration) === Math.floor((next.t - eventBar.t) / groupDuration));
        const canBeam = !ev.rest && ev.rhythm.base >= 8 && next && !next.rest
          && next.rhythm.base === ev.rhythm.base && sameBar && sameBeatGroup
          && Math.abs(ev.t + ev.d - next.t) < 45;
        const beamedFromPrevious = beamed.has(eventIndex);
        if (current.kind === 2) {
          drawDrumEvent(ctx, x, top, bottom, gap, ev.notes, ev.rhythm, Boolean(ev.rest), canBeam ? playX + (next!.t - pos) * pxPerMs : undefined, beamedFromPrevious);
        } else {
          drawTabRhythm(
            ctx, x, top, bottom, gap, ev.rhythm, Boolean(ev.rest),
            canBeam ? playX + (next!.t - pos) * pxPerMs : undefined,
            beamedFromPrevious, h - bottom,
          );
        }
        if (canBeam) beamed.add(eventIndex + 1);
        if (ev.chord) {
          ctx.fillStyle = hot ? ACTIVE : CHORD;
          ctx.font = "700 14px Manrope, sans-serif";
          ctx.fillText(ev.chord, x, top - 16);
        }
        ctx.font = `${hot ? 700 : 600} ${fretPx}px Manrope, sans-serif`;
        for (const note of ev.notes) {
          if (current.kind === 2 || note.s < 0 || note.s > strings - 1) continue;
          const y = yOf(note.s);
          const noteColor = note.tie ? FRET_DIM : hot ? ACTIVE : FRET;
          const glyph = note.ghost ? `(${note.f})` : String(note.f);
          const width = ctx.measureText(glyph).width;
          const plate = Math.max(16, fretPx);
          ctx.fillStyle = BG;
          ctx.fillRect(x - width / 2 - 4, y - plate / 2, width + 8, plate);
          ctx.fillStyle = note.tie ? FRET_DIM : hot ? ACTIVE : FRET;
          ctx.fillText(glyph, x, y + 0.5);
          for (let dot = 0; dot < ev.rhythm.dots; dot++) {
            ctx.beginPath();
            ctx.arc(x + width / 2 + 5 + dot * 4, y - 1, 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
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
      ctx.moveTo(GUTTER - 0.5, 0);
      ctx.lineTo(GUTTER - 0.5, h);
      ctx.stroke();
      ctx.strokeStyle = LINE;
      ctx.beginPath();
      for (let s = 0; s < strings; s++) {
        const y = yOf(s);
        ctx.moveTo(10, y);
        ctx.lineTo(GUTTER - 8, y);
      }
      ctx.stroke();
      ctx.fillStyle = "#c6cbd3";
      ctx.font = "700 12px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (current.kind === 2) {
        for (let lane = 0; lane < 7; lane++) {
          ctx.fillText(drumLaneLabel(lane), 28, drumY(lane, top, gap));
        }
      } else if (current.tuning) {
        current.tuning.forEach((midi, i) => {
          if (i < strings) ctx.fillText(tabStringLabel(midi), 28, yOf(i));
        });
      }
      if (current.kind !== 2 && here) {
        const [numerator, denominator] = here.sig.split("/");
        ctx.font = "700 11px Manrope, sans-serif";
        ctx.fillStyle = "#c6cbd3";
        ctx.fillText(numerator, 28, top - 18);
        ctx.fillText(denominator, 28, top - 5);
      }

      ctx.strokeStyle = CURSOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, top - 22);
      ctx.lineTo(playX, current.kind === 2 ? drumY(6, top, gap) + 8 : bottom + 10);
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

  const seekFrom = (clientX: number, commit: boolean) => {
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

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none bg-[#1a1b1e]"
      aria-label="Табулатура"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFrom(event.clientX, false);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFrom(event.clientX, false);
      }}
      onPointerUp={(event) => seekFrom(event.clientX, true)}
      onPointerCancel={(event) => seekFrom(event.clientX, true)}
    />
  );
});

export function useBarLabel(view: PartView | null, ms: number): string {
  const bar = view ? barAt(view.bars, ms) : null;
  if (!bar) return "";
  return bar.marker ? `Такт ${bar.i} · ${bar.marker}` : `Такт ${bar.i}`;
}

function drumY(lane: number, top: number, gap: number): number {
  // Five-line percussion staff: cymbals sit above or on the top line,
  // toms descend through the staff, and the kick sits just below it.
  const positions = [
    top - gap * 0.5,
    top,
    top + gap * 0.5,
    top + gap * 2,
    top + gap * 3,
    top + gap * 3.5,
    top + gap * 4.5,
  ];
  return positions[Math.max(0, Math.min(6, lane))];
}

function rhythmicFlags(rhythm: Rhythm): number {
  return rhythm.base >= 8 ? Math.round(Math.log2(rhythm.base / 4)) : 0;
}

function drawTabRhythm(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  gap: number,
  rhythm: Rhythm,
  rest: boolean,
  beamTo?: number,
  beamedFromPrevious = false,
  availableHeight = 40,
): void {
  const y = bottom;
  const restY = top + gap * 2;
  ctx.save();
  ctx.strokeStyle = FRET;
  ctx.fillStyle = FRET;
  ctx.lineWidth = 1.4;
  if (rest) {
    const restPosition = rhythm.base === 1 ? restY + gap * 0.5 : restY - gap * 0.5;
    if (rhythm.base <= 2) {
      ctx.fillRect(x - 4, restPosition - 2, 8, 4);
    } else if (rhythm.base === 4) {
      ctx.beginPath();
      ctx.moveTo(x + 1, restY - 12);
      ctx.lineTo(x - 3, restY - 5);
      ctx.lineTo(x + 3, restY - 1);
      ctx.lineTo(x - 2, restY + 5);
      ctx.lineTo(x + 2, restY + 12);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 1, restY - 12);
      ctx.lineTo(x - 3, restY - 5);
      ctx.lineTo(x + 3, restY - 1);
      ctx.lineTo(x - 2, restY + 5);
      ctx.stroke();
      for (let flag = 0; flag < rhythmicFlags(rhythm); flag++) {
        const flagY = restY + 3 + flag * 4;
        ctx.beginPath();
        ctx.moveTo(x - 2, flagY);
        ctx.quadraticCurveTo(x + 5, flagY + 2, x + 2, flagY + 7);
        ctx.stroke();
      }
    }
    for (let dot = 0; dot < rhythm.dots; dot++) {
      ctx.fillRect(x + 7 + dot * 4, restY - 1, 2, 2);
    }
    if (rhythm.tuplet) {
      ctx.font = "600 9px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(rhythm.tuplet), x, restY + gap);
    }
    ctx.restore();
    return;
  }
  if (rhythm.base === 1) {
    ctx.restore();
    return;
  }
  const stemLength = Math.max(14, Math.min(gap * 1.75, availableHeight - 8));
  const endY = y + stemLength;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, endY); ctx.stroke();
  if (beamTo != null) {
    const levels = rhythmicFlags(rhythm);
    for (let level = 0; level < levels; level++) {
      const beamY = endY - level * 4;
      ctx.fillRect(Math.min(x, beamTo), beamY, Math.abs(beamTo - x), 2.4);
    }
  } else if (!beamedFromPrevious) {
    for (let flag = 0; flag < rhythmicFlags(rhythm); flag++) {
      const flagY = endY - flag * 4;
      ctx.beginPath(); ctx.moveTo(x, flagY);
      ctx.quadraticCurveTo(x + 8, flagY + 4, x + 4, flagY + 9); ctx.stroke();
    }
  }
  if (rhythm.tuplet) {
    ctx.font = "600 9px Manrope, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(rhythm.tuplet), beamTo == null ? x : (x + beamTo) / 2, endY + 12);
  }
  ctx.restore();
}

function drawDrumRest(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  gap: number,
  rhythm: Rhythm,
): void {
  const middle = top + gap * 2;
  ctx.save();
  ctx.fillStyle = FRET;
  ctx.strokeStyle = FRET;
  ctx.lineWidth = 1.6;
  if (rhythm.base === 1 || rhythm.base === 2) {
    const y = rhythm.base === 1 ? middle + gap * 0.5 : middle - gap * 0.5;
    ctx.fillRect(x - 5, y - 2, 10, 4);
  } else if (rhythm.base === 4) {
    ctx.beginPath();
    ctx.moveTo(x + 1, middle - 12);
    ctx.lineTo(x - 3, middle - 5);
    ctx.lineTo(x + 3, middle - 1);
    ctx.lineTo(x - 2, middle + 5);
    ctx.lineTo(x + 2, middle + 11);
    ctx.stroke();
  } else {
    const flags = rhythmicFlags(rhythm);
    ctx.beginPath();
    ctx.moveTo(x + 1, middle - 12);
    ctx.lineTo(x - 3, middle - 5);
    ctx.lineTo(x + 3, middle - 1);
    ctx.lineTo(x - 2, middle + 5);
    ctx.stroke();
    for (let flag = 0; flag < flags; flag++) {
      const y = middle + 3 + flag * 4;
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.quadraticCurveTo(x + 5, y + 2, x + 2, y + 7);
      ctx.stroke();
    }
  }
  for (let dot = 0; dot < rhythm.dots; dot++) {
    ctx.fillRect(x + 7 + dot * 4, middle - 1, 2, 2);
  }
  if (rhythm.tuplet) {
    ctx.font = "600 9px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(rhythm.tuplet), x, middle + gap + 5);
  }
  ctx.restore();
}

function drawDrumEvent(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  gap: number,
  notes: ViewNote[],
  rhythm: Rhythm,
  rest: boolean,
  beamTo?: number,
  beamedFromPrevious = false,
): void {
  if (rest || notes.length === 0) {
    drawDrumRest(ctx, x, top, bottom, gap, rhythm);
    return;
  }

  const ys = notes.map((note) => drumY(note.s, top, gap));
  const stemX = x - 4;
  const stemStart = Math.min(...ys);
  const stemEnd = bottom + gap * 1.45;
  const whole = rhythm.base === 1;
  ctx.save();
  ctx.strokeStyle = FRET;
  ctx.fillStyle = FRET;
  ctx.lineWidth = 1.5;

  notes.forEach((note, index) => {
    const y = ys[index];
    const midi = Math.round(note.m);
    const samePositionBefore = notes.slice(0, index).some((prior) => drumY(prior.s, top, gap) === y);
    const noteX = x + (samePositionBefore ? (index % 2 ? 5 : -5) : 0);
    const cymbal = note.s <= 2;
    const openCymbal = [46, 49, 52, 55, 57].includes(midi);
    const bell = midi === 53;
    if (cymbal) {
      ctx.beginPath();
      ctx.moveTo(noteX - 4, y - 4);
      ctx.lineTo(noteX + 4, y + 4);
      ctx.moveTo(noteX + 4, y - 4);
      ctx.lineTo(noteX - 4, y + 4);
      ctx.stroke();
      if (openCymbal || bell) {
        ctx.beginPath();
        ctx.ellipse(noteX, y, 6.4, 5.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(noteX, y, 4.5, 3.3, -0.25, 0, Math.PI * 2);
      if (rhythm.base <= 2) ctx.stroke();
      else ctx.fill();
    }

    for (let dot = 0; dot < rhythm.dots; dot++) {
      ctx.fillRect(noteX + 7 + dot * 4, y - 1, 2, 2);
    }
  });

  if (!whole) {
    ctx.beginPath();
    ctx.moveTo(stemX, stemStart);
    ctx.lineTo(stemX, stemEnd);
    ctx.stroke();

    if (beamTo != null && rhythmicFlags(rhythm) > 0) {
      const nextStemX = beamTo - 4;
      for (let level = 0; level < rhythmicFlags(rhythm); level++) {
        const beamY = stemEnd - 2 - level * 4;
        ctx.fillRect(Math.min(stemX, nextStemX), beamY, Math.max(1, Math.abs(nextStemX - stemX)), 2.2);
      }
    } else if (!beamedFromPrevious) {
      for (let flag = 0; flag < rhythmicFlags(rhythm); flag++) {
        const flagY = stemEnd - flag * 4;
        ctx.beginPath();
        ctx.moveTo(stemX, flagY);
        ctx.quadraticCurveTo(stemX - 8, flagY - 4, stemX - 4, flagY - 9);
        ctx.stroke();
      }
    }
  }

  if (rhythm.tuplet) {
    ctx.font = "600 9px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(rhythm.tuplet), beamTo == null ? x : (x + beamTo) / 2, stemEnd + 11);
  }
  ctx.restore();
}
