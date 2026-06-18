export interface Clue {
  clueId?: string;
  index: number;
  name: string;
  avatar: string;
  character?: string;
}

export interface Quiz {
  id: string;
  cluevieQuizId?: string;
  movieId: string;
  answerId: string;
  title: string;
  year: string;
  genre: string;
  image: string;
  clues: Clue[];
  sourceList?: string;
  sourceUrl?: string;
  quizNumber?: number;
  date?: { seconds: number; nanoseconds: number } | Date;
}

export interface MovieSummary {
  id: string;
  name: string;
  term: string;
  image?: string;
  year?: string;
}

export type SlotState = "empty" | "clue" | "correct" | "incorrect";

export type Outcome = "playing" | "won" | "lost";

export interface Guess {
  id: string;
  name: string;
  correct: boolean;
}

export interface Result {
  quizId: string;
  revealedClues: number;
  slots: SlotState[];
  guesses: Guess[];
  outcome: Outcome;
  remainingPoints: number;
  completedOn?: number;
}

export interface UserState {
  acceptedRules: boolean;
  streak: number;
  maxStreak: number;
  played: number;
  wins: number;
  lastPlayedDate: string | null;
  scoreHistogram: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
}
