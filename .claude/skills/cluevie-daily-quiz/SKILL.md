---
name: cluevie-daily-quiz
description: "Pick and write tomorrow's Cluevie quiz. Invoked daily by a scheduled remote routine. Reads candidate movies from Firestore, curates one for variety, sanity-checks the cast, writes the quiz doc, logs the rationale, and posts the result to Slack #cluvie."
---

# Cluevie — Daily Quiz Skill

You are picking tomorrow's daily quiz for Cluevie, a Leonard Maltin Game–style movie puzzle.

Your job: produce **one quiz for tomorrow's UTC date** by curating from a pre-verified candidate pool, then sanity-reading the final pick to catch data-quality issues that mechanical filters miss. Whether you succeed, skip, or bail, post the outcome to Slack `#cluvie`.

## Hard rules

- **No git operations.** Do not run `git add`, `git commit`, `git push`, `git fetch`, or any other git subcommand at any point during this skill. The routine is read-only with respect to source control.
- **No modifications to repo files** beyond writing the Firebase credential JSON specified in the routine prompt (Step 0 of the prompt, not Step 0 of this skill).
- **No package install / no build.** The scripts you'll run use `firebase-admin` and `axios` which are already installed inside `functions/node_modules`. Do not run `npm install`, `npm ci`, `npm run`, or anything similar.
- **One pipeline pass.** If the first picked candidate fails the sanity read, re-curate from the remaining survivors locally — do not re-run `gather-candidates.mjs`.

## Constants

- **Working dir for shell commands:** `functions/` (relative to repo root). Always `cd functions` before running scripts.
- **TMDB API key:** Provided as an env var by the routine prompt (`export TMDB_API_KEY=...`). The helper scripts read it directly.
- **Slack channel:** `#cluvie`. Resolve the channel id once with `slack_search_channels` and use it for both success and failure posts.

## Pipeline

### Step 1 — gather candidates

```bash
cd functions && node scripts/gather-candidates.mjs
```

Stdout will be a single JSON blob:

```json
{
  "alreadyScheduled": false,
  "targetDate": "2026-06-21",
  "candidates": [
    {
      "tmdbId": "278",
      "title": "The Shawshank Redemption",
      "year": "1994",
      "genre": "Drama, Crime",
      "voteCount": 27412,
      "popularity": 88.3,
      "runtime": 142,
      "clues": [{ "name": "James Whitmore", "character": "Brooks Hatlen" }]
    }
  ],
  "recentPicks": [
    { "date": "2026-06-19", "title": "...", "year": "...", "genre": "..." }
  ],
  "rejections": [
    { "tmdbId": "...", "title": "...", "reason": "vote_count=183 (< 500)" }
  ]
}
```

If JSON parsing fails, log the raw output to stderr and go to Step 6 (Slack failure).

### Step 2 — handle "already scheduled"

If `alreadyScheduled === true`, tomorrow already has a quiz (probably manual). Post a brief Slack message to `#cluvie`:

```
Cluevie auto-quiz: skipped — {targetDate} already scheduled.
```

Then exit. No Firestore writes.

### Step 3 — handle empty pool

If `candidates.length === 0`, go to Step 6 (Slack failure) with the `rejections` list.

### Step 4 — curate

Given `candidates` (up to 5) and `recentPicks` (last 10), choose one. Weigh:

- **Genre variety** — avoid repeating the same primary genre 3+ days in a row.
- **Decade variety** — avoid stacking all '90s, all 2010s, etc.
- **Mood / tone** — heavy dramas back-to-back-to-back is fatiguing; a comedy or adventure as a break is good.
- **Seasonal fit** — October leans horror/thriller; July 4 week leans blockbusters/family.
- **Runtime variety** — if recent picks are all 2.5+ hours, prefer something shorter.

Pick one candidate with a **one-sentence rationale**.

### Step 5 — sanity-read the final pick

Look at the chosen movie's six clues. Reject if:

- A clue's `name` is suspicious as a real human name (single word that isn't a known mononym, contains digits, all caps, looks like a placeholder).
- A clue's `character` looks like data noise: "Voice", "Self - Host", placeholder text.
- The same actor appears twice in the list.
- None of the six actors seem like recognizable working actors, or the character names sound like a documentary rather than a fictional film.

If rejected: drop this candidate and re-curate from the remaining survivors (back to Step 4). If you exhaust all survivors this way, go to Step 6.

### Step 6 — Slack failure post

When you can't pick (empty pool, all sanity-rejected, script error, etc.), post to `#cluvie`:

```
Cluevie auto-quiz: couldn't pick for {targetDate}.

Reason: {one-line description}

Tried (sample of N):
- 278 · The Shawshank Redemption (1994) — {why rejected}
- ...

Last 5 picks:
- 2026-06-19 · ...
- ...

Action: pick manually with `node functions/scripts/create-quiz.mjs <tmdbId> --date {targetDate}`.
```

Then exit. No Firestore writes.

### Step 7 — write the quiz

When you have a chosen `tmdbId` and a rationale:

```bash
cd functions && node scripts/write-auto-quiz.mjs \
  --tmdbId <id> \
  --date <YYYY-MM-DD> \
  --rationale "<your one-sentence rationale>" \
  --survivors-considered '[<list of tmdbIds you considered>]'
```

Parse the stdout — `{ ok: true, quizId, quizNumber, ... }`. On `ok: false`, treat as Step 6 (failure).

### Step 8 — Slack success post

Post to `#cluvie`:

```
Cluevie auto-quiz: wrote quiz No. {quizNumber} for {quizId}.

Movie: {title} ({year}) — {genre}
Rationale: {your one-sentence rationale}
```

Then exit.

## Sequence summary

```
gather-candidates.mjs → JSON
  ├─ alreadyScheduled → Slack skip post → exit
  ├─ no candidates → Slack failure post → exit
  └─ candidates →
       curate (Claude reasoning) →
       sanity-read →
         pass → write-auto-quiz.mjs → Slack success post → exit
         fail (all) → Slack failure post → exit
```

Every path ends in exactly one Slack message to `#cluvie`, except `alreadyScheduled` which also ends in one. Never more than one Slack message per run.
