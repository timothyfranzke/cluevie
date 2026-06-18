# IMDB Quiz Pipeline & Angular Upgrade — Design

**Date:** 2026-06-18
**Status:** Approved, ready for implementation planning

## Summary

Two parallel tracks of work:

- **Track A — Backend:** Replace hand-authored daily quizzes with an automated daily Cloud Function that scrapes a randomly chosen IMDB top-100 list, has Claude pick a movie, resolves cast via TMDB, and writes the quiz to Firestore. Clues are the top six billed actors in reverse order (Leonard Maltin Game rules).
- **Track B — Frontend:** Upgrade Angular 12 → 20 with standalone components, modular AngularFire, and a signals-based `QuizService` refactor.

The two tracks are independent (no shared files) and can ship on separate timelines. Backend can land first while the frontend is still on Angular 12.

## Game rules (recap)

- One quiz per day. Score starts at 6.
- Six clues per quiz, each clue is an actor (`name` + `avatar` headshot).
- Clues are ordered **last-billed first** — the most obscure character actor is revealed first, the headliner is revealed last.
- Each clue reveal costs 1 point. Each wrong guess costs 1 point. Correct guess wins; score reaching 0 loses.

## Track A — Backend pipeline

### Daily Cloud Function

A scheduled function at `functions/scheduled/dailyQuiz.f.js` (auto-registered as `scheduledDailyQuiz` by the existing `*.f.js` glob in `functions/index.js`). Runs once per day at UTC midnight.

Pipeline:

1. **Pick a list.** Load `config/topLists` from Firestore (shape: `{ lists: [{ name, url }] }`). Randomly choose one. Configurable from the Firebase console — no redeploy to add a list.
2. **Fetch the HTML** from the chosen URL with a standard `User-Agent`.
3. **Query the exclude set.** Read `quizzes` where `date > now - 365 days`, project `movieId`. This is the rolling 365-day dedup window.
4. **Ask Claude.** Send the HTML + exclude set to the Anthropic API. Prompt returns `{ title, year, imdbId }` for one movie from the page not in the exclude set.
5. **Resolve via TMDB.** `GET /find/{imdbId}?external_source=imdb_id` → TMDB id → `GET /movie/{id}/credits`.
6. **Build clues.** Sort cast by `order` descending (last-billed first), take 6 where `profile_path` exists. If fewer than 6 qualify, log and abort — the cron next day picks a different movie.
7. **Write the quiz** to `quizzes` with today's date (UTC midnight), `answerId` = TMDB id, plus title/year/genre/image fields the existing `Quiz` model expects.
8. **Upsert into `movies`.** `set()` the chosen movie into the `movies` collection (with lowercased `term` field). The existing `db/movies/onCreate.f.js` then auto-syncs it to the bulk `movies.json` autocomplete index.

Secrets (`TMDB_API_KEY`, `ANTHROPIC_API_KEY`, model name) live in `functions.config()` following the existing service-account pattern.

### Data model changes

The existing `Quiz`, `Clue`, `Result`, and `State` models stay. Two additions:

**New Firestore document `config/topLists`:**
```ts
{
  lists: Array<{ name: string; url: string }>;
}
```

**Optional fields added to `Quiz`** (so hand-authored quizzes still parse):
```ts
sourceList?: string;     // e.g., "IMDB Top 250"
sourceUrl?: string;
generatedAt?: Timestamp; // distinct from `date` (the play date)
```

### One-time `movies` backfill

Players can only guess movies that exist in the `movies` Firestore collection (the autocomplete index). If `movies` is small and curated, players will brute-force by trying every option. A one-time script seeds `movies` with several thousand popular TMDB titles so guessing feels real. Lives at `functions/scripts/backfillMovies.js`, run once manually, not part of the cron.

### Risks

- **IMDB ToS / blocking.** Scraping IMDB violates their terms and they actively block scrapers. Using an LLM to parse the HTML doesn't change the legal posture, just the brittleness to layout changes. Fallback: swap the HTML fetch for TMDB's discover endpoint filtered by built-in lists; the prompt and downstream pipeline stay identical.
- **LLM cost.** One Claude API call per day is fractions of a cent. Pin the model name in `functions.config()` so it doesn't drift on SDK updates.
- **TMDB cast quality.** Some movies have thin credits or missing headshots. The function aborts and tries a different movie the next day if fewer than 6 cast members have profile images.

### Track A implementation order

1. Add `config/topLists` doc + seed with the desired IMDB URLs.
2. Implement the LLM picker as a standalone module (input: HTML + exclude list → output: `{ imdbId, title, year }`) with unit tests using fixture HTML.
3. Implement the TMDB resolver (input: IMDB id → output: 6 clues + metadata).
4. Wire both into the scheduled function. Test with the Firebase emulator.
5. Write and run the one-time `movies` backfill script.
6. Enable the schedule in production.

## Track B — Angular upgrade

### Current state

- Angular 12, RxJS 6.6, TypeScript 4.3
- `@angular/material` 13 (already ahead of core — pre-existing mismatch)
- `@angular/fire` 7 compat API (legacy)
- `@angular/flex-layout` (deprecated and archived upstream)
- NgModule-based, no standalone components, no signals

### Target end state

- Angular 20.x stable
- Standalone components, bootstrap from `main.ts`
- `@if` / `@for` control flow
- AngularFire modular API
- `QuizService` refactored to use signals (`signal()`, `computed()`) instead of `BehaviorSubject`s — the service has six observable streams that map cleanly to six signals
- Zoneless is **out of scope** (not worth the risk for an app this size)

### Sequencing

Each step is a separate PR, validated by `npm start` and a manual game play-through (load, reveal clues, guess wrong, guess right).

1. **12 → 14** — incrementally via `ng update @angular/core@13 @angular/cli@13`, then `@14`. Material follows each step. RxJS 7 lands here; address `toPromise()` removals.
2. **Replace `@angular/flex-layout`** — usages are limited to `FlexModule`. Replace with CSS flex in component SCSS.
3. **AngularFire compat → modular** — rewrite `QuizService` constructor to use `inject(Firestore)`, `collection()`, `query()`, `collectionData()`. Single largest PR of the track.
4. **14 → 17** — gains standalone migration schematics + new control flow.
5. **Run `ng generate @angular/core:standalone`** — automated. Bootstrap moves from `app.module.ts` to `main.ts`.
6. **17 → 20** — mechanical at this point.
7. **Signals refactor of `QuizService`** — replace `BehaviorSubject<Result>`, `BehaviorSubject<Quiz>`, `BehaviorSubject<Clue[]>`, `BehaviorSubject<Movie[]>` with signals; update component subscriptions to `effect()` or direct signal reads in templates.

## Cross-track coordination

- Track A adds optional fields to `Quiz`. Track B keeps them optional in the TS interface so neither track blocks the other.
- Backend can ship to production while frontend is still on Angular 12 — the existing app reads the same `Quiz` shape.
- No shared files between tracks; can be developed concurrently by separate agents.

## Out of scope

- Player accounts, authentication, leaderboards
- Sharing results (the existing `ClipboardModule` import suggests partial work here; not part of this design)
- Difficulty modes
- Zoneless Angular
- Migrating the existing `results` Firestore collection schema
