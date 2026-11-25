export type RoomSnapshot = {
  code: string;
  songId: number;
  trackIndex: number;
  title: string;
  artist: string;
  playing: boolean;
  positionMs: number;
  anchorMs: number;
  speed: number;
  seq: number;
  listeners: number;
};

/** Where the shared clock says the playhead is, in song milliseconds. */
export function roomPosition(room: Pick<RoomSnapshot, "playing" | "positionMs" | "anchorMs" | "speed">, serverNow: number): number {
  if (!room.playing) return Math.max(0, room.positionMs);
  const elapsed = Math.max(0, serverNow - room.anchorMs);
  return Math.max(0, room.positionMs + elapsed * room.speed);
}

export function smoothOffset(prev: number | null, sentAt: number, serverNow: number, receivedAt: number): number {
  const mid = sentAt + (receivedAt - sentAt) / 2;
  const sample = serverNow - mid;
  if (prev == null || !Number.isFinite(prev)) return sample;
  return prev * 0.72 + sample * 0.28;
}
