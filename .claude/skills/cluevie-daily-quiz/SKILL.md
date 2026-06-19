---
name: cluevie-daily-quiz
description: "Pick and write tomorrow's Cluevie quiz. Invoked daily by a scheduled remote routine. Reads candidate movies from Firestore (already TMDB-verified by helper scripts), curates one for variety, sanity-checks the cast, writes the quiz doc, logs the rationale, and notifies via Slack on failure."
---

# Cluevie — Daily Quiz Skill

You are picking tomorrow's daily quiz for Cluevie, a Leonard Maltin Game–style movie puzzle. The full design lives at `docs/plans/2026-06-19-auto-quiz-routine-design.md`.

Your job: produce **one quiz for tomorrow's UTC date** by curating from a pre-verified candidate pool, then sanity-reading the final pick to catch data-quality issues that mechanical filters miss. If anything looks off, you bail and notify via Slack.

## Constants

- **Working dir for shell commands:** `functions/` (relative to repo root).
- **TMDB API key:** The helper scripts look for it in `process.env.TMDB_API_KEY` first, then fall back to reading `config/secrets.tmdbApiKey` from Firestore. The remote routine has no env vars, so the Firestore doc must exist before the first run.
- **Slack channel id:** set this on first deploy. Until set, use the `slack_search_channels` tool to find a sensible one (e.g. `#cluevie-ops` or a DM-to-self) and reuse it on subsequent runs by hardcoding into this file.

## Pipeline

### Step 1 — gather candidates

Run from the repo root:

```bash
cd functions && node scripts/gather-candidates.mjs
```

Stdout will be a single JSON blob with this shape:

```json
{
  "alreadyScheduled": false,
  "targetDate": "2026-06-20",
  "candidates": [
    {
      "tmdbId": "278",
      "title": "The Shawshank Redemption",
      "year": "1994",
      "genre": "Drama, Crime",
      "voteCount": 27412,
      "popularity": 88.3,
      "runtime": 142,
      "clues": [
        { "name": "James Whitmore", "character": "Brooks Hatlen" }
      ]
    }
  ],
  "recentPicks": [
    { "date": "2026-06-19", "title": "...", "year": "...", "genre": "..." }
  ],
  "rejections": [
    { "tmdbId": "...", "title": "...", "reason": "vote_count=183 (< 500)" }
  ],
  "notes": []
}
```

Parse the JSON carefully — if it fails to parse, log the raw output to stderr and treat it as a failure (Step 6).

### Step 2 — handle the "already scheduled" case

If `alreadyScheduled === true`, tomorrow is already covered (probably a manual quiz). Exit cleanly without writing anything and without sending Slack. The Firestore audit log doesn't need an entry for skipped days.

### Step 3 — handle the empty-pool case

If `candidates.length === 0`, go straight to Step 6 (notify). Include the `rejections` list in the Slack message so the user can see why every sampled candidate failed.

### Step 4 — curate the pick

Given `candidates` (up to 5) and `recentPicks` (last 10), choose one. Weigh:

- **Genre variety** — avoid repeating the same primary genre 3+ days in a row.
- **Decade variety** — avoid stacking all '90s, all 2010s, etc.
- **Mood / tone** — heavy dramas back-to-back-to-back is fatiguing; a comedy or adventure as a break is good.
- **Seasonal fit** — if it's October, horror or thriller is welcome; if it's the week of July 4, blockbusters and family movies fit. Otherwise no seasonal pressure.
- **Runtime variety** — don't insist on this, but if all recent picks are 2.5+ hours, prefer something shorter.

Pick one candidate with a **one-sentence rationale** (e.g. "Last three picks were dramas; rotating to a comedy after a long-runtime week"). Save the rationale — you'll pass it to Step 5.

### Step 5 — sanity-read the final pick

Look at the chosen movie's six clues (actor name + character name). Reject the pick if any of:

- A clue's `name` is suspicious as a real human name (single word that isn't a known mononym, contains digits, all caps, looks like a placeholder).
- A clue's `character` looks like data noise: "Voice", "Self - Host", placeholder text, repeated boilerplate. (Empty strings are fine — the deterministic filter already rejects bad ones; we're catching what slipped through.)
- The same actor appears in the list twice.
- The cast as a whole feels off — e.g., none of the six actors are recognizable working actors, or the character names sound like a documentary rather than a fictional film.

If rejected: drop this candidate and re-curate from the remaining ones (back to Step 4). If you exhaust all candidates this way, go to Step 6 (notify).

### Step 6 — failure notification

When you can't pick (empty pool, all sanity-rejected, TMDB outage, etc.), send a Slack message using `slack_send_message` to the configured channel. Format:

```
Cluevie auto-quiz routine ran but couldn't pick.

Reason: <one-line description>

Tried (from sample of N):
- 278 - The Shawshank Redemption (1994) - <why rejected>
- 238 - The Godfather (1972) - <why rejected>

Last 5 picks:
- 2026-06-19 - ...
- 2026-06-18 - ...

Action: pick tomorrow's quiz manually with `node functions/scripts/create-quiz.mjs <tmdbId> --date 2026-06-20`.
```

Then exit. No Firestore writes on failure.

### Step 7 — write the quiz

When you have a chosen `tmdbId` and a rationale, run from the repo root:

```bash
cd functions && node scripts/write-auto-quiz.mjs \
  --tmdbId <id> \
  --date <YYYY-MM-DD> \
  --rationale "<your one-sentence rationale>" \
  --survivors-considered '[<list of tmdbIds you considered>]'
```

Stdout will be `{ "ok": true, "quizId": "...", "quizNumber": N, ... }`. Parse it to confirm success. The script also writes a `quizCreationLog/{quizId}` Firestore doc with the full rationale + considered-candidates list. No additional logging is needed from you.

On `ok: false`, treat as Step 6 (notify) — include the script's `error` field in the Slack reason.

### Step 8 — success path

If write succeeded: exit silently. No Slack notification on success (noise hygiene). The Firestore log is the durable audit trail.

## Operational rules

- **Always operate from the repo root**, prefixing shell commands with `cd functions` as shown.
- **Never call TMDB directly** — the helper scripts already cap calls, handle errors, and resolve the API key. Trust their output.
- **Never modify quizzes for past dates.** This skill only writes tomorrow's quiz.
- **One `write-auto-quiz.mjs` invocation per run.** If your first pick fails sanity check, re-curate locally — don't try to write multiple quizzes.
- **No user escalation during routine runs.** You're running unattended. Use Slack for everything.
