import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Loader2, Pause, Play, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TabStage, useBarLabel } from "@/components/tab-stage";
import { BandEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/cn";
import { pollRoom, pushTransport } from "@/lib/room.functions";
import { loadSong, searchSongs, type SearchHit, type SongPayload } from "@/lib/songsterr.functions";
import { extractSongId } from "@/lib/song-id";
import { roomPosition, smoothOffset, type RoomSnapshot } from "@/lib/sync";
import { formatTime, type MixNote, type PartView } from "@/lib/timeline";

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

type Meta = {
  songId: number;
  title: string;
  artist: string;
  songUrl: string;
  durationMs: number;
  tracks: SongPayload["tracks"];
};

type SessionProps = { mode: "solo"; songId: number; track: number } | { mode: "room"; code: string };

function readPeer(): string {
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

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Что-то пошло не так";
}

export function Session(props: SessionProps) {
  const code = props.mode === "room" ? props.code.toUpperCase() : "";
  const [meta, setMeta] = useState<Meta | null>(null);
  const [view, setView] = useState<PartView | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [clock, setClock] = useState(0);
  const [listeners, setListeners] = useState(0);
  const [drift, setDrift] = useState("синхрон");
  const [copied, setCopied] = useState(false);
  const [needGesture, setNeedGesture] = useState(false);
  const [finder, setFinder] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [finding, setFinding] = useState(false);
  const [showFinder, setShowFinder] = useState(false);

  const engineRef = useRef<BandEngine | null>(null);
  const metaRef = useRef<Meta | null>(null);
  const viewRef = useRef<PartView | null>(null);
  const mixRef = useRef<MixNote[]>([]);
  const offsetRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const driving = useRef(false);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const armed = useRef(false);
  const genRef = useRef(0);
  const loadingRef = useRef(false);
  const peerRef = useRef("");
  const lastRoom = useRef<RoomSnapshot | null>(null);
  const getPosition = useRef(() => engineRef.current?.position() ?? 0);
  const onSeek = useRef<(ms: number, commit: boolean) => void>(() => {});

  const barLabel = useBarLabel(view, clock);

  function adopt(song: SongPayload, takeMix: boolean) {
    if (takeMix && song.mix.length) mixRef.current = song.mix;
    const next: Meta = {
      songId: song.songId,
      title: song.title,
      artist: song.artist,
      songUrl: song.songUrl,
      durationMs: song.durationMs,
      tracks: song.tracks,
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

  async function ensureTrack(songId: number, trackIndex: number, withMix: boolean): Promise<boolean> {
    const gen = ++genRef.current;
    loadingRef.current = true;
    setPhase("loading");
    try {
      const song = await loadSong({ data: { songId, trackIndex, withMix } });
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

  async function syncToRoom(room: RoomSnapshot) {
    lastRoom.current = room;
    speedRef.current = room.speed;
    setSpeed(room.speed);
    const sameSong = metaRef.current?.songId === room.songId;
    const needMix = !sameSong || mixRef.current.length === 0;
    const needView = !sameSong || viewRef.current?.trackIndex !== room.trackIndex;
    if (needMix || needView) {
      if (loadingRef.current) return;
      try {
        const ok = await ensureTrack(room.songId, room.trackIndex, needMix);
        if (!ok) return;
      } catch (err) {
        setError(messageOf(err));
        setPhase("error");
        return;
      }
    }
    const engine = engineRef.current;
    const current = metaRef.current;
    if (!engine || !current) return;
    const now = Date.now() + (offsetRef.current ?? 0);
    let target = roomPosition(room, now);
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

  async function publish(partial: {
    playing?: boolean;
    positionMs?: number;
    speed?: number;
    songId?: number;
    trackIndex?: number;
    title?: string;
    artist?: string;
  }) {
    if (props.mode !== "room") return;
    const current = metaRef.current;
    const part = viewRef.current;
    if (!current || !part) return;
    driving.current = true;
    const sent = Date.now();
    try {
      const res = await pushTransport({
        data: {
          code,
          peer: peerRef.current,
          songId: partial.songId ?? current.songId,
          trackIndex: partial.trackIndex ?? part.trackIndex,
          title: partial.title ?? current.title,
          artist: partial.artist ?? current.artist,
          playing: partial.playing ?? playingRef.current,
          positionMs: partial.positionMs ?? engineRef.current?.position() ?? 0,
          speed: partial.speed ?? speedRef.current,
        },
      });
      offsetRef.current = smoothOffset(offsetRef.current, sent, res.serverNow, Date.now());
      if (!res.room) {
        setMissing(true);
        return;
      }
      seqRef.current = res.room.seq;
      lastRoom.current = res.room;
      setListeners(res.room.listeners);
      const target = Math.min(
        roomPosition(res.room, Date.now() + (offsetRef.current ?? 0)),
        current.durationMs || Number.POSITIVE_INFINITY,
      );
      const how = engineRef.current?.correct(target) ?? "ok";
      setDrift(how === "ok" ? "синхрон" : "подстройка");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      driving.current = false;
    }
  }

  onSeek.current = (ms: number, commit: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.seek(ms);
    setClock(ms);
    if (!commit) return;
    void publish({ positionMs: ms, playing: playingRef.current });
  };

  useEffect(() => {
    const engine = new BandEngine();
    engineRef.current = engine;
    peerRef.current = readPeer();
    return () => engine.destroy();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const pos = engineRef.current?.position() ?? 0;
      setClock(pos);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (props.mode !== "solo") return;
    let cancel = false;
    setPhase("loading");
    setMissing(false);
    void (async () => {
      try {
        const song = await loadSong({
          data: { songId: props.songId, trackIndex: props.track, withMix: true },
        });
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
    // initial track only; later switches stay inside the player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode === "solo" ? props.songId : 0]);

  useEffect(() => {
    if (props.mode !== "room") return;
    let stop = false;
    const tick = async () => {
      if (stop || driving.current) return;
      const sent = Date.now();
      try {
        const res = await pollRoom({ data: { code, peer: peerRef.current || readPeer() } });
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
    void tick();
    const id = window.setInterval(() => void tick(), 800);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code !== "Space") return;
      event.preventDefault();
      void toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!showFinder) return;
    const q = finder.trim();
    const id = extractSongId(q);
    if (id) {
      setHits([]);
      return;
    }
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setFinding(true);
      void searchSongs({ data: { q } })
        .then(setHits)
        .catch((err) => setError(messageOf(err)))
        .finally(() => setFinding(false));
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
      await publish({ playing: true, positionMs: from });
    } else {
      const pos = engine.pause();
      playingRef.current = false;
      setPlaying(false);
      await publish({ playing: false, positionMs: pos });
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

  async function chooseSpeed(next: number) {
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
    await publish({ speed: next, positionMs: pos, playing: playingRef.current });
  }

  async function chooseTrack(index: number) {
    const current = metaRef.current;
    if (!current || index === viewRef.current?.trackIndex) return;
    const pos = engineRef.current?.position() ?? 0;
    const was = playingRef.current;
    try {
      const ok = await ensureTrack(current.songId, index, mixRef.current.length === 0);
      if (!ok) return;
      const engine = engineRef.current;
      if (!engine) return;
      if (was && armed.current) engine.play(pos);
      else engine.seek(pos);
      playingRef.current = was && armed.current;
      setPlaying(playingRef.current);
      await publish({ trackIndex: index, positionMs: pos, playing: playingRef.current });
    } catch (err) {
      setError(messageOf(err));
      setPhase("error");
    }
  }

  async function chooseSong(songId: number, title: string, artist: string, trackIndex: number) {
    const wasRoom = props.mode === "room";
    try {
      if (wasRoom) {
        engineRef.current?.pause();
        playingRef.current = false;
        setPlaying(false);
      }
      const ok = await ensureTrack(songId, trackIndex, true);
      if (!ok) return;
      engineRef.current?.seek(0);
      playingRef.current = false;
      setPlaying(false);
      setShowFinder(false);
      setFinder("");
      const loaded = metaRef.current;
      if (wasRoom && loaded) {
        await publish({
          songId: loaded.songId,
          trackIndex: viewRef.current?.trackIndex ?? loaded.tracks[0]?.index ?? 0,
          title: loaded.title || title,
          artist: loaded.artist || artist,
          playing: false,
          positionMs: 0,
        });
      }
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/" className="font-serif text-xl font-semibold tracking-tight text-fg">
            В такт
          </Link>
          <h1 className="mt-2 truncate font-serif text-2xl font-semibold text-fg md:text-3xl">
            {meta ? meta.title : phase === "loading" ? "Собираем таб…" : "Без названия"}
          </h1>
          <p className="truncate text-sm text-muted">{meta?.artist || "Songsterr"}</p>
        </div>
        {props.mode === "room" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-line bg-surface px-3 py-2">
              <p className="text-xs uppercase tracking-widest text-muted">Комната</p>
              <p className="font-mono text-2xl font-semibold tracking-[0.18em] text-accent">{code}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Скопирован" : "Код"}
            </button>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Users className="size-4" />
              {listeners > 1 ? `${listeners} в комнате` : "только вы"}
              <span className="text-ok">· {drift}</span>
            </p>
          </div>
        ) : (
          <p className="max-w-xs text-sm text-muted">Сейчас играет только этот экран. Комнату можно открыть с главной.</p>
        )}
      </header>

      {missing ? (
        <section className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <h2 className="font-serif text-2xl">Такой комнаты нет</h2>
          <p className="mt-2 text-muted">Проверьте код из пяти символов.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink">
            На главную
          </Link>
        </section>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(meta?.tracks ?? []).map((track) => (
              <button
                key={track.index}
                type="button"
                onClick={() => void chooseTrack(track.index)}
                className={cn(
                  "h-11 shrink-0 rounded-full border px-3 text-left text-sm",
                  view?.trackIndex === track.index
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface text-fg",
                )}
              >
                <span className="font-semibold">{track.name}</span>
                <span className={view?.trackIndex === track.index ? "text-accent-ink/80" : "text-muted"}>
                  {" "}
                  · {track.instrument}
                </span>
              </button>
            ))}
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-black/50 bg-[#1a1b1e] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            <div className="h-[54vh] min-h-72 max-h-[640px]">
              <TabStage view={view} getPosition={getPosition} onSeek={onSeek} />
            </div>
            {phase === "loading" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]/85 text-fg">
                <p className="inline-flex items-center gap-2 font-medium">
                  <Loader2 className="size-4 animate-spin" />
                  Загружаем партии Songsterr
                </p>
              </div>
            ) : null}
            {needGesture ? (
              <div className="absolute inset-0 flex items-end justify-center bg-ink/25 p-4">
                <button
                  type="button"
                  onClick={() => void armAndJoin()}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-ink"
                >
                  <Play className="size-4 fill-current" />
                  Включить звук и войти в такт
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void toggle()}
                disabled={!meta || phase === "loading"}
                className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-40"
                aria-label={playing ? "Пауза" : "Играть"}
              >
                {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-fg">{barLabel || "Такт"}</span>
                  <span className="font-mono text-muted">
                    {formatTime(shown)} / {formatTime(duration)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 1)}
                  step={50}
                  value={Math.min(shown, Math.max(duration, 1))}
                  aria-label="Позиция"
                  disabled={!duration}
                  onPointerDown={() => {
                    driving.current = true;
                  }}
                  onInput={(event) => {
                    const ms = Number(event.currentTarget.value);
                    engineRef.current?.seek(ms);
                    setClock(ms);
                  }}
                  onPointerUp={(event) => {
                    driving.current = false;
                    const ms = Number(event.currentTarget.value);
                    void publish({ positionMs: ms, playing: playingRef.current });
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    const ms = Number(event.currentTarget.value);
                    void publish({ positionMs: ms, playing: playingRef.current });
                  }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted">Скорость</span>
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void chooseSpeed(value)}
                  className={cn(
                    "h-10 min-w-14 rounded-full border px-3 text-sm font-semibold",
                    speed === value ? "border-accent bg-accent text-accent-ink" : "border-line text-fg",
                  )}
                >
                  {value === 1 ? "1×" : `${value}×`}
                </button>
              ))}
              <span className="ml-auto inline-flex h-3 w-3 items-center justify-center">
                <span className={cn("beat-pip size-2.5 rounded-full", playing ? "bg-ember" : "bg-line")} key={barLabel} />
              </span>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ember" role="alert">
              {error}
            </p>
          ) : null}

          <section className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setShowFinder((v) => !v)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4"
            >
              <Search className="size-4" />
              Другая песня
            </button>
            {meta ? (
              <a
                href={meta.songUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4"
              >
                <ExternalLink className="size-4" />
                Открыть на Songsterr
              </a>
            ) : null}
            <p className="max-w-xl text-muted">
              Все партии идут по одной сетке тактов. Звук синтезируется в браузере — гитара, бас, клавиши и ударные, — это не запись Songsterr.
            </p>
          </section>

          {showFinder ? (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <label className="block text-sm text-muted" htmlFor="finder">
                Название или ссылка Songsterr
              </label>
              <input
                id="finder"
                value={finder}
                onChange={(event) => setFinder(event.target.value)}
                placeholder="enter sandman"
                className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3 text-fg outline-none"
              />
              {finding ? <p className="mt-3 text-sm text-muted">Ищем…</p> : null}
              <ul className="mt-3 divide-y divide-line">
                {hits.map((hit) => (
                  <li key={hit.songId}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start py-3 text-left"
                      onClick={() => void chooseSong(hit.songId, hit.title, hit.artist, hit.defaultTrack)}
                    >
                      <span className="font-semibold">{hit.title}</span>
                      <span className="text-sm text-muted">
                        {hit.artist} · {hit.trackCount} партий
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {extractSongId(finder) ? (
                <button
                  type="button"
                  className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-4 font-semibold text-accent-ink"
                  onClick={() => {
                    const id = extractSongId(finder);
                    if (id) void chooseSong(id, meta?.title ?? "", meta?.artist ?? "", -1);
                  }}
                >
                  Открыть ссылку
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
