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
// Hand-pick variant. For the skill-driven version that picks based on
// a Claude reasoning pass, see write-auto-quiz.mjs.

import {
  ensureAdmin,
  getTmdbApiKey,
  isAnswerInMoviesCollection,
  quizIdFromDate,
  resolveMovie,
  todayUtcMidnight,
  utcMidnightFor,
  writeQuiz,
} from "./lib/quiz-writer.mjs";

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

  const playDate = args.date ? utcMidnightFor(args.date) : todayUtcMidnight();
  const quizId = quizIdFromDate(playDate);

  const apiKey = await getTmdbApiKey();

  console.log(`Fetching TMDB movie ${args.tmdbId} ...`);
  const resolved = await resolveMovie(args.tmdbId, apiKey);

  console.log(`\n  ${resolved.title}${resolved.year ? ` (${resolved.year})` : ""}`);
  if (resolved.genre) console.log(`  ${resolved.genre}`);
  console.log(`  Clues (most obscure → headliner):`);
  resolved.clues.forEach((c, i) =>
    console.log(`    ${i + 1}. ${c.name}${c.character ? `  — ${c.character}` : ""}`),
  );

  if (args.dryRun) {
    console.log(`\n  Quiz id would be: ${quizId}`);
    console.log("Dry run — no Firestore writes.");
    return;
  }

  const db = ensureAdmin();

  if (!(await isAnswerInMoviesCollection(db, args.tmdbId))) {
    console.warn(
      `\n  ⚠  movies/${args.tmdbId} doesn't exist. Players won't be able to type "${resolved.title}" in the autocomplete until you reseed.`,
    );
  }

  const result = await writeQuiz(db, {
    resolved,
    playDate,
    number: args.number,
  });
  if (result.overwrote) {
    console.warn(`  ⚠  quizzes/${result.quizId} already existed — overwrote.`);
  }
  console.log(
    `\n  Wrote quizzes/${result.quizId} (No. ${result.quizNumber}, plays ${playDate.toISOString().slice(0, 10)} UTC).`,
  );
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  if (err.response?.status) {
    console.error(`  HTTP ${err.response.status}`, err.response.data?.status_message || "");
  }
  process.exit(1);
});
