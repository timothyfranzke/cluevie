# Auto-Quiz Routine — Design

**Date:** 2026-06-19
**Status:** Approved, ready for implementation

## Summary

A Claude skill, invoked daily by a scheduled remote routine, picks tomorrow's daily quiz from the seeded `movies` pool. The routine combines deterministic filters (TMDB vote_count, cast verification) with a Claude reasoning pass that curates for variety and sanity-checks the final pick. If everything looks clean, it writes the quiz to Firestore. If anything's off, it bails and pings Slack — better no-quiz than a bad-quiz.

Out of scope: backfilling missing past days, picking week-ahead batches, hand-authoring tooling.

## Game state recap (carried forward)

- One quiz per day, keyed by `quizzes/{YYYY-MM-DD}` (UTC midnight).
- `answerId` matches a `movies/{tmdbId}` doc; player guesses are validated against it.
- Six clues per quiz, last-billed first (most obscure → headliner).
- The seeded `movies` collection is the answer pool. Anything not in it isn't typeable in autocomplete.

## Pipeline

The routine fires daily at **18:00 UTC**. Each run:

1. **Check the schedule.** Compute tomorrow's `YYYY-MM-DD` (UTC). Read `quizzes/{tomorrow}`. If it exists, log "already scheduled" and exit. Watchdog behavior — manual quizzes win.
2. **Build the dedup set.** Read `quizzes` where `date > now - 365 days`. Project `answerId` (TMDB ids) into the exclusion set.
3. **Sample the eligible pool.** Read `movies` collection, filter out the dedup set, random-sample 25 candidates. Also read the 10 most recently used picks for context.
4. **Deterministic verify + filter.** For each candidate, call TMDB `/movie/{id}` and `/movie/{id}/credits`:
   - Reject if `vote_count <= 500` (obscurity guard).
   - Reject if fewer than 6 cast members pass: `profile_path` exists AND `known_for_department === "Acting"` AND `character` not in blocklist (`Self`, `Themselves`, `Uncredited`, empty, names with no letters).
   - Stop calling TMDB once 5 verified survivors are in hand. Bounded API budget.
5. **Claude curates.** Given the 5 survivors and the 10 recent picks, weigh genre / decade / mood / seasonal fit and pick one with a one-sentence rationale.
6. **Sanity pass on the final pick.** Re-read the chosen movie's 6-actor cast. If anything looks like data noise (one-name actors, suspicious character labels, repeated person, names that don't read as human names), reject and fall back to the next survivor. If all 5 fail this pass, abort the run and notify.
7. **Write the quiz.** Invoke `write-auto-quiz.mjs --tmdbId <id> --date <YYYY-MM-DD>`. Writes the full `Quiz` doc including auto-incremented `quizNumber`.
8. **Log the pick.** Write a `quizCreationLog/{YYYY-MM-DD}` doc with the rationale, the surviving-candidates list, and the TMDB ids that were considered. Audit trail.

## Splitting the work: code vs reasoning

**Deterministic (code in `auto-quiz.mjs`):**

- Schedule check, dedup, pool sample.
- TMDB pulls + hard rejects on quantitative thresholds.
- Cast filtering against the blocklist.
- The "until 5 survivors" loop.
- All Firestore reads + writes.

**Claude reasoning (skill instructions in `SKILL.md`):**

- Choose one of the 5 survivors with rationale, accounting for variety vs recent picks.
- Sanity-read the final pick's cast and reject if anything feels like a data-quality issue. Walk down the survivor list if needed.
- Compose the notification message on failure.

The hand-off contract is a JSON blob the helper script emits:

```ts
{
  alreadyScheduled: boolean,
  candidates: Array<{
    tmdbId: string,
    title: string,
    year: string,
    genre: string,
    voteCount: number,
    popularity: number,
    clues: Array<{ name: string, character: string }>
  }>,
  recentPicks: Array<{ date: string, title: string, year: string, genre: string }>
}
```

That's all the context Claude needs. No additional MCP calls during reasoning.

## Failure handling

| Failure | Behavior |
|---|---|
| Tomorrow already scheduled | Log "skipped, manual quiz exists", exit 0. |
| Pool exhausted (0 candidates after filters) | Notify Slack, exit 0. |
| TMDB 5xx for all candidates | Notify Slack ("transient API failure, retry tomorrow"), exit 0 — the next day's routine will try again. |
| All 5 survivors fail Claude's sanity pass | Notify Slack with the names tried + what felt off, exit 0. |
| Firestore write fails | Notify Slack with the resolved pick (so it can be hand-applied), exit 1. |

The routine never writes a partial quiz — `writeAutoQuiz` checks for existing doc and uses a single `set()` call, not a multi-step merge.

## Notification — Slack

The skill calls `mcp__claude_ai_Slack__slack_send_message`. Channel id to be set at implementation time (could be a DM-to-self or a dedicated `#cluevie-ops` channel). Message format:

```
🎬 Cluevie auto-quiz routine ran but couldn't pick.

Reason: <one-line description>

Tried: <bulleted list of tmdbId · title (year)>
Last 5 picks: <list>

Action: pick tomorrow's quiz manually with `node scripts/create-quiz.mjs <tmdbId> --date <YYYY-MM-DD>`.
```

Success runs don't notify — Slack noise hygiene. The Firestore `quizCreationLog` is the always-on audit trail.

## File layout

```
functions/scripts/
  lib/
    auto-quiz.mjs          # NEW. Exports gatherCandidates({ targetDate }).
                           #   Step 1–4: schedule check, dedup, pool sample, TMDB verify.
                           #   Pure function — no Claude reasoning, no notification side effects.
  write-auto-quiz.mjs      # NEW. CLI: --tmdbId <id> --date <YYYY-MM-DD>.
                           #   Refactored from create-quiz.mjs:
                           #     - Steps 7 (write quiz) and partially 8 (log) live here.
                           #     - create-quiz.mjs becomes a thin wrapper for backward compat.
  create-quiz.mjs          # EXISTING. Now delegates to write-auto-quiz.mjs internals.

~/.claude/skills/cluevie-daily-quiz/
  SKILL.md                 # NEW. Instructs Claude through steps 1–8.
                           #   Includes hand-off JSON shape, sanity-pass criteria, Slack format.
```

The skill lives in the user's global skills dir (not in the project repo) so the scheduled routine can find it. The helper scripts live in the project repo so they're version-controlled and the design is reproducible.

## Schedule routine setup

One call to the `schedule` skill at implementation time:

```
cron: "0 18 * * *"
agent prompt: "Run the cluevie-daily-quiz skill."
```

The routine inherits the user's MCP setup, so Firestore (via `firebase-admin` in a Bash call) and Slack (via the wired MCP tools) work without extra plumbing.

## Risks and open questions

- **TMDB rate limits.** Each routine run hits TMDB up to 25 candidates × 2 endpoints = 50 calls in the worst case. Well under TMDB's ~40 req / 10s limit. No throttling needed.
- **Pool exhaustion at scale.** With ~300 movies seeded and a 365-day dedup window, the pool runs dry after a year of daily play. Detection: the "0 candidates after filters" failure notification. Mitigation: reseed more lists / categories before that point. The `quizCreationLog` doc count is a clean signal.
- **Claude reasoning drift.** If model updates change curation behavior, the rationale log shows you the trend before it bites. Worth a periodic scan of `quizCreationLog` rationales.
- **Slack channel id.** Needs to be set at implementation time. Could be hardcoded in `SKILL.md` or read from a project doc.

## Out of scope (explicit)

- Backfilling missed days. If the routine fails silently for a stretch, you fix the dates manually.
- Multi-day batches. One day at a time.
- Multiple quiz lanes (e.g., "easy" vs "hard"). Single daily quiz only.
- Cross-checking each clue actor's `/person/{id}` record (the "Heavy" verification level we rejected).
