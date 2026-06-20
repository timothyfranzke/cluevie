// Shared helpers for both create-quiz.mjs (hand-pick) and write-auto-quiz.mjs
// (skill-driven). Owns: TMDB resolution, clue building, Firestore writes,
// auto-numbering, credential loading.

import axios from "axios";
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const QUIZZES_COLLECTION = "quizzes";
export const MOVIES_COLLECTION = "movies";
export const LOG_COLLECTION = "quizCreationLog";
export const TMDB_BASE = "https://api.themoviedb.org/3";
const PROFILE_BASE = "https://image.tmdb.org/t/p/w185";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
export const CLUE_COUNT = 6;

const BAD_CHARACTER_NAMES = new Set([
  "self",
  "themselves",
  "themself",
  "herself",
  "himself",
  "uncredited",
  "voice",
  "narrator",
  "host",
  "guest",
]);

export function utcMidnightFor(yyyyMmDd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) throw new Error(`Bad date: ${yyyyMmDd} (expected YYYY-MM-DD)`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function todayUtcMidnight() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function tomorrowUtcMidnight() {
  const t = todayUtcMidnight();
  return new Date(t.getTime() + 86400 * 1000);
}

export function quizIdFromDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function tmdbGet(path, apiKey) {
  const res = await axios.get(`${TMDB_BASE}${path}`, {
    params: { api_key: apiKey, language: "en-US" },
    timeout: 15000,
  });
  return res.data;
}

function isPlausibleCharacterName(c) {
  if (!c || typeof c !== "string") return false;
  const trimmed = c.trim();
  if (!trimmed) return false;
  if (BAD_CHARACTER_NAMES.has(trimmed.toLowerCase())) return false;
  // "Self - <something>", "Self (uncredited)" patterns
  if (/^self\b/i.test(trimmed)) return false;
  return /[a-zA-Z]/.test(trimmed);
}

// Accepts either raw TMDB shape (profile_path, known_for_department) or the
// stored shape (profilePath, knownForDepartment) and returns a normalized
// {name, character, profilePath, order, knownForDepartment} record.
function normalizeCastEntry(c) {
  if (!c) return null;
  const profilePath = c.profilePath ?? c.profile_path ?? null;
  const knownForDepartment = c.knownForDepartment ?? c.known_for_department ?? null;
  return {
    name: c.name || "",
    character: c.character || "",
    profilePath,
    order: c.order ?? null,
    knownForDepartment,
  };
}

// Filters a cast list down to entries that pass the "medium strictness" gate:
// real photo, classified as Acting (or unset), plausible character name.
export function eligibleCast(cast) {
  return (cast || [])
    .map(normalizeCastEntry)
    .filter(
      (c) =>
        c &&
        c.profilePath &&
        c.name &&
        (c.knownForDepartment === "Acting" || c.knownForDepartment == null) &&
        isPlausibleCharacterName(c.character),
    )
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
}

export function buildClues(cast) {
  const eligible = eligibleCast(cast);
  if (eligible.length < CLUE_COUNT) {
    throw new Error(
      `INSUFFICIENT_CAST: only ${eligible.length} eligible cast members; need ${CLUE_COUNT}.`,
    );
  }
  return eligible.slice(0, CLUE_COUNT).map((c, idx) => ({
    index: idx,
    name: c.name,
    avatar: `${PROFILE_BASE}${c.profilePath}`,
    character: c.character || "",
  }));
}

export function posterUrl(details) {
  return details?.poster_path ? `${POSTER_BASE}${details.poster_path}` : "";
}

export async function resolveMovie(tmdbId, apiKey) {
  const [details, credits] = await Promise.all([
    tmdbGet(`/movie/${tmdbId}`, apiKey),
    tmdbGet(`/movie/${tmdbId}/credits`, apiKey),
  ]);
  return {
    tmdbId: String(tmdbId),
    title: details.title,
    year: (details.release_date || "").slice(0, 4) || "",
    genre: (details.genres || []).map((g) => g.name).join(", "),
    image: posterUrl(details),
    voteCount: details.vote_count ?? 0,
    popularity: details.popularity ?? 0,
    cast: credits.cast || [],
    clues: buildClues(credits.cast || []),
  };
}

// Same shape as resolveMovie but reads from a pre-enriched movies/{tmdbId}
// Firestore doc. The auto-quiz routine uses this so it never has to hit TMDB.
export async function resolveMovieFromFirestore(db, tmdbId) {
  const snap = await db.collection(MOVIES_COLLECTION).doc(String(tmdbId)).get();
  if (!snap.exists) {
    throw new Error(`movies/${tmdbId} not found in Firestore. Re-seed via import-tmdb-list.mjs.`);
  }
  const d = snap.data();
  if (!Array.isArray(d.cast) || d.cast.length === 0) {
    throw new Error(
      `movies/${tmdbId} ("${d.name}") has no cast data. Re-seed via import-tmdb-list.mjs to enrich.`,
    );
  }
  return {
    tmdbId: String(d.id || tmdbId),
    title: d.name,
    year: d.year || "",
    genre: d.genre || "",
    image: d.image || "",
    voteCount: d.voteCount ?? 0,
    popularity: d.popularity ?? 0,
    runtime: d.runtime ?? null,
    cast: d.cast,
    clues: buildClues(d.cast),
  };
}

export function loadCredential() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv) {
    return admin.credential.cert(JSON.parse(readFileSync(fromEnv, "utf8")));
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const fallback = resolve(
    here,
    "..",
    "..",
    "cluvie-509e6-firebase-adminsdk-kci32-97b34be57b.json",
  );
  try {
    return admin.credential.cert(JSON.parse(readFileSync(fallback, "utf8")));
  } catch {
    return admin.credential.applicationDefault();
  }
}

let _tmdbApiKeyCache = null;
// Resolves the TMDB API key from the env var (preferred) or from
// `config/secrets.tmdbApiKey` in Firestore (fallback, used by the remote
// routine which has no env vars).
export async function getTmdbApiKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  if (_tmdbApiKeyCache) return _tmdbApiKeyCache;
  const db = ensureAdmin();
  const snap = await db.collection("config").doc("secrets").get();
  if (!snap.exists) {
    throw new Error(
      "No TMDB_API_KEY env var, and config/secrets doc doesn't exist. " +
        "Create it in Firestore with a 'tmdbApiKey' field, or export the env var.",
    );
  }
  const key = snap.data()?.tmdbApiKey;
  if (!key || typeof key !== "string") {
    throw new Error("config/secrets exists but has no string `tmdbApiKey` field.");
  }
  _tmdbApiKeyCache = key;
  return key;
}

let _appInitialized = false;
export function ensureAdmin() {
  if (_appInitialized) return admin.firestore();
  admin.initializeApp({
    credential: loadCredential(),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET || "cluvie-509e6.appspot.com",
  });
  _appInitialized = true;
  return admin.firestore();
}

export async function nextQuizNumber(db) {
  const snap = await db
    .collection(QUIZZES_COLLECTION)
    .orderBy("quizNumber", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 1;
  const top = snap.docs[0].data().quizNumber;
  return typeof top === "number" ? top + 1 : 1;
}

// Writes the quiz doc. Returns { quizId, quizNumber, overwrote }.
export async function writeQuiz(db, { resolved, playDate, number }) {
  const quizId = quizIdFromDate(playDate);
  const quizNumber = number ?? (await nextQuizNumber(db));
  const existing = await db.collection(QUIZZES_COLLECTION).doc(quizId).get();
  const overwrote = existing.exists;

  const doc = {
    cluevieQuizId: quizId,
    quizNumber,
    movieId: resolved.tmdbId,
    answerId: resolved.tmdbId,
    title: resolved.title,
    image: resolved.image,
    year: resolved.year,
    genre: resolved.genre,
    clues: resolved.clues,
    date: admin.firestore.Timestamp.fromDate(playDate),
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(QUIZZES_COLLECTION).doc(quizId).set(doc);
  return { quizId, quizNumber, overwrote };
}

export async function writeCreationLog(db, { quizId, payload }) {
  await db
    .collection(LOG_COLLECTION)
    .doc(quizId)
    .set(
      {
        ...payload,
        loggedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function isAnswerInMoviesCollection(db, tmdbId) {
  const snap = await db.collection(MOVIES_COLLECTION).doc(String(tmdbId)).get();
  return snap.exists;
}

export { admin };
