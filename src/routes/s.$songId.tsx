import { createFileRoute } from "@tanstack/react-router";
import { Session } from "@/components/session";

type SoloSearch = { track: number };

export const Route = createFileRoute("/s/$songId")({
  validateSearch: (search: Record<string, unknown>): SoloSearch => {
    const n = Number(search.track);
    return { track: Number.isFinite(n) ? Math.trunc(n) : -1 };
  },
  component: SoloPage,
});

function SoloPage() {
  const { songId } = Route.useParams();
  const { track } = Route.useSearch();
  const id = Number(songId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">Некорректная песня</h1>
        <p className="mt-2 text-muted">В ссылке нет номера таба Songsterr.</p>
      </main>
    );
  }
  return <Session mode="solo" songId={id} track={track} />;
}
