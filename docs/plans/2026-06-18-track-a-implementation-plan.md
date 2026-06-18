# Track A Implementation Plan — Cluvie Daily Quiz Pipeline

**Date:** 2026-06-18
**Status:** Ready for implementation
**Scope:** Track A only — Cloud Functions backend. Does **not** touch `src/`.
**Parent design:** `docs/plans/2026-06-18-imdb-quiz-pipeline-and-angular-upgrade-design.md`

## Guiding constraints

- Follow the existing `functions/**/*.f.js` auto-registration glob (`functions/index.js`). Filenames map to camelCase export names: `functions/scheduled/dailyQuiz.f.js` → `scheduledDailyQuiz`.
- Reuse the existing `functions.config()` secret pattern (the same way `service.account`, `service.db`, and `storage.movie.name` are wired in `functions/db/movies/onCreate.f.js`).
- Lint style: ESLint with `google` + double quotes, per `functions/.eslintrc.js`. The `firebase.json` predeploy runs `npm run lint` — anything new must pass lint before deploy.
- Preserve the existing `Quiz` and `Clue` shapes (`src/app/models/quiz.ts`) so the live Angular 12 client keeps reading the same documents.
- Permissive `firestore.rules` mean the server side cannot rely on any validation — be defensive in the function (idempotent writes, no partial state).

## New npm dependencies

To be added to `functions/package.json` (NOT in this PR — see step 2):

- `@anthropic-ai/sdk` — official Anthropic client. Latest stable (5.x as of this date).
- `cheerio` — server-side HTML parsing/trimming before sending to Claude (raw IMDB pages are large; we want to strip `<script>`, `<style>`, `<svg>`, comments, and inline data blobs before paying for tokens).
- `p-retry` — small retry wrapper for TMDB and Anthropic calls (Anthropic SDK has built-in retries but TMDB does not).

`axios` is already present (`^0.26.0`). The major version of `axios` is old but adequate for TMDB GETs; do not bump it as part of this track.

**Dev deps:**
- `mocha` and `chai` — match Firebase's recommended unit-test style and `firebase-functions-test` (already in devDeps). Alternatively `jest`. Pick **mocha** for consistency with `firebase-functions-test` examples and to avoid pulling in babel/transform machinery.
- `nock` — mock HTTP for axios/TMDB tests.
- `sinon` — stub the Anthropic client and Firestore admin in unit tests.

## Node engine

`functions/package.json` currently pins `node: 16`. Node 16 is end-of-life in the Firebase Functions runtime — it cannot be deployed on new projects (Firebase Functions v1 dropped Node 16 in 2024). Recommended target: **Node 20** (Firebase Functions Gen 1 LTS).

- This change is out of scope for the first commit but must happen before deploy (see step 9). Bumping the engine forces the `firebase-functions` and `firebase-admin` versions to current; that ripple is large enough to deserve its own commit and a smoke test of the existing `dbMoviesOnCreate` trigger before the new code merges.

## Config keys to set via `firebase functions:config:set`

Before any deploy of Track A code:

```
firebase functions:config:set \
  anthropic.api_key="sk-ant-..." \
  anthropic.model="claude-opus-4-5-20250929" \
  tmdb.api_key="..." \
  tmdb.base_url="https://api.themoviedb.org/3" \
  quiz.timezone="UTC" \
  quiz.dedup_days="365"
```

Existing keys (`service.account`, `service.db`, `storage.movie.name`) stay as-is.

The model name is pinned in config — never hard-coded — so swapping Claude Sonnet vs Opus does not require a redeploy.

---

## Commit-sized steps

### Step 1 — Seed `config/topLists` Firestore document

**Goal:** Make the cron's list source data-driven and editable from the Firebase console.

**Recommendation: manual seed via Firebase console.** It's a single document, edited rarely. A script is overkill and adds maintenance burden. Document the exact JSON shape in this plan and in a code comment so a future operator can recreate it. The console UI handles array-of-map fields fine for ~10 entries.

**Files created / modified:**
- *(none — this is a Firestore data change)*
- Operator runbook section in this plan (below)

**Document shape (`config/topLists`):**
```
{
  lists: [
    { name: "IMDB Top 250", url: "https://www.imdb.com/chart/top/" },
    { name: "IMDB Top Rated English Movies", url: "https://www.imdb.com/chart/top-english-movies/" },
    { name: "IMDB Most Popular Movies", url: "https://www.imdb.com/chart/moviemeter/" }
  ],
  updatedAt: <server timestamp>
}
```

**Validation:**
- In Firebase console → Firestore → `config/topLists` exists, `lists` is a non-empty array, each entry has `name` and `url` strings.
- Manual emulator check: `firebase emulators:start --only firestore` then import a fixture; the picker (step 5) should read it.

**Dependencies:** none.

**Risks:**
- If the doc is deleted, the cron must fail loudly (not silently fall back to a hard-coded list). Step 5 enforces this.

---

### Step 2 — Add new npm dependencies and lint config

**Goal:** Pin all backend libraries before any logic lands so subsequent commits are pure code.

**Files modified:**
- `functions/package.json` — add `@anthropic-ai/sdk`, `cheerio`, `p-retry` to `dependencies`; add `mocha`, `chai`, `nock`, `sinon` to `devDependencies`; add `"test": "mocha --recursive 'test/**/*.spec.js'"` to scripts; do NOT bump engine yet.
- `functions/package-lock.json` — regenerated by `npm install`.
- `functions/.eslintrc.js` — add `mocha: true` to `env` so test files don't fail lint on `describe`/`it`.

**Code structure:** none yet; this commit is dependency hygiene only.

**Validation:**
- `npm install` in `functions/` succeeds with no peer warnings worth fixing.
- `npm run lint` still passes (no source changes).
- `npm test` runs and reports "0 passing" (no specs yet).

**Dependencies:** none.

**Risks:**
- `@anthropic-ai/sdk` 5.x requires Node 18+. The engine in `package.json` is still 16. We tolerate the install-time warning until step 9; emulator on local Node 20 works fine.
- `p-retry` v5+ is ESM-only. Pin to v4.x for CommonJS compatibility.

---

### Step 3 — `functions/lib/config.js`: centralized secret reader

**Goal:** Single place that translates `functions.config()` into a typed-ish config object so each module doesn't reach into `functions.config()` directly. Makes mocking trivial in tests.

**Files created:**
- `functions/lib/config.js`

**Module shape:**
```js
// functions/lib/config.js
const functions = require("firebase-functions");

function loadConfig() {
  const cfg = functions.config();
  return {
    anthropic: {
      apiKey: cfg.anthropic && cfg.anthropic.api_key,
      model: cfg.anthropic && cfg.anthropic.model,
    },
    tmdb: {
      apiKey: cfg.tmdb && cfg.tmdb.api_key,
      baseUrl: (cfg.tmdb && cfg.tmdb.base_url) || "https://api.themoviedb.org/3",
    },
    quiz: {
      timezone: (cfg.quiz && cfg.quiz.timezone) || "UTC",
      dedupDays: parseInt((cfg.quiz && cfg.quiz.dedup_days) || "365", 10),
    },
  };
}

module.exports = { loadConfig };
```

**Validation:**
- Unit test (`test/lib/config.spec.js`) that stubs `functions.config()` and asserts defaults plus overrides.

**Dependencies:** step 2.

**Risks:**
- `functions.config()` is being deprecated by Firebase in favor of `defineSecret()` / params. This is fine for now (existing code uses it) but we should note it as a follow-up.

---

### Step 4 — `functions/lib/anthropicClient.js`: Anthropic SDK setup

**Goal:** Construct the Anthropic client once per cold start with the key from `lib/config`.

**Files created:**
- `functions/lib/anthropicClient.js`

**Module shape:**
```js
// functions/lib/anthropicClient.js
const Anthropic = require("@anthropic-ai/sdk");
const { loadConfig } = require("./config");

let _client = null;

function getClient() {
  if (_client) return _client;
  const { anthropic } = loadConfig();
  if (!anthropic.apiKey) {
    throw new Error("anthropic.api_key is not set in functions config");
  }
  _client = new Anthropic({ apiKey: anthropic.apiKey });
  return _client;
}

module.exports = { getClient };
```

**Validation:**
- Unit test stubs `functions.config()` and asserts `getClient()` is memoized and throws on missing key.

**Dependencies:** steps 2, 3.

**Risks:**
- Cold-start cost: the SDK is ~500 KB. Acceptable for a once-a-day cron.

---

### Step 5 — `functions/lib/tmdbClient.js`: TMDB axios wrapper

**Goal:** Thin axios wrapper that injects the TMDB API key and the base URL, plus retry-with-backoff.

**Files created:**
- `functions/lib/tmdbClient.js`

**Module shape:**
```js
// functions/lib/tmdbClient.js
const axios = require("axios");
const pRetry = require("p-retry");
const { loadConfig } = require("./config");

function createClient() {
  const { tmdb } = loadConfig();
  if (!tmdb.apiKey) throw new Error("tmdb.api_key not set");
  const instance = axios.create({
    baseURL: tmdb.baseUrl,
    timeout: 10000,
    params: { api_key: tmdb.apiKey },
  });
  return {
    findByImdbId: (imdbId) =>
      pRetry(() => instance.get(`/find/${imdbId}`,
        { params: { external_source: "imdb_id" } }), { retries: 3 }),
    getMovieCredits: (tmdbId) =>
      pRetry(() => instance.get(`/movie/${tmdbId}/credits`), { retries: 3 }),
    getMovieDetails: (tmdbId) =>
      pRetry(() => instance.get(`/movie/${tmdbId}`), { retries: 3 }),
  };
}

module.exports = { createClient };
```

**Validation:**
- `test/lib/tmdbClient.spec.js` uses `nock` to mock `https://api.themoviedb.org/3/find/tt0111161?...` etc. Verify the api_key query param is appended; verify retry on 503.

**Dependencies:** steps 2, 3.

**Risks:**
- TMDB has aggressive rate limits (~40 req / 10 s). One movie per day → not a problem in steady state. The backfill script (step 11) is where this matters.

---

### Step 6 — `functions/lib/imdbFetcher.js`: HTML fetcher with User-Agent

**Goal:** Single-purpose module that downloads the HTML for a given IMDB list URL and pre-processes it (strips noise) before passing to Claude.

**Files created:**
- `functions/lib/imdbFetcher.js`

**Module shape:**
```js
// functions/lib/imdbFetcher.js
const axios = require("axios");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (compatible; CluvieBot/1.0; +https://cluvie.com)";

async function fetchListHtml(url) {
  const res = await axios.get(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    timeout: 15000,
  });
  return res.data;
}

function trimHtmlForLlm(html) {
  const $ = cheerio.load(html);
  $("script, style, svg, noscript, link, meta, header, footer, nav").remove();
  $("*").contents().filter(function () { return this.type === "comment"; }).remove();
  // Keep only the main chart/list container if we can find it
  const main = $("[data-testid='chart-layout-main-column'], main, #main").first();
  return (main.length ? main.html() : $("body").html()).slice(0, 120000);
}

module.exports = { fetchListHtml, trimHtmlForLlm };
```

**Validation:**
- `test/lib/imdbFetcher.spec.js`: feed a captured fixture file (`test/fixtures/imdb-top-250.html`) into `trimHtmlForLlm` and assert the output is < 120 KB and contains the string `tt0111161` (Shawshank).
- `nock` test for `fetchListHtml` to assert UA header.

**Dependencies:** step 2.

**Risks:**
- IMDB may serve a JS-rendered page; the fixtures must be the actual server response (curl with our UA), not the DevTools-rendered DOM. If pages turn out to be JS-only, fallback in design notes: swap to TMDB's discover endpoint.

---

### Step 7 — `functions/lib/llmPicker.js`: Claude movie-picker

**Goal:** Given trimmed HTML + exclude set, return `{ title, year, imdbId }` for one chosen movie.

**Files created:**
- `functions/lib/llmPicker.js`
- `functions/test/fixtures/imdb-top-250-trimmed.html` — captured once, committed.
- `functions/test/fixtures/anthropic-response-ok.json` — canned Claude response.
- `functions/test/fixtures/anthropic-response-malformed.json` — for negative path.

**Module shape:**
```js
// functions/lib/llmPicker.js
const { getClient } = require("./anthropicClient");
const { loadConfig } = require("./config");

const SYSTEM_PROMPT = `
You are choosing one movie from an IMDB list page for a daily trivia game.
Return strictly JSON: {"title": string, "year": number, "imdbId": string}.
Pick a movie that is well-known but not in the exclude list. imdbId must be the tt... id present in the HTML.
`.trim();

async function pickMovie({ html, excludeImdbIds }) {
  const client = getClient();
  const { anthropic } = loadConfig();
  const resp = await client.messages.create({
    model: anthropic.model,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content:
        `EXCLUDE these imdbIds (already used in last year):\n${excludeImdbIds.join(", ")}\n\n` +
        `HTML:\n${html}`,
    }],
  });
  const text = resp.content.map((b) => b.text || "").join("");
  const parsed = extractJson(text);
  validatePick(parsed, excludeImdbIds);
  return parsed;
}

function extractJson(text) { /* strip ```json fences, JSON.parse */ }
function validatePick(p, exclude) {
  if (!p || !p.imdbId || !/^tt\d{7,}$/.test(p.imdbId))
    throw new Error("LLM returned malformed pick");
  if (exclude.includes(p.imdbId))
    throw new Error("LLM picked an excluded movie");
}

module.exports = { pickMovie };
```

**Fixtures to capture:**
- `imdb-top-250-trimmed.html` — run `curl https://www.imdb.com/chart/top/ -A '<our UA>' | node trim.js` (one-shot), commit ~50–100 KB of HTML.
- `anthropic-response-ok.json` — actual response from a real run, sanitized of any usage IDs.
- `anthropic-response-malformed.json` — hand-edited copy that omits `imdbId`.
- `exclude-list-empty.json` and `exclude-list-with-shawshank.json` — JSON arrays of imdbIds.

**Unit tests (`test/lib/llmPicker.spec.js`):**
- Stub `getClient()` with sinon to return a fake whose `.messages.create` resolves the `anthropic-response-ok.json` fixture. Assert pickMovie returns `{title, year, imdbId}`.
- Assert pickMovie throws on malformed JSON fixture.
- Assert pickMovie throws if the returned `imdbId` is in the exclude list.

**Validation:**
- `npm test` passes the three picker specs.
- No live Anthropic call in CI.

**Dependencies:** steps 3, 4.

**Risks:**
- Prompt drift: small changes to the prompt can dramatically change pick quality. Snapshot the prompt text in fixtures so reviewers see prompt changes in diffs.
- Excessive prompt size: cap HTML at 120 KB (~30K tokens) in step 6; if Claude truncates we'd silently get bad picks. Mitigation: log token usage from the response.

---

### Step 8 — `functions/lib/tmdbResolver.js`: IMDB id → 6 clues

**Goal:** Given an `imdbId`, return `{ tmdbId, title, year, image, genre, clues: Clue[] }` ready to write into Firestore. Aborts cleanly if fewer than 6 cast members with `profile_path` exist.

**Files created:**
- `functions/lib/tmdbResolver.js`
- `functions/test/fixtures/tmdb-find-tt0111161.json`
- `functions/test/fixtures/tmdb-credits-278.json`
- `functions/test/fixtures/tmdb-details-278.json`
- `functions/test/fixtures/tmdb-credits-thin.json` (only 3 cast with profile_path — for the abort-path test)

**Module shape:**
```js
// functions/lib/tmdbResolver.js
const { createClient } = require("./tmdbClient");

const PROFILE_BASE = "https://image.tmdb.org/t/p/w185";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

async function resolveByImdbId(imdbId, quizId) {
  const tmdb = createClient();
  const findRes = await tmdb.findByImdbId(imdbId);
  const movieStub = (findRes.data.movie_results || [])[0];
  if (!movieStub) throw new Error(`TMDB find returned no movie for ${imdbId}`);
  const tmdbId = movieStub.id;

  const [creditsRes, detailsRes] = await Promise.all([
    tmdb.getMovieCredits(tmdbId),
    tmdb.getMovieDetails(tmdbId),
  ]);
  const eligible = creditsRes.data.cast
    .filter((c) => c.profile_path && c.name)
    .sort((a, b) => b.order - a.order); // last-billed first
  if (eligible.length < 6) {
    const err = new Error("INSUFFICIENT_CAST");
    err.code = "INSUFFICIENT_CAST";
    throw err;
  }
  const top6 = eligible.slice(0, 6);
  const clues = top6.map((c, idx) => ({
    clueId: `${quizId}-${idx}`,
    quizId,
    index: idx,
    name: c.name,
    avatar: `${PROFILE_BASE}${c.profile_path}`,
  }));

  return {
    tmdbId: String(tmdbId),
    title: detailsRes.data.title,
    year: (detailsRes.data.release_date || "").slice(0, 4),
    image: detailsRes.data.poster_path ? `${POSTER_BASE}${detailsRes.data.poster_path}` : "",
    genre: (detailsRes.data.genres || []).map((g) => g.name).join(", "),
    clues,
  };
}

module.exports = { resolveByImdbId };
```

**Unit tests (`test/lib/tmdbResolver.spec.js`):**
- Use `nock` to mock `/find/tt0111161`, `/movie/278/credits`, `/movie/278` with the fixtures. Assert 6 clues, reverse-billed order (highest `order` first), avatar URLs built from `profile_path`, year is 4 chars.
- Assert `INSUFFICIENT_CAST` error thrown when credits fixture has < 6 with `profile_path`.

**Validation:** `npm test`.

**Dependencies:** step 5.

**Risks:**
- `cast[].order` is occasionally missing or zero across all entries — fall back to original array order in that case (small refinement; not in v1).
- TMDB poster CDN base may rotate. Hard-coding `image.tmdb.org/t/p/w500` is the documented pattern.

---

### Step 9 — Bump `functions` node engine

**Goal:** Move `functions/package.json` `engines.node` from `16` → `20` and update Firebase Functions / Admin SDKs to versions that support it. This is its own commit so the existing `dbMoviesOnCreate` trigger can be smoke-tested in isolation.

**Files modified:**
- `functions/package.json` — `engines.node: "20"`, bump `firebase-functions` to `^4.9.x` (last v1-API release supporting Node 20), `firebase-admin` to `^12.x`, regenerate lock.
- `functions/db/movies/onCreate.f.js` — verify it still compiles with Admin 12; the `admin.storage()` API is unchanged but `bucket.upload` still works. No code edits expected.

**Validation:**
- `firebase emulators:start --only functions,firestore,storage` then create a doc in `movies/{movieId}` and confirm `dbMoviesOnCreate` runs and rewrites `movies.json` in the emulator storage.
- `npm run lint` still passes.

**Dependencies:** step 2.

**Risks:**
- Largest risk in the whole track. `firebase-functions` v4 deprecates `functions.config()` but still supports it; we keep using it. If we accidentally land on v5 we'd need to migrate to `defineSecret`. Pin to `^4.x`.
- `firebase-admin` 9 → 12 is a major bump; `admin.firestore.FieldValue.serverTimestamp()` API is stable so no migration needed.

---

### Step 10 — `functions/scheduled/dailyQuiz.f.js`: the scheduled function

**Goal:** Wire the picker + resolver + Firestore writes into a single scheduled function. Auto-registered as `scheduledDailyQuiz` by `functions/index.js`.

**Files created:**
- `functions/scheduled/dailyQuiz.f.js`
- `functions/lib/quizWriter.js` — small helper that takes the resolved movie + chosen list and writes the `quizzes`, `movies`, and returns the new quiz id.

**Module shape (`dailyQuiz.f.js`):**
```js
// functions/scheduled/dailyQuiz.f.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { loadConfig } = require("../lib/config");
const { fetchListHtml, trimHtmlForLlm } = require("../lib/imdbFetcher");
const { pickMovie } = require("../lib/llmPicker");
const { resolveByImdbId } = require("../lib/tmdbResolver");
const { writeQuiz } = require("../lib/quizWriter");

// admin.initializeApp is performed in db/movies/onCreate.f.js, but the
// auto-loader can load files in any order. Guard with try/catch.
try { admin.initializeApp(); } catch (e) { /* already initialized */ }

const SCHEDULE = "5 0 * * *";       // 00:05 UTC daily
const TIMEZONE = "Etc/UTC";
const MAX_ATTEMPTS = 3;

exports = module.exports = functions
  .runWith({ memory: "512MB", timeoutSeconds: 300 })
  .pubsub.schedule(SCHEDULE)
  .timeZone(TIMEZONE)
  .onRun(async (context) => {
    const cfg = loadConfig();
    const db = admin.firestore();

    // 1. Read config/topLists
    const topListsDoc = await db.doc("config/topLists").get();
    if (!topListsDoc.exists) throw new Error("config/topLists missing");
    const lists = topListsDoc.data().lists || [];
    if (!lists.length) throw new Error("config/topLists.lists is empty");

    // 2. Build exclude set
    const cutoff = new Date(Date.now() - cfg.quiz.dedupDays * 86400_000);
    const recent = await db.collection("quizzes")
      .where("date", ">=", cutoff).get();
    const excludeImdbIds = recent.docs
      .map((d) => d.data().sourceImdbId).filter(Boolean);

    let lastError;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const list = lists[Math.floor(Math.random() * lists.length)];
      try {
        const rawHtml = await fetchListHtml(list.url);
        const html = trimHtmlForLlm(rawHtml);
        const pick = await pickMovie({ html, excludeImdbIds });
        const resolved = await resolveByImdbId(pick.imdbId, todayQuizId());
        const quizId = await writeQuiz(db, { resolved, list, pickImdbId: pick.imdbId });
        functions.logger.info("dailyQuiz: wrote quiz", { quizId, list: list.name, imdbId: pick.imdbId });
        return null;
      } catch (err) {
        lastError = err;
        functions.logger.warn("dailyQuiz: attempt failed",
          { attempt, code: err.code, message: err.message, list: list.name });
        if (err.code === "INSUFFICIENT_CAST") {
          excludeImdbIds.push(/* the just-tried imdbId */);
          continue;
        }
        throw err; // network / LLM failures bubble up so Cloud Scheduler retries
      }
    }
    throw lastError || new Error("dailyQuiz: exhausted attempts");
  });

function todayQuizId() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}
function pad(n) { return String(n).padStart(2, "0"); }
```

**Module shape (`quizWriter.js`):**
```js
// functions/lib/quizWriter.js
const admin = require("firebase-admin");

async function writeQuiz(db, { resolved, list, pickImdbId }) {
  const quizId = todayQuizId();
  const quizRef = db.collection("quizzes").doc(quizId);

  // Idempotent: skip if today's quiz already exists.
  const existing = await quizRef.get();
  if (existing.exists) return quizId;

  const quizDoc = {
    cluevieQuizId: quizId,
    movieId: resolved.tmdbId,
    title: resolved.title,
    image: resolved.image,
    year: resolved.year,
    genre: resolved.genre,
    answerId: resolved.tmdbId,
    clues: resolved.clues,
    date: admin.firestore.FieldValue.serverTimestamp(),
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    sourceList: list.name,
    sourceUrl: list.url,
    sourceImdbId: pickImdbId,
  };

  // Upsert the movies doc so the autocomplete picks it up.
  const movieDoc = {
    id: resolved.tmdbId,
    name: resolved.title,
    term: resolved.title.toLowerCase(),
    image: resolved.image,
  };

  const batch = db.batch();
  batch.set(quizRef, quizDoc);
  batch.set(db.collection("movies").doc(resolved.tmdbId), movieDoc, { merge: true });
  await batch.commit();
  return quizId;
}

module.exports = { writeQuiz };
```

**Schedule expression:** `5 0 * * *` UTC. Five minutes past midnight so we never race a poorly-clocked DST boundary or scheduler jitter. Players in any timezone get a fresh quiz before noon their next morning.

**Error handling / retry behavior:**
- Cloud Scheduler will retry a Pub/Sub-triggered function on thrown error with exponential backoff (default 3 retries). We rely on that for transient TMDB / Anthropic failures.
- `INSUFFICIENT_CAST` is *not* a transient failure — we loop in-function up to 3 times, picking different movies, before giving up.
- `writeQuiz` checks for an existing today's doc and returns early — re-runs are idempotent.
- All logs use `functions.logger` (structured JSON in Cloud Logging) so we can build log-based metrics in step 13.

**Unit tests (`test/scheduled/dailyQuiz.spec.js`):**
- `firebase-functions-test` (already in devDeps) wraps the function. Stub Firestore admin with sinon, stub `fetchListHtml`, `pickMovie`, `resolveByImdbId`. Verify:
  - Reads `config/topLists`, throws on missing.
  - On success: writes one `quizzes/{date}` doc and one `movies/{tmdbId}` doc.
  - On `INSUFFICIENT_CAST`: tries again, succeeds on second attempt.
  - On Anthropic error: re-throws (so scheduler retries).

**Dependencies:** steps 3, 4, 5, 6, 7, 8.

**Risks:**
- Race with `dbMoviesOnCreate`: when we `set()` into `movies`, the existing trigger fires and rewrites `movies.json`. That's the intended behavior. But the trigger fires on **create** only — for an existing tmdbId we'd silently skip the bulk index. Mitigation: `writeQuiz` uses `set(..., {merge:true})` which fires `onCreate` for new docs only. For overlap with the backfill (step 11), this is correct.
- `admin.initializeApp()` is currently called in `db/movies/onCreate.f.js` with explicit credentials. In a deployed Functions environment, calling `admin.initializeApp()` without args uses the default service account, which has equivalent permissions. The bare init in `dailyQuiz.f.js` is safe **only** in deployed mode; in the emulator we need `GOOGLE_APPLICATION_CREDENTIALS` to point at the service-account JSON. Document this in step 12.

---

### Step 11 — `functions/scripts/backfillMovies.js`: one-time popular-titles backfill

**Goal:** Seed the `movies` Firestore collection with ~3000–5000 popular TMDB titles so player guesses don't trivially reveal the answer set.

**Files created:**
- `functions/scripts/backfillMovies.js` (NOT a `.f.js` — must not be auto-registered as a deployed function).
- `functions/scripts/README.md` — short doc on how to run.

**Module shape:**
```js
// functions/scripts/backfillMovies.js
// Run locally:
//   GOOGLE_APPLICATION_CREDENTIALS=../cluvie-509e6-firebase-adminsdk-kci32-*.json \
//   TMDB_API_KEY=... node scripts/backfillMovies.js [--pages 250] [--dry-run]
const admin = require("firebase-admin");
const axios = require("axios");
const pRetry = require("p-retry");

const TMDB = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w500";

async function main() {
  const args = parseArgs(process.argv);
  const pages = args.pages || 250; // 20 results/page → 5000 movies
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) throw new Error("TMDB_API_KEY env var required");

  for (let page = 1; page <= pages; page++) {
    const res = await pRetry(() => axios.get(`${TMDB}/movie/popular`,
      { params: { api_key: tmdbKey, page }, timeout: 10000 }), { retries: 5 });
    const batch = db.batch();
    for (const m of res.data.results) {
      if (!m.id || !m.title) continue;
      const ref = db.collection("movies").doc(String(m.id));
      batch.set(ref, {
        id: String(m.id),
        name: m.title,
        term: m.title.toLowerCase(),
        image: m.poster_path ? `${POSTER}${m.poster_path}` : "",
      }, { merge: true });
    }
    if (!args.dryRun) await batch.commit();
    console.log(`page ${page}/${pages} (${res.data.results.length} titles)`);
    await sleep(300); // stay under TMDB's 40 req / 10 s
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

**Validation:**
- Run with `--dry-run --pages 2` first; verify console output lists ~40 titles.
- Real run with `--pages 10` against the Firestore emulator; verify `movies` collection grows by ~200.
- After full production run, verify the existing `dbMoviesOnCreate` trigger fires once per new movie — this will cause many `movies.json` re-uploads to storage, which is wasteful. **Mitigation:** disable the `dbMoviesOnCreate` deploy during the backfill window, then run a single manual export of `movies.json` after, then redeploy the trigger. (This is the operational note in `scripts/README.md`.)

**Dependencies:** step 2.

**Risks:**
- Triggering `dbMoviesOnCreate` 5000 times in a row is the biggest practical risk — it would rewrite `movies.json` 5000 times. Disable the trigger first; document in `scripts/README.md`.
- Idempotency: `set(..., {merge:true})` means rerunning is safe.

---

### Step 12 — Local testing approach with the Firebase emulator

**Goal:** A repeatable local-dev story for the cron, with no live Anthropic or TMDB calls in the default loop.

**Files created:**
- `functions/test/manual/triggerDailyQuiz.js` — a tiny script that calls the function entrypoint locally with stubbed clients. Used for end-to-end smoke without the scheduler.
- `functions/test/fixtures/config-topLists.json` — Firestore emulator import seed.

**Workflow documented in this plan:**
1. `firebase emulators:start --only functions,firestore --import test/fixtures/emulator-seed --export-on-exit` (the seed includes `config/topLists` and a few `quizzes` docs in the exclude window).
2. `export GOOGLE_APPLICATION_CREDENTIALS=./cluvie-509e6-firebase-adminsdk-*.json`
3. Hit the function via `firebase functions:shell` → `scheduledDailyQuiz()`. This runs the real Anthropic + TMDB calls; only do it manually when validating the live end-to-end path.
4. For loop testing without paying for API calls, run `node test/manual/triggerDailyQuiz.js` which imports the function module and invokes its inner pipeline with stubbed `pickMovie` / `resolveByImdbId`.

**Validation:**
- After the shell call, the Firestore emulator UI shows a new doc at `quizzes/{YYYY-MM-DD}` with 6 clues.
- The `movies` collection has the new entry.

**Dependencies:** step 10.

**Risks:**
- Emulator does not run Cloud Scheduler — there is no way to verify the cron expression locally beyond eyeballing it. Mitigation: deploy to a staging project first (step 13).

---

### Step 13 — Production rollout / enabling the schedule

**Goal:** Deploy with confidence and a kill switch.

**Steps (runbook, not code):**
1. Run all `firebase functions:config:set` calls listed at the top of this plan against the prod project.
2. Verify the engines bump (step 9) is deployable: `firebase deploy --only functions:dbMoviesOnCreate` (just the existing trigger) on Node 20.
3. Deploy `scheduledDailyQuiz`: `firebase deploy --only functions:scheduledDailyQuiz`.
4. From the Firebase console (Cloud Scheduler), confirm the job exists with cron `5 0 * * *` UTC.
5. **Smoke test in prod** before the schedule fires: from Cloud Scheduler UI, click "Run now" on the scheduled job. Watch `firebase functions:log --only scheduledDailyQuiz`.
6. Verify the new doc at `quizzes/{today}` and that the live Angular client renders it.

**Rollback:** Pause the Cloud Scheduler job (one click in the console). The function code can stay deployed.

**Kill switch:** A `config/featureFlags` doc with `dailyQuizEnabled: boolean`. The cron checks this at the top of `onRun` and returns early if false. *(Optional polish — recommend adding in a follow-up.)*

**Validation:**
- Forced run completes in < 60 s.
- Logs show structured fields `{ quizId, list, imdbId }`.

**Dependencies:** steps 1, 9, 10, 11.

**Risks:**
- First scheduled run happens at 00:05 UTC. If it fails, the existing client falls back to the most recent quiz with `date <= now` (per `QuizService` query). That means players might see "yesterday's" quiz — acceptable but worth knowing.

---

### Step 14 — Observability and alerting

**Goal:** Know within an hour if a day's quiz didn't generate.

**Files created:**
- *(none in code — Cloud Logging / Monitoring config)*
- A short ops doc section here.

**Logs to emit (already in step 10):**
- `dailyQuiz: wrote quiz` info log with `{ quizId, list, imdbId, attempt }`.
- `dailyQuiz: attempt failed` warn log with `{ attempt, code, message, list }`.
- `dailyQuiz: exhausted attempts` error log (this is what an alert listens for).
- Anthropic usage: log `{ inputTokens, outputTokens }` from the response so cost can be tracked.

**Alerts to configure (Cloud Logging → log-based metrics → alerting policy):**
1. **No success log in the last 26 hours** for `scheduledDailyQuiz` → page on-call.
2. **Any ERROR-level log** with `code: "INSUFFICIENT_CAST"` more than 3 times in 24 h (suggests the list is exhausted).
3. **TMDB or Anthropic 5xx rate** above 10 % over 1 h (early warning).

**Dashboards (Cloud Monitoring):**
- Function execution count, p95 duration, error count, memory.
- A scalar metric for "days since last successful quiz" derived from the structured log.

**Validation:**
- Trigger an artificial failure (delete `config/topLists` in a staging project, run the cron); verify the error log fires the alert.

**Dependencies:** step 13.

**Risks:**
- Log-based metrics have a few-minutes delay. A 26-hour alert window is safe.

---

## Cross-step risks & open questions

- **IMDB ToS.** Re-stated from the design: scraping IMDB is technically against their terms. The fallback (TMDB discover endpoint) is identical from the prompt down — only step 6 changes. If we get a 403 in production within the first week, swap step 6 to call TMDB and feed Claude the JSON directly. The prompt would change wording but the contract (`{title, year, imdbId}`) stays.
- **`functions.config()` deprecation.** Firebase is moving to `params` / `defineSecret`. Out of scope for Track A but worth a follow-up issue. The `loadConfig()` module in step 3 isolates this — only that file changes when we migrate.
- **Service account in the repo.** `functions/cluvie-509e6-firebase-adminsdk-kci32-*.json` is checked in. Track A doesn't touch this but the backfill script (step 11) uses it via `GOOGLE_APPLICATION_CREDENTIALS`. Per `CLAUDE.md`, do not echo it; do not commit any logs that include it.
- **Schedule timezone.** UTC midnight is fine for v1. If product wants "midnight America/Chicago" later, change `TIMEZONE` and the `todayQuizId()` helper together — they must agree.

## Operator runbook (quick reference)

Before first deploy:
```
firebase use <prod-project>
firebase functions:config:set \
  anthropic.api_key="..." anthropic.model="claude-opus-4-5-20250929" \
  tmdb.api_key="..." \
  quiz.timezone="UTC" quiz.dedup_days="365"
# Seed config/topLists via the Firebase console (one doc, ~3 entries).
# Pause dbMoviesOnCreate.
node functions/scripts/backfillMovies.js --pages 250
# Manually export movies.json from /movies and upload to the storage bucket.
firebase deploy --only functions
# Resume dbMoviesOnCreate (it's automatic on deploy if not paused).
# From Cloud Scheduler console: click "Run now" on scheduledDailyQuiz to smoke-test.
```
