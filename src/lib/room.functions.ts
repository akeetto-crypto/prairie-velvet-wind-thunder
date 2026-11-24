import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { RoomSnapshot } from "@/lib/sync";

export type RoomResponse = { serverNow: number; room: RoomSnapshot | null };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type RoomRow = {
  code: string;
  song_id: number;
  track_index: number;
  title: string;
  artist: string;
  playing: boolean;
  position_ms: number;
  anchor_ms: number;
  speed: number;
  seq: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function cleanCode(value: unknown): string {
  if (typeof value !== "string") throw new Error("Нет кода комнаты");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error("Код — 5 символов");
  return code;
}

function cleanPeer(value: unknown): string {
  if (typeof value !== "string") return "";
  const peer = value.trim();
  if (!/^[a-zA-Z0-9-]{8,48}$/.test(peer)) return "";
  return peer;
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(1.25, Math.max(0.5, Math.round(speed * 100) / 100));
}

function mapRoom(row: RoomRow, listeners: number): RoomSnapshot {
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
    listeners,
  };
}

async function listenersOf(code: string, peer: string): Promise<number> {
  const sql = await getSql();
  if (peer) {
    await sql`
      insert into room_presence (room_code, peer_id, last_seen)
      values (${code}, ${peer}, now())
      on conflict (room_code, peer_id)
      do update set last_seen = now()
    `;
  }
  await sql`delete from room_presence where room_code = ${code} and last_seen < now() - interval '15 seconds'`;
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from room_presence
    where room_code = ${code} and last_seen > now() - interval '15 seconds'
  `;
  return Number(rows[0]?.n ?? 0);
}

async function readRoom(code: string, peer: string): Promise<RoomResponse> {
  const sql = await getSql();
  const rows = await sql<RoomRow>`select code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq from rooms where code = ${code}`;
  const serverNow = Date.now();
  if (!rows[0]) return { serverNow, room: null };
  const listeners = await listenersOf(code, peer);
  return { serverNow, room: mapRoom(rows[0], listeners) };
}

function newCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const createRoom = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
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
      artist,
    };
  })
  .handler(async ({ data }): Promise<RoomResponse> => {
    const sql = await getSql();
    const now = Date.now();
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newCode();
      const rows = await sql<RoomRow>`
        insert into rooms (code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq)
        values (${code}, ${data.songId}, ${data.trackIndex}, ${data.title}, ${data.artist}, false, 0, ${now}, 1, 1)
        on conflict (code) do nothing
        returning code, song_id, track_index, title, artist, playing, position_ms, anchor_ms, speed, seq
      `;
      if (rows[0]) return { serverNow: Date.now(), room: mapRoom(rows[0], 0) };
    }
    throw new Error("Не удалось создать комнату");
  });

export const pollRoom = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const row = asRecord(input);
    return { code: cleanCode(row?.code), peer: cleanPeer(row?.peer) };
  })
  .handler(async ({ data }): Promise<RoomResponse> => readRoom(data.code, data.peer));

export const pushTransport = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const row = asRecord(input);
    const songId = Number(row?.songId);
    const trackIndex = Number(row?.trackIndex);
    const positionMs = Number(row?.positionMs);
    const speed = clampSpeed(Number(row?.speed));
    if (!Number.isInteger(songId) || songId <= 0) throw new Error("Не выбрана песня");
    if (!Number.isFinite(positionMs) || positionMs < 0 || positionMs > 3 * 60 * 60 * 1000) {
      throw new Error("Некорректная позиция");
    }
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
      artist,
    };
  })
  .handler(async ({ data }): Promise<RoomResponse> => {
    const sql = await getSql();
    const now = Date.now();
    const rows = await sql<RoomRow>`
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
    if (!rows[0]) return { serverNow: Date.now(), room: null };
    const listeners = await listenersOf(data.code, data.peer);
    return { serverNow: Date.now(), room: mapRoom(rows[0], listeners) };
  });
