import type { Clue } from "./types";

// Gameplay skips the most obscure actor (lowest index); the five playable
// clues run from second-most-obscure up to the headliner, so a player who
// reveals every clue ends on the headliner.
export function playableClues(clues: Clue[]): Clue[] {
  return [...clues].sort((a, b) => a.index - b.index).slice(1);
}

export function revealedClues(clues: Clue[], count: number): Clue[] {
  return playableClues(clues).slice(0, count);
}
