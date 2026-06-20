#!/usr/bin/env node
// Skill-driven quiz writer. Takes the TMDB id + date that Claude picked,
// resolves the movie from Firestore (no TMDB calls — the routine env
// blocks them), writes the quiz doc, and writes a quizCreationLog entry
// with the rationale for audit.
//
// Usage (from the skill, not by hand):
//   node scripts/write-auto-quiz.mjs \
//     --tmdbId 278 \
//     --date 2026-07-01 \
//     --rationale "Last three picks were comedies; rotating to a drama." \
//     [--survivors-considered '["278","238",...]']
//
// Output: a single JSON blob to stdout describing the write outcome.

import {
  ensureAdmin,
  resolveMovieFromFirestore,
  utcMidnightFor,
  writeCreationLog,
  writeQuiz,
} from "./lib/quiz-writer.mjs";

function parseArgs(argv) {
  const args = {
    tmdbId: null,
    date: null,
    rationale: "",
    survivorsConsidered: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tmdbId") args.tmdbId = argv[++i];
    else if (a.startsWith("--tmdbId=")) args.tmdbId = a.split("=")[1];
    else if (a === "--date") args.date = argv[++i];
    else if (a.startsWith("--date=")) args.date = a.split("=")[1];
    else if (a === "--rationale") args.rationale = argv[++i];
    else if (a.startsWith("--rationale=")) args.rationale = a.slice("--rationale=".length);
    else if (a === "--survivors-considered") args.survivorsConsidered = argv[++i];
    else if (a.startsWith("--survivors-considered=")) args.survivorsConsidered = a.slice("--survivors-considered=".length);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.tmdbId || !args.date) {
    console.error("Usage: node scripts/write-auto-quiz.mjs --tmdbId <id> --date YYYY-MM-DD --rationale \"...\"");
    process.exit(1);
  }
  const playDate = utcMidnightFor(args.date);
  let survivorsConsidered = null;
  if (args.survivorsConsidered) {
    try {
      survivorsConsidered = JSON.parse(args.survivorsConsidered);
    } catch {
      console.error("Could not parse --survivors-considered as JSON; ignoring.");
    }
  }

  const db = ensureAdmin();
  const resolved = await resolveMovieFromFirestore(db, args.tmdbId);

  const writeResult = await writeQuiz(db, { resolved, playDate });
  await writeCreationLog(db, {
    quizId: writeResult.quizId,
    payload: {
      quizId: writeResult.quizId,
      quizNumber: writeResult.quizNumber,
      tmdbId: resolved.tmdbId,
      title: resolved.title,
      year: resolved.year,
      genre: resolved.genre,
      rationale: args.rationale || "",
      survivorsConsidered: survivorsConsidered || [],
      voteCount: resolved.voteCount,
      popularity: resolved.popularity,
      source: "auto-quiz-skill",
      movieInPool: true,
      overwrote: writeResult.overwrote,
    },
  });

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        quizId: writeResult.quizId,
        quizNumber: writeResult.quizNumber,
        overwrote: writeResult.overwrote,
        title: resolved.title,
        year: resolved.year,
        genre: resolved.genre,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  process.stdout.write(
    JSON.stringify({ ok: false, error: err.message || String(err) }, null, 2) + "\n",
  );
  process.exit(1);
});
