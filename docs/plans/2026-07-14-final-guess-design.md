# Final Guess Experience — Design

**Date:** 2026-07-14
**Status:** Validated with Tim, ready for implementation planning

## Summary

When a player is down to their last point, the game shifts into a distinct
"final guess" mode: a dedicated recap screen with the year, genre, and every
actor they revealed, plus an "I give up" escape hatch. Alongside this, the
clue reveal sequence shifts by one so the headliner (clue 6) is reachable
within the five possible reveals.

## Decisions made

- **Cast recap shows only revealed actors.** Unrevealed clues stay hidden —
  the "clues cost points" principle holds even at the end.
- **Reveal sequence skips the most obscure clue.** Gameplay uses the five
  highest-billed clues, most obscure first. The lowest-billed actor never
  appears during play, only in the post-game full billing. A player who
  reveals five times ends on the headliner with 1 point left.
  (Implementation note: clue indexes are 0-based — headliner is index 5 —
  so the code selects by sorted position, not literal index values.)
- **Giving up counts as a loss.** Same outcome, stats, streak reset, and
  share grid (X/6, 🟥 last slot) as a wrong final guess. No new outcome type.

## 1. Reveal-sequence shift

No store-state changes; `result.revealedClues` remains a 0–5 count. Only
the count→clue mapping changes:

- Visible clues become `sorted.slice(1, 1 + revealedClues)` (ascending by
  index). A helper in `src/game/` (e.g., `revealedClueSet(quiz,
  revealedClues)`) owns this offset so it isn't duplicated across
  components.
- `revealNextClue`'s length guard becomes `revealedClues >=
  quiz.clues.length - 1` (max 5 reveals of 6 clues). The existing points
  guard already stops at 5; the data guard should agree.
- `ClueCard` ordinal reads "Clue N of 5".
- **`FullBilling` fix:** it currently marks "revealed" actors by counting
  from the top of the billing (headliner down), which never matched the
  actual reveal order. It changes to mark by actual clue index (indexes 2
  through `revealedClues + 1`).

No data or backend changes — quizzes keep six embedded clues; daily-quiz
generation is untouched. In-progress localStorage results stay valid.

## 2. Final-guess screen

**Trigger:** `remainingPoints === 1 && outcome === "playing"` — derived
state, no new store fields. `ActiveGame` renders `FinalGuess`
(`src/screens/FinalGuess.tsx`) when the trigger is true; `App.tsx` routing
is untouched so modal/toast wiring stays put.

**Layout** (one screen, no scrolling, top to bottom):

1. Existing small `Header`.
2. Banner: eyebrow + "Make your final guess" in Shrikhand, matching the
   win/lose eyebrow-plus-headline pattern. Small `ScoreGrid` beneath it.
3. Facts row: Year and Genre, same treatment as `ActiveGame`.
4. **`CastRecap`** (new component, `src/components/`): compact grid of the
   revealed clues only — avatar, actor name, character. Two columns in the
   480px frame; one or two entries center. `FullBilling` is not reused (it
   is a numbered list with revealed/unrevealed styling; here everything is
   revealed).
5. Existing `GuessInput`, unchanged. No "Reveal next clue" button at all.
6. "I give up" button in the quiet `btn-outline` treatment beneath the
   input — available, not tempting.

A wrong guess here ends the game through the existing `submitGuess` path
(points hit 0 → lost). No new transition logic.

## 3. "I give up" flow

**Store:** new `giveUp()` action — marks the last open slot `incorrect`,
sets `remainingPoints` to 0, `outcome` to `"lost"`, stamps `completedOn`,
and runs the same end-of-game bookkeeping as a wrong final guess (played
+1, streak reset, `persistResult`). That bookkeeping is extracted from
`submitGuess` into a shared helper both actions call.

**Confirmation modal:** local `useState` in `FinalGuess` (nothing else
needs the flag). Message: **"Are you sure? There's no going back after
this!"** — "Keep playing" is the visually primary button; "Show me the
answer" is the destructive secondary. Backdrop tap dismisses. Confirming
calls `giveUp()`.

**The reveal:** normal `outcome === "lost"` routing lands on the existing
`Lose` screen, which already shows the answer, poster, and full billing.
One copy tweak: a give-up is detectable (fewer guesses than filled slots),
and `Lose` shows "Tomorrow's another day" instead of "Out of points" in
that case.

## Verification

- `npm run build` (tsc strict) for the type check.
- Manual play-through in `npm run dev`; seed `localStorage`
  (`cluevie.result`) to jump straight to the final-guess state.
- Check: reveal ×5 ends on the headliner; final-guess screen shows only
  revealed actors; give-up confirm → Lose screen with correct stats,
  streak reset, and X/6 share grid; `FullBilling` marks the right actors.
