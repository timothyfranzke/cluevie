import { create } from "zustand";
import { differenceInCalendarDays } from "date-fns";
import type { Guess, MovieSummary, Quiz, Result, SlotState, UserState } from "./types";
import { loadTodayQuiz, persistResult, prefetchMovieIndex, searchMovies } from "../lib/quiz";

const RESULT_KEY = "cluevie.result";
const USER_KEY = "cluevie.user";
const STARTING_POINTS = 6;

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function emptySlots(): SlotState[] {
  return Array.from({ length: STARTING_POINTS }, () => "empty" as SlotState);
}

function defaultUserState(): UserState {
  return {
    acceptedRules: false,
    streak: 0,
    maxStreak: 0,
    played: 0,
    wins: 0,
    lastPlayedDate: null,
    scoreHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
}

function loadResult(): Result | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    return raw ? (JSON.parse(raw) as Result) : null;
  } catch {
    return null;
  }
}

function loadUserState(): UserState {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return defaultUserState();
    return { ...defaultUserState(), ...(JSON.parse(raw) as Partial<UserState>) };
  } catch {
    return defaultUserState();
  }
}

function saveResult(result: Result) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

function saveUserState(state: UserState) {
  localStorage.setItem(USER_KEY, JSON.stringify(state));
}

function freshResult(quizId: string): Result {
  return {
    quizId,
    revealedClues: 0,
    slots: emptySlots(),
    guesses: [],
    outcome: "playing",
    remainingPoints: STARTING_POINTS,
  };
}

function firstEmptyIndex(slots: SlotState[]): number {
  return slots.findIndex((s) => s === "empty");
}

interface StoreState {
  status: "loading" | "ready" | "error";
  quiz: Quiz | null;
  result: Result;
  user: UserState;
  searchTerm: string;
  searchResults: MovieSummary[];
  searchLoading: boolean;
  showHowToPlay: boolean;
  showStats: boolean;
  shakeKey: number;

  init: () => Promise<void>;
  revealNextClue: () => void;
  submitGuess: (movie: MovieSummary) => void;
  setSearchTerm: (term: string) => void;
  acceptRules: () => void;
  openStats: () => void;
  closeStats: () => void;
  openHowToPlay: () => void;
  closeHowToPlay: () => void;
}

let searchToken = 0;

export const useGame = create<StoreState>((set, get) => ({
  status: "loading",
  quiz: null,
  result: freshResult(""),
  user: defaultUserState(),
  searchTerm: "",
  searchResults: [],
  searchLoading: false,
  showHowToPlay: false,
  showStats: false,
  shakeKey: 0,

  async init() {
    const user = loadUserState();
    set({ user, showHowToPlay: !user.acceptedRules });
    prefetchMovieIndex();
    try {
      const quiz = await loadTodayQuiz();
      if (!quiz) {
        set({ status: "error" });
        return;
      }
      const cached = loadResult();
      const result =
        cached && cached.quizId === quiz.id ? cached : freshResult(quiz.id);
      if (!cached || cached.quizId !== quiz.id) saveResult(result);
      set({ quiz, result, status: "ready" });
    } catch (err) {
      console.error("init failed", err);
      set({ status: "error" });
    }
  },

  revealNextClue() {
    const { quiz, result } = get();
    if (!quiz) return;
    if (result.outcome !== "playing") return;
    if (result.revealedClues >= quiz.clues.length) return;
    if (result.remainingPoints <= 1) return; // keep at least one point for guessing
    const slots = [...result.slots];
    const idx = firstEmptyIndex(slots);
    if (idx === -1) return;
    slots[idx] = "clue";
    const next: Result = {
      ...result,
      revealedClues: result.revealedClues + 1,
      remainingPoints: result.remainingPoints - 1,
      slots,
    };
    saveResult(next);
    set({ result: next });
  },

  submitGuess(movie) {
    const { quiz, result, user } = get();
    if (!quiz) return;
    if (result.outcome !== "playing") return;
    const correct = movie.id === quiz.answerId;
    const guess: Guess = { id: movie.id, name: movie.name, correct };
    const slots = [...result.slots];
    const idx = firstEmptyIndex(slots);
    if (idx === -1) return;
    slots[idx] = correct ? "correct" : "incorrect";
    const remainingPoints = result.remainingPoints - 1;
    const outcome = correct ? "won" : remainingPoints <= 0 ? "lost" : "playing";
    const next: Result = {
      ...result,
      guesses: [...result.guesses, guess],
      slots,
      remainingPoints,
      outcome,
      completedOn: outcome !== "playing" ? Date.now() : result.completedOn,
    };
    saveResult(next);
    if (outcome !== "playing") {
      const today = todayKey();
      const streakBroken =
        user.lastPlayedDate &&
        differenceInCalendarDays(new Date(), new Date(user.lastPlayedDate)) > 1;
      const newStreak = correct ? (streakBroken ? 1 : user.streak + 1) : 0;
      const winningSlot = correct ? Math.min(6, Math.max(1, idx + 1)) : null;
      const newHist = { ...user.scoreHistogram };
      if (winningSlot) {
        newHist[winningSlot as 1 | 2 | 3 | 4 | 5 | 6] += 1;
      }
      const newUser: UserState = {
        ...user,
        played: user.played + 1,
        wins: user.wins + (correct ? 1 : 0),
        streak: newStreak,
        maxStreak: Math.max(user.maxStreak, newStreak),
        lastPlayedDate: today,
        scoreHistogram: newHist,
      };
      saveUserState(newUser);
      set({ user: newUser });
      void persistResult(next);
    }
    set({
      result: next,
      shakeKey: correct ? get().shakeKey : get().shakeKey + 1,
      searchTerm: "",
      searchResults: [],
    });
  },

  setSearchTerm(term) {
    set({ searchTerm: term });
    const token = ++searchToken;
    if (!term.trim()) {
      set({ searchResults: [], searchLoading: false });
      return;
    }
    set({ searchLoading: true });
    void searchMovies(term).then((results) => {
      if (token !== searchToken) return;
      set({ searchResults: results, searchLoading: false });
    });
  },

  acceptRules() {
    const next = { ...get().user, acceptedRules: true };
    saveUserState(next);
    set({ user: next, showHowToPlay: false });
  },

  openStats() {
    set({ showStats: true });
  },
  closeStats() {
    set({ showStats: false });
  },
  openHowToPlay() {
    set({ showHowToPlay: true });
  },
  closeHowToPlay() {
    set({ showHowToPlay: false });
  },
}));

export function buildShareGrid(result: Result, quizNumber: string): string {
  const cell = (s: SlotState) => {
    switch (s) {
      case "clue":
        return "🟨";
      case "correct":
        return "🟩";
      case "incorrect":
        return "🟥";
      default:
        return "⬜";
    }
  };
  const grid = result.slots.map(cell).join("");
  const score =
    result.outcome === "won" ? `${result.remainingPoints}/6` : "X/6";
  return `Cluevie ${quizNumber} ${score}\n${grid}\nhttps://cluevie.com`;
}

export function nextMidnightUtcMs(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return next - now.getTime();
}
