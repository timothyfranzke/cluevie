// Deterministic candidate-gathering pipeline for the daily auto-quiz skill.
// Steps 1-4 of the design: schedule check, dedup, pool sample, TMDB verify.
//
// Exports gatherCandidates({ targetDate, sampleSize, targetSurvivors, apiKey })
// returning a JSON-serializable object. No Claude reasoning here; that lives
// in SKILL.md.

import adminPkg from "firebase-admin";
import {
  CLUE_COUNT,
  QUIZZES_COLLECTION,
  MOVIES_COLLECTION,
  ensureAdmin,
  eligibleCast,
  quizIdFromDate,
  resolveMovie,
  tmdbGet,
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
  // Fisher-Yates partial
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
  targetDate, // Date (UTC midnight) for the quiz being created
  sampleSize = DEFAULT_SAMPLE,
  targetSurvivors = DEFAULT_SURVIVORS,
  apiKey,
} = {}) {
  if (!apiKey) throw new Error("apiKey required");
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

  // Step 2: dedup set
  const cutoff = new Date(targetDate.getTime() - DEDUP_DAYS * 86400 * 1000);
  const recentSnap = await db
    .collection(QUIZZES_COLLECTION)
    .where("date", ">=", admin_FieldValue.timestamp(cutoff))
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

  // Step 3: pool sample
  // Read movies collection. Could be large (1000s); pull lightweight projection.
  const moviesSnap = await db.collection(MOVIES_COLLECTION).get();
  const pool = [];
  for (const doc of moviesSnap.docs) {
    const d = doc.data();
    const id = String(d.id || doc.id);
    if (exclude.has(id)) continue;
    pool.push({ id, name: d.name, year: d.year || "" });
  }
  const sample = pickRandomSubset(pool, sampleSize);
  logErr(
    `[auto-quiz] target=${targetQuizId} pool=${pool.length} sample=${sample.length} exclude=${exclude.size}`,
  );

  // Step 4: TMDB verify + filter until we have N survivors
  const survivors = [];
  const rejections = [];
  for (const candidate of sample) {
    if (survivors.length >= targetSurvivors) break;
    try {
      const details = await tmdbGet(`/movie/${candidate.id}`, apiKey);
      if ((details.vote_count ?? 0) < VOTE_COUNT_MIN) {
        rejections.push({
          tmdbId: candidate.id,
          title: details.title || candidate.name,
          reason: `vote_count=${details.vote_count ?? 0} (< ${VOTE_COUNT_MIN})`,
        });
        continue;
      }
      const credits = await tmdbGet(`/movie/${candidate.id}/credits`, apiKey);
      const eligible = eligibleCast(credits.cast || []);
      if (eligible.length < CLUE_COUNT) {
        rejections.push({
          tmdbId: candidate.id,
          title: details.title || candidate.name,
          reason: `only ${eligible.length} eligible cast (need ${CLUE_COUNT})`,
        });
        continue;
      }
      const top6 = eligible.slice(0, CLUE_COUNT);
      survivors.push({
        tmdbId: String(candidate.id),
        title: details.title,
        year: (details.release_date || "").slice(0, 4) || "",
        genre: (details.genres || []).map((g) => g.name).join(", "),
        voteCount: details.vote_count,
        popularity: details.popularity,
        runtime: details.runtime ?? null,
        clues: top6.map((c) => ({ name: c.name, character: c.character || "" })),
      });
    } catch (err) {
      rejections.push({
        tmdbId: candidate.id,
        title: candidate.name,
        reason: `TMDB error: ${err.response?.status || err.message}`,
      });
    }
  }
  logErr(`[auto-quiz] survivors=${survivors.length} rejected=${rejections.length}`);

  return {
    alreadyScheduled: false,
    targetDate: targetQuizId,
    candidates: survivors,
    recentPicks,
    rejections,
    notes: [],
  };
}

const admin_FieldValue = {
  timestamp: (date) => adminPkg.firestore.Timestamp.fromDate(date),
};

export async function resolveForWrite(tmdbId, apiKey) {
  return resolveMovie(tmdbId, apiKey);
}
