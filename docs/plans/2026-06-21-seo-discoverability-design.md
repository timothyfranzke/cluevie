# SEO Discoverability — Design

**Date:** 2026-06-21
**Status:** Designed, not yet implemented
**Goal:** Make Cluevie findable in search so the user base grows. Today every URL returns the same empty `<div id="root">` SPA shell — to a crawler, Cluevie is one blank page with no sitemap and no `robots.txt`.

## Strategy

The game is daily and spoiler-based, which creates a tension: the content Google loves (movie titles + actor names) is exactly what spoils today's answer. The resolution is that **past** puzzles are pure SEO gold — once a puzzle's day has passed, its movie and six actors become indexable long-tail content at zero spoiler cost. We already retain every quiz in Firestore (`quizzes` collection, with `answerId` into `movies`), so the raw material exists.

Two search surfaces, won together:

- **Homepage** captures head terms — "daily movie quiz", "Leonard Maltin game online", "Wordle for movies".
- **Past-puzzle archive** captures thousands of long-tail actor/movie queries and gives every shared link a real, rich page.

Programmatic per-actor/per-movie pages are explicitly **out of scope for v1** — biggest build, thinnest per-page value, risks looking like a content farm. Revisit only after the archive proves it pulls traffic.

## Architecture — dynamic rendering for SEO routes

The live game stays a pure SPA and is never put at risk. SEO routes are served server-side by a new Cloud Function.

- **Game (`/`)** keeps loading client-side exactly as today.
- **SEO routes** (`/archive`, `/puzzle/**`, `/sitemap.xml`) route via Firebase Hosting rewrites to a new `seo.f.js` function that returns **real server-rendered HTML** — full `<title>`, meta description, OG tags, and visible body content. No JS required for a crawler to read it.
- **Edge-cached.** The function sets `Cache-Control: public, max-age=86400, s-maxage=604800`. Firebase's CDN serves nearly every request from cache; Firestore is hit only on rare misses. Cost stays near zero as the archive grows.
- **Grows automatically.** Pages render on demand from Firestore, so every new daily quiz becomes a new indexable page the day after it airs — no redeploys.

**Rejected alternative:** build-time prerendering (SSG) would force a full hosting redeploy every day to publish the new archive page. Dynamic rendering avoids that entirely.

## Page structure

Internal links knit the pages together (internal linking drives both discovery and ranking).

| Route | Type | Content |
|---|---|---|
| `/` | SPA + baked fallback HTML | Hero ("A new movie quiz every day…"), how-to-play summary, link to archive — placed inside `#root` as fallback markup React replaces on mount. Crawlers without JS still read genuine text. Wins head terms. |
| `/puzzle/142-the-big-lebowski` | Server-rendered | The SEO workhorse. Slug carries the movie title. H1 (`Cluevie #142 — The Big Lebowski (1998)`), the six actors + characters, poster, difficulty/avg score if available, prominent "Play today's Cluevie" CTA. Prev/next links. |
| `/archive` | Server-rendered | Paginated index linking to every past puzzle. The hub that lets crawlers reach all long-tail pages; also a useful "play past puzzles" surface. |
| `/how-to-play` | Static HTML | Pure static, no JS. Ranks for explanatory searches, funnels newcomers. |

**Spoiler guard:** only puzzles whose `date` has passed get a page. Today's and future puzzles return 404. Past-puzzle pages openly show the answer movie + cast by design — that's the indexable content.

## Rendering engine, sitemap, freshness

- **Rendering:** `seo.f.js` reads `quizzes` + `movies` from Firestore and renders HTML from a small string template — no React on the server, keeping the function tiny and fast. Date-guards future puzzles to a 404.
- **Caching:** past-puzzle pages are immutable → long `max-age`/`s-maxage`, served from the edge.
- **Sitemap:** `/sitemap.xml` (cached function) lists homepage, `/archive`, `/how-to-play`, and every past `/puzzle/...` URL with `lastmod`. The single most important file for getting the long-tail indexed.
- **robots.txt:** static `public/robots.txt`, allows crawling, points to the sitemap.
- **Freshness:** nothing scheduled is required. As a nudge, the existing daily cron adds one cheap step after writing tomorrow's quiz: ping Google with the updated sitemap so yesterday's now-public puzzle indexes within hours, not days.

## Share / OG images

- **Puzzle pages use the movie poster as `og:image`** (already available via TMDB in the `movies` collection) with a title like "Cluevie #142 — can you name this movie?". Archive links unfurl with a real poster instead of the generic logo — far higher click-through. **Zero image-generation infrastructure** — just a URL in a meta tag.
- **Homepage and today's-result share stay generic on purpose.** The player share grid (`Cluevie 142 4/6 🟩🟥… cluevie.com`) keeps pointing at the homepage with the non-spoiler OG image. We never want a freshly-shared result to unfurl the answer.
- **Branded composite image (poster + score + logo) is a later enhancement** (needs Satori/resvg in a function). YAGNI for v1.

## Rollout — phased, smallest-effort-first

- **Phase 0 — Foundations (hours, no new pages).** `robots.txt`; bake SEO content block into `index.html`; verify in Google Search Console + submit. Makes the homepage properly indexable and gives the measurement dashboard. Ships independently.
- **Phase 1 — Archive engine (core build).** `seo.f.js` + Hosting rewrites; `/puzzle/...` template; `/archive` index with pagination; internal prev/next links; `/sitemap.xml`; daily-cron sitemap ping. Source of long-tail traffic.
- **Phase 2 — Polish & rich results.** Static `/how-to-play`; poster OG images on puzzle pages; JSON-LD structured data (`Movie`/`Quiz` schema) for rich results. Each independent and optional.

## Success metrics (Google Search Console, weekly)

- **Indexed pages** climbing toward (past-puzzle count + 3) — confirms crawling works.
- **Impressions** on actor/movie and "daily movie quiz" queries — confirms relevance.
- **Organic clicks / sessions** — the real goal: more users.
- Leading indicator (~2 weeks): homepage indexed, archive pages appearing. Long-tail compounds over months — judge Phase 1 at the 4–8 week mark, not immediately.
