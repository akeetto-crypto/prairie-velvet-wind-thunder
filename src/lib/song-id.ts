export function extractSongId(input: string): number | null {
  const text = input.trim();
  if (/^\d{1,9}$/.test(text)) return Number(text);
  const marked = text.match(/-s(\d+)\b/);
  if (marked) return Number(marked[1]);
  try {
    const url = new URL(text);
    const q = url.searchParams.get("songId") ?? url.searchParams.get("id");
    if (q && /^\d+$/.test(q)) return Number(q);
  } catch {
    /* not a url */
  }
  return null;
}
