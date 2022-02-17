import {Clue} from "./quiz";
import {Guess, Outcome, Point} from "./results";

export interface State {
  acceptRules: boolean;
  acceptClues: boolean;
}
