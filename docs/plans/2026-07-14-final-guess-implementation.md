# Final Guess Experience — Implementation Plan

Design: `docs/plans/2026-07-14-final-guess-design.md`
Branch: `worktree-final-guess`

Each task compiles on its own (`npm run build`); commit after each.

## Task 1 — Clue-offset helper

**New file `src/game/clues.ts`:**

```ts
import type { Clue, Quiz } from "./types";

// Gameplay skips clue 1 (most obscure); playable clues are indexes 2..6.
export function playableClues(quiz: Quiz): Clue[] {
  return [...quiz.clues].sort((a, b) => a.index - b.index).slice(1);
}

export function revealedClues(quiz: Quiz, count: number): Clue[] {
  return playableClues(quiz).slice(0, count);
}
```

Named exports, no default — per conventions.

## Task 2 — Store: reveal guard, shared game-end, `giveUp()`

In `src/game/store.ts`:

1. `revealNextClue`: change the length guard to
   `result.revealedClues >= quiz.clues.length - 1` (5 playable of 6).
2. Extract the end-of-game block from `submitGuess` (store.ts:172–195:
   streak calc, histogram, `saveUserState`, `persistResult`) into a
   module-level helper, e.g.
   `finishGame(set, get, next: Result, correct: boolean, winningSlot: number | null)`.
   `submitGuess` behavior must be byte-for-byte identical after the
   refactor.
3. New action `giveUp()`:
   - no-op unless `outcome === "playing"`;
   - mark the first empty slot `"incorrect"`, set `remainingPoints: 0`,
     `outcome: "lost"`, `completedOn: Date.now()`; **do not** append to
     `guesses` (the give-up detector in Task 6 relies on this);
   - `saveResult`, then `finishGame(..., correct: false, winningSlot: null)`;
   - `set({ result: next, searchTerm: "", searchResults: [] })` — no shake.

Add `giveUp: () => void` to `StoreState`.

## Task 3 — ActiveGame uses the offset; ordinals read "of 5"

In `src/screens/ActiveGame.tsx`:

- Replace the `visibleClues` sort/slice with
  `revealedClues(quiz, result.revealedClues).reverse()`.
- `noMoreClues` becomes `result.revealedClues >= quiz.clues.length - 1`.
- Pass `total={quiz.clues.length - 1}` to `ClueCard` (renders "Clue N of 5").

No `ClueCard` changes — it already takes `total` as a prop.

## Task 4 — FullBilling marks revealed by actual index

`src/components/FullBilling.tsx` currently marks the top `revealedCount`
rows of the descending billing (headliner first) as revealed — wrong under
both old and new mechanics. Change: keep the `revealedCount` prop, compute
the revealed set as clue indexes `2 .. revealedCount + 1` (ascending
playable order), and set `wasRevealed` by membership:

```ts
const wasRevealed = c.index >= 2 && c.index <= revealedCount + 1;
```

Call sites in `Win.tsx:53` / `Lose.tsx:50` are unchanged.

Note: `wasRevealed` styling is `opacity-60` + clue-colored avatar ring —
verify visually that the *unrevealed* actors now read as the prominent
ones (this is the existing intent: revealed clues are old news).

## Task 5 — `CastRecap` + `FinalGuess` screen

**New `src/components/CastRecap.tsx`** — props `{ clues: Clue[] }`:
a 2-column grid (`grid grid-cols-2 gap-3`), each cell a compact card:
`Avatar` (existing component, ~48px), actor name bold 14px, `as Character`
in muted 12.5px. With 1–2 entries, center them (`justify-items-center` or
single column). Surface/line/rounded-card tokens, matching `ClueCard`.

**New `src/screens/FinalGuess.tsx`** — layout top to bottom:

1. `<Header size="sm" ...>` with the same rules/stats handlers.
2. Eyebrow "Last chance" + `font-display` headline "Make your final guess"
   (mirror the eyebrow/headline pattern in `Lose.tsx:22–27`).
3. `<ScoreGrid slots={result.slots} size="sm" />`.
4. Year/Genre row — same markup as `ActiveGame.tsx:44–66`.
5. `<CastRecap clues={revealedClues(quiz, result.revealedClues)} />`;
   if zero clues were revealed, show a muted "You went in blind." line
   instead of an empty grid.
6. Bottom bar (border-t, bg-paper, like ActiveGame's): `<GuessInput />`
   then an "I give up" button (`btn-outline`).
7. Confirm modal via local `useState<boolean>`: fixed overlay + centered
   card (mirror `HowToPlayModal`'s overlay classes). Copy: headline
   "Are you sure?", body "There's no going back after this!". Buttons:
   "Keep playing" (btn-primary) and "Show me the answer" (btn-outline,
   `text-incorrect`). Backdrop click dismisses. Confirm → `giveUp()`.

**Wire up in `src/screens/ActiveGame.tsx`:** at the top,
`if (result.remainingPoints === 1) return <FinalGuess />;`
(ActiveGame only renders while `outcome === "playing"`, so no outcome
check needed). App.tsx untouched.

## Task 6 — Lose headline variant for give-ups

In `src/screens/Lose.tsx`: a give-up leaves a filled slot with no matching
guess, so

```ts
const filled = result.slots.filter((s) => s !== "empty").length;
const gaveUp = filled > result.revealedClues + result.guesses.length;
```

Headline: `gaveUp ? "Tomorrow's another day" : "Out of points"`; eyebrow
stays "Better luck".

## Task 7 — Verification

- `npm run build` (tsc strict is the CI gate).
- `npm run dev`, then in the browser console seed a final-guess state:

```js
// after the quiz loads, grab the real quizId from localStorage first
const r = JSON.parse(localStorage.getItem("cluevie.result"));
r.revealedClues = 5;
r.slots = ["clue","clue","clue","clue","clue","empty"];
r.remainingPoints = 1;
localStorage.setItem("cluevie.result", JSON.stringify(r));
location.reload();
```

Manual checks:
1. Fresh game: 5 reveals end on the headliner (highest billing), ordinals
   read "of 5", reveal button disables after the 5th.
2. Final-guess screen appears at 1 point; shows only revealed actors;
   correct guess → Win with 1/6; wrong guess → Lose with "Out of points".
3. Give up: modal copy/buttons, backdrop dismiss, confirm → Lose with
   "Tomorrow's another day", streak reset, played +1, share grid ends 🟥.
4. Win/Lose full billing marks exactly the revealed indexes (2..N+1);
   clue 1 and any unrevealed clues render prominent.
5. Partial-reveal path: reveal 2, guess wrong 3× → final guess shows 2
   actors; reveal 0, guess wrong 5× → "You went in blind."
