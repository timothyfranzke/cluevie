#!/usr/bin/env node
// Create a quiz doc in Firestore from a TMDB movie id.
//
// Usage:
//   cd functions
//   TMDB_API_KEY=xxx node scripts/create-quiz.mjs <tmdbId> [--date YYYY-MM-DD] [--number N] [--dry-run]
//
//   TMDB_API_KEY=xxx node scripts/create-quiz.mjs 278                       # today, auto-numbered
//   TMDB_API_KEY=xxx node scripts/create-quiz.mjs 278 --date 2026-07-01     # specific day
//   TMDB_API_KEY=xxx node scripts/create-quiz.mjs 278 --dry-run             # preview only
//
// The script pulls /movie/{id} and /movie/{id}/credits from TMDB, picks
// the bottom-billed 6 cast members with profile photos, and writes a
// quiz doc keyed by date (YYYY-MM-DD).

import axios from "axios";
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COLLECTION = "quizzes";
const MOVIES_COLLECTION = "movies";
const TMDB_BASE = "https://api.themoviedb.org/3";
const PROFILE_BASE = "https://image.tmdb.org/t/p/w185";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const CLUE_COUNT = 6;

function parseArgs(argv) {
  const args = { tmdbId: null, date: null, number: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--date") args.date = argv[++i];
    else if (a.startsWith("--date=")) args.date = a.split("=")[1];
    else if (a === "--number") args.number = parseInt(argv[++i], 10);
    else if (a.startsWith("--number=")) args.number = parseInt(a.split("=")[1], 10);
    else if (!args.tmdbId && /^\d+$/.test(a)) args.tmdbId = a;
  }
  return args;
}

function utcMidnightFor(yyyyMmDd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) throw new Error(`Bad --date: ${yyyyMmDd} (expected YYYY-MM-DD)`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function todayUtcMidnight() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function quizIdFromDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function tmdbGet(path, apiKey) {
  const res = await axios.get(`${TMDB_BASE}${path}`, {
    params: { api_key: apiKey, language: "en-US" },
    timeout: 15000,
  });
  return res.data;
}

function buildClues(cast) {
  const eligible = cast
    .filter((c) => c && c.profile_path && c.name)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  if (eligible.length < CLUE_COUNT) {
    throw new Error(
      `Only ${eligible.length} cast members have profile photos; need ${CLUE_COUNT}.`,
    );
  }
  return eligible.slice(0, CLUE_COUNT).map((c, idx) => ({
    index: idx,
    name: c.name,
    avatar: `${PROFILE_BASE}${c.profile_path}`,
    character: c.character || "",
  }));
}

function loadCredential() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv) {
    return admin.credential.cert(JSON.parse(readFileSync(fromEnv, "utf8")));
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const fallback = resolve(here, "..", "cluvie-509e6-firebase-adminsdk-kci32-97b34be57b.json");
  try {
    return admin.credential.cert(JSON.parse(readFileSync(fallback, "utf8")));
  } catch {
    return admin.credential.applicationDefault();
  }
}

async function nextQuizNumber(db) {
  const snap = await db
    .collection(COLLECTION)
    .orderBy("quizNumber", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 1;
  const top = snap.docs[0].data().quizNumber;
  return typeof top === "number" ? top + 1 : 1;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.tmdbId) {
    console.error("Usage: node scripts/create-quiz.mjs <tmdbId> [--date YYYY-MM-DD] [--number N] [--dry-run]");
    console.error("");
    console.error("  tmdbId         TMDB movie id (e.g. 278 for The Shawshank Redemption)");
    console.error("  --date         Day the quiz goes live, UTC. Default: today");
    console.error("  --number N     Display number (No. N). Default: max existing + 1");
    console.error("");
    console.error("Requires TMDB_API_KEY env var.");
    process.exit(1);
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("Missing TMDB_API_KEY env var.");
    process.exit(1);
  }

  const playDate = args.date ? utcMidnightFor(args.date) : todayUtcMidnight();
  const quizId = quizIdFromDate(playDate);

  console.log(`Fetching TMDB movie ${args.tmdbId} ...`);
  const [details, credits] = await Promise.all([
    tmdbGet(`/movie/${args.tmdbId}`, apiKey),
    tmdbGet(`/movie/${args.tmdbId}/credits`, apiKey),
  ]);

  const title = details.title;
  const year = (details.release_date || "").slice(0, 4) || null;
  const genre = (details.genres || []).map((g) => g.name).join(", ") || null;
  const image = details.poster_path ? `${POSTER_BASE}${details.poster_path}` : null;
  const clues = buildClues(credits.cast || []);

  console.log(`\n  ${title}${year ? ` (${year})` : ""}`);
  if (genre) console.log(`  ${genre}`);
  console.log(`  Clues (most obscure → headliner):`);
  clues.forEach((c, i) =>
    console.log(`    ${i + 1}. ${c.name}${c.character ? `  — ${c.character}` : ""}`),
  );

  if (args.dryRun) {
    console.log(`\n  Quiz id would be: ${quizId}`);
    console.log("Dry run — no Firestore writes.");
    return;
  }

  admin.initializeApp({ credential: loadCredential() });
  const db = admin.firestore();

  const moviesRef = db.collection(MOVIES_COLLECTION).doc(String(args.tmdbId));
  const movieSnap = await moviesRef.get();
  if (!movieSnap.exists) {
    console.warn(
      `\n  ⚠  movies/${args.tmdbId} doesn't exist. Players won't be able to type "${title}" in the autocomplete until you reseed.`,
    );
  }

  const quizNumber = args.number ?? (await nextQuizNumber(db));
  const existing = await db.collection(COLLECTION).doc(quizId).get();
  if (existing.exists) {
    console.warn(`  ⚠  quizzes/${quizId} already exists — overwriting.`);
  }

  const doc = {
    cluevieQuizId: quizId,
    quizNumber,
    movieId: String(args.tmdbId),
    answerId: String(args.tmdbId),
    title,
    image: image || "",
    year: year || "",
    genre: genre || "",
    clues,
    date: admin.firestore.Timestamp.fromDate(playDate),
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTION).doc(quizId).set(doc);
  console.log(`\n  Wrote quizzes/${quizId} (No. ${quizNumber}, plays ${playDate.toISOString().slice(0, 10)} UTC).`);
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  if (err.response?.status) {
    console.error(`  HTTP ${err.response.status}`, err.response.data?.status_message || "");
  }
  process.exit(1);
});
