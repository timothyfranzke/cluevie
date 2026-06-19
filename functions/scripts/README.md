# scripts/

One-shot utilities. Not deployed as Cloud Functions.

## import-tmdb-list.mjs

Pull a TMDB movie list and upsert each title into the Firestore `movies` collection that the autocomplete reads from.

```bash
cd functions
TMDB_API_KEY=xxxxxxxx node scripts/import-tmdb-list.mjs top_rated
TMDB_API_KEY=xxxxxxxx node scripts/import-tmdb-list.mjs popular --pages 10
TMDB_API_KEY=xxxxxxxx node scripts/import-tmdb-list.mjs category:comedy --pages 5
TMDB_API_KEY=xxxxxxxx node scripts/import-tmdb-list.mjs list:8228303 --dry-run
```

### Sources

| Source | Notes |
|---|---|
| `top_rated` | Closest to IMDB Top 250. ~500 pages × 20 = ~10k movies if you let it run unbounded. |
| `popular` | Equivalent to IMDB moviemeter. |
| `now_playing` | In theaters. |
| `upcoming` | Releasing soon. |
| `category:<name>` | Top-rated movies in a genre. `--pages 5` gives the top ~100. Filters out obscure titles via `vote_count.gte=200`. |
| `list:<id>` | Any TMDB user-curated list, by its numeric id from `themoviedb.org/list/<id>`. |

### Available categories

`action`, `adventure`, `animation`, `comedy`, `crime`, `documentary`, `drama`, `family`, `fantasy`, `history`, `horror`, `music`, `mystery`, `romance`, `scifi` (or `science-fiction`), `thriller`, `war`, `western`.

### Flags

- `--pages N` — stop after N paginated calls (each page = 20 movies). Useful for testing.
- `--dry-run` — fetch + parse only; print 5 samples and exit without writing.

### What it writes

Each Firestore doc lives at `movies/{tmdbId}` with:

```json
{
  "id": "278",
  "name": "The Shawshank Redemption",
  "term": "the shawshank redemption",
  "image": "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "year": "1994",
  "updatedAt": <server timestamp>
}
```

Idempotent — safe to rerun. Existing fields are merged, so running `popular` and then `top_rated` accumulates the union of both.

After the Firestore upsert, the script reads the entire `movies` collection back, builds a flat JSON array, and uploads it (gzipped, public-read) to Firebase Storage at `movies.json`. The app fetches this file once on load and runs autocomplete entirely in memory — Firestore is never queried per-keystroke.

You'll see two URLs printed at the end:

```
uploaded: https://storage.googleapis.com/cluvie-509e6.appspot.com/movies.json
```

That's the public URL the app reads from. Override the bucket with `FIREBASE_STORAGE_BUCKET=...` if you ever move projects. The frontend looks up the URL via `VITE_MOVIES_INDEX_URL` (see `.env.example`).

### Quiz authoring

The app matches a guess by comparing `quiz.answerId` to the `movies` doc id. So when you create a quiz, set `answerId` to the **TMDB id** of the answer movie (matches what this script writes). The autocomplete will only surface movies you've imported.

### Getting a TMDB API key

Free, takes a couple of minutes:

1. Make an account at themoviedb.org
2. Go to Settings → API → Request an API Key
3. Pick "Developer," fill in a one-line description
4. Use the v3 auth "API Key" string as `TMDB_API_KEY`

---

## set-storage-cors.mjs

One-shot: enable cross-origin `GET` on the project's default Storage bucket so the frontend can fetch `movies.json` from any origin. Run **once** per project (the setting is persistent on the bucket).

```bash
cd functions
node scripts/set-storage-cors.mjs           # apply
node scripts/set-storage-cors.mjs --show    # print current bucket CORS
```

Allows `GET`/`HEAD` from any origin, exposing `Content-Type`, `Cache-Control`, and `ETag`. Override the bucket with `FIREBASE_STORAGE_BUCKET=...`.

If you see a CORS error fetching `movies.json` from the browser, this is the fix.

---

## create-quiz.mjs

Create a daily quiz from a TMDB movie id. Builds 6 reverse-billed actor clues from the movie's credits, then writes the quiz doc keyed by date.

```bash
cd functions
TMDB_API_KEY=xxxxxxxx node scripts/create-quiz.mjs 278                    # today
TMDB_API_KEY=xxxxxxxx node scripts/create-quiz.mjs 278 --date 2026-07-01  # specific day
TMDB_API_KEY=xxxxxxxx node scripts/create-quiz.mjs 278 --dry-run          # preview
```

### Flags

- `--date YYYY-MM-DD` — day the quiz goes live (UTC midnight). Default: today.
- `--number N` — display number ("No. N"). Default: highest existing `quizNumber` + 1.
- `--dry-run` — print the resolved movie + clues without writing.

### What it writes

Doc id is the date (`YYYY-MM-DD`). Shape:

```ts
{
  cluevieQuizId: "2026-07-01",
  quizNumber: 412,
  movieId: "278",
  answerId: "278",          // matches movies/{id} for guess validation
  title: "The Shawshank Redemption",
  image: "https://image.tmdb.org/t/p/w500/...",
  year: "1994",
  genre: "Drama, Crime",
  clues: [
    { index: 0, name: "James Whitmore", avatar: "...", character: "Brooks Hatlen" },
    // ...index 1..5, most obscure → headliner
  ],
  date: <Timestamp 2026-07-01 00:00:00 UTC>,
  generatedAt: <server timestamp>
}
```

### Tips

- Aborts if fewer than 6 cast members have profile photos — pick a different movie or seed more cast data.
- Warns if `movies/{tmdbId}` doesn't exist (players won't be able to type the answer in autocomplete). Reseed `movies` to fix.
- Overwrites a quiz with the same date — handy for fixing mistakes; risky if you forget.

---

### Authentication for Firestore

Looks for credentials in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` env var pointing at a service-account JSON
2. `functions/cluvie-509e6-firebase-adminsdk-*.json` (already in the repo)
3. Application default credentials (`gcloud auth application-default login`)
