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

### Authentication for Firestore

Looks for credentials in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` env var pointing at a service-account JSON
2. `functions/cluvie-509e6-firebase-adminsdk-*.json` (already in the repo)
3. Application default credentials (`gcloud auth application-default login`)
