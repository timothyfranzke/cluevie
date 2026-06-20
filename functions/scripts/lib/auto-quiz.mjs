// Deterministic candidate-gathering pipeline for the daily auto-quiz skill.
// All data comes from Firestore — TMDB is touched only at seeding time
// (import-tmdb-list.mjs). The routine runs in an environment where TMDB
// is blocked; this module respects that.

import adminPkg from "firebase-admin";
import {
  CLUE_COUNT,
  QUIZZES_COLLECTION,
  MOVIES_COLLECTION,
  ensureAdmin,
  eligibleCast,
  quizIdFromDate,
} from "./quiz-writer.mjs";

const DEFAULT_SAMPLE = 25;
const DEFAULT_SURVIVORS = 5;
const DEDUP_DAYS = 365;
const VOTE_COUNT_MIN = 500;
const RECENT_PICKS_FOR_CONTEXT = 10;

function logErr(...args) {
  console.error(...args);
}

function pickRandomSubset(arr, n) {
  if (arr.length <= n) return [...arr];
  const a = [...arr];
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
    out.push(a[i]);
  }
  return out;
}

export async function gatherCandidates({
  targetDate,
  sampleSize = DEFAULT_SAMPLE,
  targetSurvivors = DEFAULT_SURVIVORS,
} = {}) {
  if (!(targetDate instanceof Date)) throw new Error("targetDate must be a Date");

  const db = ensureAdmin();
  const targetQuizId = quizIdFromDate(targetDate);

  // Step 1: schedule check
  const targetSnap = await db.collection(QUIZZES_COLLECTION).doc(targetQuizId).get();
  if (targetSnap.exists) {
    return {
      alreadyScheduled: true,
      targetDate: targetQuizId,
      candidates: [],
      recentPicks: [],
      notes: ["Tomorrow already has a quiz; nothing to do."],
    };
  }

  // Step 2: dedup set + recent picks for variety context
  const cutoff = new Date(targetDate.getTime() - DEDUP_DAYS * 86400 * 1000);
  const recentSnap = await db
    .collection(QUIZZES_COLLECTION)
    .where("date", ">=", adminPkg.firestore.Timestamp.fromDate(cutoff))
    .orderBy("date", "desc")
    .get();

  const exclude = new Set();
  const recentPicks = [];
  for (const doc of recentSnap.docs) {
    const d = doc.data();
    if (d.answerId) exclude.add(String(d.answerId));
    if (recentPicks.length < RECENT_PICKS_FOR_CONTEXT) {
      recentPicks.push({
        date: doc.id,
        title: d.title,
        year: d.year || "",
        genre: d.genre || "",
        tmdbId: String(d.answerId || ""),
      });
    }
  }

  // Step 3: pool from Firestore. Only consider movies that have been enriched
  // (have a cast array). Unenriched movies are silently skipped — they need
  // a re-seed before they can be picked.
  const moviesSnap = await db.collection(MOVIES_COLLECTION).get();
  const pool = [];
  let unenriched = 0;
  for (const doc of moviesSnap.docs) {
    const d = doc.data();
    const id = String(d.id || doc.id);
    if (exclude.has(id)) continue;
    if (!Array.isArray(d.cast) || d.cast.length === 0) {
      unenriched++;
      continue;
    }
    pool.push({ id, doc: d });
  }
  const sample = pickRandomSubset(pool, sampleSize);
  logErr(
    `[auto-quiz] target=${targetQuizId} pool=${pool.length} sample=${sample.length} exclude=${exclude.size} unenriched=${unenriched}`,
  );

  // Step 4: filter against vote_count + eligibleCast directly on stored data.
  const survivors = [];
  const rejections = [];
  for (const candidate of sample) {
    if (survivors.length >= targetSurvivors) break;
    const d = candidate.doc;
    const voteCount = d.voteCount ?? 0;
    if (voteCount < VOTE_COUNT_MIN) {
      rejections.push({
        tmdbId: candidate.id,
        title: d.name,
        reason: `voteCount=${voteCount} (< ${VOTE_COUNT_MIN})`,
      });
      continue;
    }
    const eligible = eligibleCast(d.cast || []);
    if (eligible.length < CLUE_COUNT) {
      rejections.push({
        tmdbId: candidate.id,
        title: d.name,
        reason: `only ${eligible.length} eligible cast (need ${CLUE_COUNT})`,
      });
      continue;
    }
    const top6 = eligible.slice(0, CLUE_COUNT);
    survivors.push({
      tmdbId: candidate.id,
      title: d.name,
      year: d.year || "",
      genre: d.genre || "",
      voteCount,
      popularity: d.popularity ?? 0,
      runtime: d.runtime ?? null,
      clues: top6.map((c) => ({ name: c.name, character: c.character || "" })),
    });
  }
  logErr(`[auto-quiz] survivors=${survivors.length} rejected=${rejections.length}`);

  return {
    alreadyScheduled: false,
    targetDate: targetQuizId,
    candidates: survivors,
    recentPicks,
    rejections,
    notes: unenriched > 0 ? [`${unenriched} movies in pool are missing cast data and were skipped — re-seed to enrich them.`] : [],
  };
}
