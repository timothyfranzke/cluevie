import {Clue} from "./quiz";
import {Guess, Outcome, Point} from "./results";

export interface State {
  acceptRules: boolean;
  acceptClues: boolean;
  scores: number[],
  played: number;
  win: number;
  streak: number;
  maxStreak: number;
  lastVisit: Date;
}

