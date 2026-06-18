# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cluevie is a daily Leonard Maltin Game–style movie quiz. The user gets one quiz per day and identifies a movie from up to six actor clues, revealed in **reverse billing order** (most obscure character actor first, headliner last). Starting score is 6; each clue reveal and each wrong guess costs 1 point.

Stack: React 18 + Vite + TypeScript + Tailwind + Zustand on the frontend; Firebase (Firestore, Hosting, Functions, Storage) on the backend. The frontend was rewritten from scratch in 2026-06 — the prior Angular 12 codebase was deleted, not migrated. The Cloud Functions backend (under `functions/`) is independent and pre-existed the rewrite.

## Commands

Frontend (from repo root):
- `npm run dev` — Vite dev server (http://localhost:5173). Reads `.env.local`.
- `npm run build` — TS check + production bundle to `dist/cluvie`.
- `npm run preview` — serve the built bundle.
- `npm run lint` — `tsc -b --noEmit` (no ESLint configured by intent — keep noise low).

Cloud Functions (from `functions/`):
- `npm run serve` — Firebase emulator for functions.
- `npm run deploy` — deploy functions only (runs `npm run lint` first via `firebase.json` predeploy).
- `npm run logs` — tail function logs.

Firebase: `firebase deploy` deploys hosting, firestore rules/indexes, functions, storage, and remote config per `firebase.json`. Hosting serves `dist/cluvie` with an SPA rewrite to `/index.html`.

## Architecture

### State model (Zustand, single store)

`src/game/store.ts` (`useGame`) is the single source of truth. Components subscribe to slices via `useGame((s) => s.field)`. The store holds:

- `quiz` — today's quiz loaded from Firestore (`Quiz` shape with embedded `clues: Clue[]`).
- `result` — per-quiz progress (`revealedClues`, `slots: SlotState[]`, `guesses`, `outcome`, `remainingPoints`). Persisted to `localStorage` under `cluevie.result`.
- `user` — long-term stats (streak, played, wins, scoreHistogram, acceptedRules). Persisted under `cluevie.user`.
- Transient search state (`searchTerm`, `searchResults`, `searchLoading`), modal flags, and a `shakeKey` counter that drives the wrong-guess shake animation.

`init()` runs once on mount, loads the quiz, and resets `result` if the cached `quizId` doesn't match — this is how "new day, new game" works.

When adding game logic, extend the store rather than introducing parallel state in components.

### Screens vs components

- `src/screens/` — full-screen views: `ActiveGame`, `Win`, `Lose`, `AlreadyPlayedToday`, plus `StatsModal` and `HowToPlayModal` overlays.
- `src/components/` — atomic UI: `ScoreSlot` + `ScoreGrid` (empty/clue/correct/incorrect states), `ClueCard` (with iris-reveal animation on entry), `Header`, `GuessInput`, `FullBilling`, `Phone` (mobile-first frame wrapper), `Countdown`, `Toast`.
- `App.tsx` picks the screen based on `status` and `result.outcome` — there is no router. After 1 hour past `completedOn`, the win/lose screen collapses into `AlreadyPlayedToday`.

### Data sources

1. **Today's quiz** — Firestore `quizzes` collection (`VITE_QUIZZES_COLLECTION`). Query: `where('date', '<=', now)`, `orderBy('date', 'desc')`, `limit(1)`. Quizzes embed `clues: Clue[]` inline; `answerId` must match a doc id in the `movies` collection.
2. **Movie autocomplete** — a flat JSON array at `VITE_MOVIES_INDEX_URL` (default: `https://storage.googleapis.com/cluvie-509e6.appspot.com/movies.json`), produced by `functions/scripts/import-tmdb-list.mjs` and uploaded to Firebase Storage. The app fetches it once on init via `prefetchMovieIndex()`, caches in `src/lib/movieIndex.ts`, and searches in memory — Firestore is **not** queried per-keystroke. The Firestore `movies` collection still exists as the source of truth (the seeding script writes both) but is not read by the client. If a movie isn't in the index, players can't type it.
3. **Results** — `addDoc` to `results` collection when a game ends. Best-effort, not awaited from UI; client treats Firestore writes as fire-and-forget for game completion.

### Design tokens (Direction A — Burgundy & Cream)

Tailwind theme extends with the named tokens from the design: `paper`, `surface`, `ink`, `muted`, `line`, `accent`, `accent-ink`, `clue`, `correct`, `incorrect`, `slot-empty`. Display font is **Shrikhand** (logo, headlines); body is **Hanken Grotesk**. Phone-frame radius is 46px; cards 16–18; slots 10. Spacing follows the 4/8/12/16/24/32 scale.

The full design spec lives under `design-specifications-answered/project/Cluvie Screens.dc.html` — read this when implementing visual changes; the prototype's inline styles are the source of truth for any numeric token not in `tailwind.config.ts`.

A second color direction (Theater Navy & Amber) exists in the spec but is **not wired** — only Direction A ships in v1. The token names match between directions, so adding a dark mode later is a one-line var swap.

### Cloud Functions auto-registration

`functions/index.js` globs `**/*.f.js` and exports each as a camelCased function name (e.g., `db/movies/onCreate.f.js` → `dbMoviesOnCreate`). The daily quiz cron (per the Track A plan, not yet merged) lives at `functions/scheduled/dailyQuiz.f.js` → `scheduledDailyQuiz`. Functions read secrets via `functions.config()` — set them with `firebase functions:config:set` before deploy. See `docs/plans/2026-06-18-track-a-implementation-plan.md` for the full backend roadmap.

### Environment / secrets

- `.env.local` (gitignored) holds `VITE_FIREBASE_*` values for the dev server. `.env.example` enumerates the keys. The Firebase web API key is a public client config (Firestore rules are the real security boundary) but conventionally stays out of git.
- `functions/cluvie-509e6-firebase-adminsdk-*.json` is a **service account private key** committed to the repo. Treat it as sensitive; do not echo, log, or include its contents in any output, PR, or commit message.
- `firestore.rules` is permissive — the server side cannot rely on validation.

## Conventions

- TypeScript strict mode with `noUnusedLocals` / `noUnusedParameters`. The build (`tsc -b`) runs in `npm run build`; CI failures usually point here.
- Tailwind is the styling layer — prefer utility classes over CSS modules. Custom pieces (eyebrow text, buttons, animations) are defined as `@layer components` rules in `src/index.css` and as `extend` entries in `tailwind.config.ts`. Don't introduce a CSS-in-JS dependency.
- One-file-per-component, named exports, no default exports. PascalCase filenames for components.
- The `Phone` wrapper centers a max-width-480 column on desktop and goes full-bleed on mobile — design is mobile-first, desktop is a graceful fallback, never the primary target.
- Firestore queries use the **modular** SDK (`collection`, `query`, `where`, `getDocs`, `addDoc`). No `compat/` imports.
