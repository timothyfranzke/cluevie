import type { MovieSummary } from "../game/types";

const INDEX_URL =
  import.meta.env.VITE_MOVIES_INDEX_URL ??
  "https://storage.googleapis.com/cluvie-509e6.appspot.com/movies.json";

let cache: MovieSummary[] | null = null;
let inFlight: Promise<MovieSummary[]> | null = null;

async function loadIndex(): Promise<MovieSummary[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = fetch(INDEX_URL, { cache: "default" })
    .then((r) => {
      if (!r.ok) throw new Error(`movies index fetch failed: ${r.status}`);
      return r.json();
    })
    .then((data: MovieSummary[]) => {
      cache = Array.isArray(data) ? data : [];
      return cache;
    })
    .catch((err) => {
      console.warn("movies index unavailable, falling back to empty results", err);
      cache = [];
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function prefetchMovieIndex(): void {
  void loadIndex();
}

export async function searchMovies(term: string): Promise<MovieSummary[]> {
  const lowered = term.trim().toLowerCase();
  if (lowered.length < 2) return [];
  const idx = await loadIndex();
  const starts: MovieSummary[] = [];
  const contains: MovieSummary[] = [];
  for (const m of idx) {
    if (m.term.startsWith(lowered)) {
      starts.push(m);
      if (starts.length >= 8) break;
    } else if (m.term.includes(lowered) && contains.length < 8) {
      contains.push(m);
    }
  }
  return [...starts, ...contains].slice(0, 8);
}
