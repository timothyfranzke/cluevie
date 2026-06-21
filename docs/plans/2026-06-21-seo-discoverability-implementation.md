# SEO Discoverability — Implementation Plan (Phase 0 + Phase 1)

Companion to `2026-06-21-seo-discoverability-design.md`. Covers the first two phases. Phase 2 (how-to-play, poster OG, JSON-LD) is deferred.

**Key data note:** the `Quiz` doc (`src/game/types.ts`) already embeds everything a puzzle page needs — `title`, `year`, `genre`, `image`, `quizNumber`, `date`, and `clues[]` (each with `name` + `character`). Puzzle pages can render from the quiz doc alone; no join to `movies` is required for v1.

## Phase 0 — Foundations (ship independently)

1. **`public/robots.txt`**
   - Allow all crawlers; add `Sitemap: https://cluevie.com/sitemap.xml` (line is harmless before the sitemap exists in Phase 1).
   - Vite copies `public/` to `dist/cluvie`, so it deploys with hosting as-is.

2. **Bake SEO content into `index.html`**
   - Inside `<div id="root">`, add fallback markup: H1, one-paragraph hero, a how-to-play summary list, and an `<a href="/archive">` link.
   - React replaces it on mount (current behavior is unaffected — `#root` is emptied and re-rendered). Verify the play experience is visually identical after the change.

3. **Google Search Console**
   - Verify `cluevie.com` (DNS TXT or the existing hosting — HTML-tag verification can go in `index.html` `<head>`).
   - Submit the property. No sitemap yet — that arrives in Phase 1.

**Phase 0 acceptance:** `view-source` on `/` shows real headline/description text; `/robots.txt` resolves; Search Console verified.

## Phase 1 — Archive engine

### Backend: `functions/seo.f.js` → exported as `seo`

Single HTTPS function (`functions.https.onRequest`) that routes internally by path:

- `GET /archive` and `/archive?page=N` → paginated list of past puzzles (link + title + number + date).
- `GET /puzzle/:slug` → parse leading `quizNumber` from slug (`142-the-big-lebowski` → 142); load that quiz; **404 if `date` is in the future or missing**; render H1, year/genre, the six `clues` (name + character), poster `image`, and a "Play today's Cluevie" CTA linking to `/`. Add prev/next links to adjacent puzzle numbers and a link back to `/archive`.
- `GET /sitemap.xml` → XML listing `/`, `/archive`, `/how-to-play`, and every past `/puzzle/...` with `lastmod` from each quiz `date`.
- Rendering is plain string templating (no React on server). Escape interpolated values.
- Set `Cache-Control: public, max-age=86400, s-maxage=604800` on puzzle/archive/sitemap responses; short/no cache on 404s.
- Firestore reads use the Admin SDK already initialized in `functions/`. Query past puzzles with `where('date', '<=', now)`, `orderBy('date', 'desc')`.

### Hosting: `firebase.json` rewrites

Add **before** the catch-all `**` → `/index.html` rewrite (order matters — first match wins):

```json
{ "source": "/archive", "function": "seo" },
{ "source": "/archive/**", "function": "seo" },
{ "source": "/puzzle/**", "function": "seo" },
{ "source": "/sitemap.xml", "function": "seo" }
```

### Slug helper

- Shared slugify (`142` + `The Big Lebowski` → `142-the-big-lebowski`). Used by the sitemap, archive links, and (later) any client-side "view in archive" link. Parse back to the number from the slug prefix so the title portion is cosmetic.

### Daily cron sitemap ping

- In the existing daily quiz routine, after writing tomorrow's quiz, issue a `GET https://www.google.com/ping?sitemap=https://cluvie.com/sitemap.xml`. Best-effort, non-fatal on error.

**Phase 1 acceptance:**
- `/puzzle/<n>-<slug>` for a past puzzle returns 200 with server-rendered cast/title in `view-source`; a future/unknown puzzle returns 404.
- `/archive` lists past puzzles and paginates.
- `/sitemap.xml` validates and includes every past puzzle.
- Hosting rewrites resolve to the function (not the SPA shell) for these paths, while `/` still serves the SPA.
- Re-submit/refresh sitemap in Search Console; watch indexed-page count climb over 1–2 weeks.

## Risks / watch-items

- **Rewrite ordering:** the SPA catch-all must stay last or it shadows the SEO routes.
- **Cold starts:** acceptable for crawlers; edge cache absorbs repeat hits. Keep the function dependency-light.
- **`quizNumber` gaps:** if older quizzes lack `quizNumber`, fall back to the doc `id` in the slug and sitemap; confirm coverage before launch.
- **Verification tag placement** in `index.html` must survive the Phase 0 fallback-markup edit.
