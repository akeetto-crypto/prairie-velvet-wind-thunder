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
  const strings = view.kind === 2 ? 6 : Math.max(4, view.strings);
  const header = 88;
  const footer = 20;
  const usable = Math.max(strings * 16, height - header - footer);
  const gap = Math.max(16, Math.min(44, usable / Math.max(1, strings - 1)));
  const staffH = (strings - 1) * gap;
  const top = header + Math.max(0, (usable - staffH) / 2);
  const bar = barAt(view.bars, pos) ?? view.bars[0];
  const barPx = Math.min(560, Math.max(200, width * 0.34));
  const pxPerMs = bar && bar.d > 0 ? barPx / bar.d : 0.08;
  const playX = Math.max(GUTTER + 28, Math.min(width * 0.2, 220));
  return { strings, gap, top, staffH, pxPerMs, playX, bottom: top + staffH };
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
      drawNotationStaff(ctx, GUTTER, w);
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
        drawNotationEvent(ctx, x, current.kind, ev.notes, ev.rhythm, Boolean(ev.rest));
        if (ev.chord) {
          ctx.fillStyle = hot ? ACTIVE : CHORD;
          ctx.font = "700 14px Manrope, sans-serif";
          ctx.fillText(ev.chord, x, top - 16);
        }
        ctx.font = `${hot ? 700 : 600} ${fretPx}px Manrope, sans-serif`;
        for (const note of ev.notes) {
          if (note.s < 0 || note.s > strings - 1) continue;
          const y = yOf(note.s);
          const noteColor = note.tie ? FRET_DIM : hot ? ACTIVE : FRET;
          if (current.kind === 2) {
            drawDrumNote(ctx, x, y, note.m, noteColor, fretPx);
            continue;
          }
          const glyph = note.ghost ? `(${note.f})` : String(note.f);
          const width = ctx.measureText(glyph).width;
          const plate = Math.max(16, fretPx);
          ctx.fillStyle = BG;
          ctx.fillRect(x - width / 2 - 4, y - plate / 2, width + 8, plate);
          ctx.fillStyle = note.tie ? FRET_DIM : hot ? ACTIVE : FRET;
          ctx.fillText(glyph, x, y + 0.5);
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
        for (let s = 0; s < strings; s++) ctx.fillText(drumLaneLabel(s), 28, yOf(s));
      } else if (current.tuning) {
        current.tuning.forEach((midi, i) => {
          if (i < strings) ctx.fillText(tabStringLabel(midi), 28, yOf(i));
        });
      }

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

function drawDrumNote(ctx: CanvasRenderingContext2D, x: number, y: number, midi: number, color: string, size: number): void {
  const cymbal = [42, 44, 46, 49, 51, 52, 53, 55, 57, 59].includes(Math.round(midi));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  if (cymbal) {
    const r = Math.max(4, size * 0.22);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(4.5, size * 0.27), Math.max(3.5, size * 0.19), -0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const NOTATION_TOP = 15;
const NOTATION_GAP = 7;
const NOTE_STEPS = [0, 2, 4, 5, 7, 9, 11];

function drawNotationStaff(ctx: CanvasRenderingContext2D, left: number, right: number): void {
  ctx.save(); ctx.strokeStyle = BAR; ctx.globalAlpha = 0.72; ctx.lineWidth = 0.8;
  for (let line = 0; line < 5; line++) { const y = NOTATION_TOP + line * NOTATION_GAP; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); }
  ctx.restore();
}

function staffY(note: ViewNote, kind: number): number {
  if (kind === 2) { const ys=[NOTATION_TOP,NOTATION_TOP+1.5*NOTATION_GAP,NOTATION_TOP+2*NOTATION_GAP,NOTATION_TOP+3*NOTATION_GAP,NOTATION_TOP+3.5*NOTATION_GAP,NOTATION_TOP+4*NOTATION_GAP]; return ys[Math.max(0,Math.min(5,note.s))]; }
  const midi=Math.round(note.m), pc=((midi%12)+12)%12; let step=0, distance=Infinity;
  NOTE_STEPS.forEach((natural,index)=>{ const d=Math.min((pc-natural+12)%12,(natural-pc+12)%12); if(d<distance){distance=d;step=index;} });
  const diatonic=(Math.floor(midi/12)-1)*7+step, e4=4*7+2;
  return NOTATION_TOP+4*NOTATION_GAP-(diatonic-e4)*(NOTATION_GAP/2);
}

function drawNotationEvent(ctx: CanvasRenderingContext2D,x:number,kind:number,notes:ViewNote[],rhythm:Rhythm,rest:boolean):void {
  const center=NOTATION_TOP+2*NOTATION_GAP;
  if(rest||!notes.length){ctx.save();ctx.strokeStyle=FRET;ctx.lineWidth=2;ctx.beginPath();if(rhythm.base<=2){ctx.moveTo(x-5,center-1);ctx.lineTo(x+5,center-1);ctx.lineTo(x+5,center+3);ctx.lineTo(x-5,center+3);}else{ctx.moveTo(x+1,center-11);ctx.lineTo(x-3,center-5);ctx.lineTo(x+3,center-1);ctx.lineTo(x-2,center+5);ctx.lineTo(x+2,center+10);}ctx.stroke();ctx.restore();return;}
  const ys=notes.map(n=>staffY(n,kind)), avg=ys.reduce((a,b)=>a+b,0)/ys.length, up=avg>=center, stemX=x+(up?5:-5), filled=rhythm.base>=4;
  ctx.save();ctx.strokeStyle=FRET;ctx.fillStyle=FRET;ctx.lineWidth=1.35;
  notes.forEach((note,i)=>{const y=ys[i], nx=x+(i>0&&Math.abs(y-ys[i-1])<=NOTATION_GAP/2?(i%2?4:-4):0);if(kind===2&&[42,44,46,49,51,52,53,55,57,59].includes(Math.round(note.m))){ctx.beginPath();ctx.moveTo(nx-4,y-4);ctx.lineTo(nx+4,y+4);ctx.moveTo(nx+4,y-4);ctx.lineTo(nx-4,y+4);ctx.stroke();}else{ctx.beginPath();ctx.ellipse(nx,y,4.5,3.2,-0.28,0,Math.PI*2);if(filled)ctx.fill();else ctx.stroke();}
    if(y<NOTATION_TOP-1||y>NOTATION_TOP+4*NOTATION_GAP+1){const ledger=Math.round((y-(NOTATION_TOP+4*NOTATION_GAP))/(NOTATION_GAP/2));for(let l=0;l<=Math.abs(ledger);l++){const ly=NOTATION_TOP+4*NOTATION_GAP+Math.sign(ledger)*l*(NOTATION_GAP/2);if(ly<NOTATION_TOP-1||ly>NOTATION_TOP+4*NOTATION_GAP+1){ctx.beginPath();ctx.moveTo(nx-7,ly);ctx.lineTo(nx+7,ly);ctx.stroke();}}}
  });
  if(rhythm.base!==1){const top=Math.min(...ys),bottom=Math.max(...ys),end=up?Math.min(top-28,NOTATION_TOP-6):Math.max(bottom+28,NOTATION_TOP+4*NOTATION_GAP+6);ctx.beginPath();ctx.moveTo(stemX,up?bottom:top);ctx.lineTo(stemX,end);ctx.stroke();const flags=rhythm.base>=8?Math.round(Math.log2(rhythm.base/4)):0;for(let f=0;f<flags;f++){const fy=end+(up?5:-5)*f;ctx.beginPath();ctx.moveTo(stemX,fy);ctx.quadraticCurveTo(stemX+(up?9:-9),fy+(up?5:-5),stemX+(up?4:-4),fy+(up?11:-11));ctx.stroke();}}
  if(rhythm.dots)for(let d=0;d<rhythm.dots;d++){ctx.beginPath();ctx.arc(x+10+d*4,Math.min(...ys),1.4,0,Math.PI*2);ctx.fill();}
  if(rhythm.tuplet){ctx.font="600 9px Manrope,sans-serif";ctx.textAlign="center";ctx.fillText(String(rhythm.tuplet),x,NOTATION_TOP-5);}ctx.restore();
}
