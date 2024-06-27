import {Clue} from "./quiz";

export interface Result {
  quizId: string;
  guesses: Guess[];
  score: number;
  points: Point[];
  clues: number[];
  visibleClues: Clue[];
  clueIndex: number;
  outcome: Outcome;
  completed: boolean;
  noMoreClues: boolean;
  completedOn: Date;
}

export interface Guess {
  index: number;
  name: string;
  id: string;
  correct: boolean;
}

export interface Point {
  index: number;
  style: Style;
}

export enum Style {
  correct,
  incorrect,
  clue
}

export enum Outcome {
  win,
  lose
}
