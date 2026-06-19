#!/usr/bin/env node
// CLI wrapper around gatherCandidates(). Prints a single JSON blob to
// stdout (skill parses this); progress + errors go to stderr.
//
// Usage:
//   cd functions
//   TMDB_API_KEY=xxx node scripts/gather-candidates.mjs                       # tomorrow UTC, defaults
//   TMDB_API_KEY=xxx node scripts/gather-candidates.mjs --date 2026-07-01
//   TMDB_API_KEY=xxx node scripts/gather-candidates.mjs --sample 10 --survivors 3

import { gatherCandidates } from "./lib/auto-quiz.mjs";
import { getTmdbApiKey, tomorrowUtcMidnight, utcMidnightFor } from "./lib/quiz-writer.mjs";

function parseArgs(argv) {
  const args = { date: null, sample: null, survivors: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date") args.date = argv[++i];
    else if (a.startsWith("--date=")) args.date = a.split("=")[1];
    else if (a === "--sample") args.sample = parseInt(argv[++i], 10);
    else if (a.startsWith("--sample=")) args.sample = parseInt(a.split("=")[1], 10);
    else if (a === "--survivors") args.survivors = parseInt(argv[++i], 10);
    else if (a.startsWith("--survivors=")) args.survivors = parseInt(a.split("=")[1], 10);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const targetDate = args.date ? utcMidnightFor(args.date) : tomorrowUtcMidnight();
  const apiKey = await getTmdbApiKey();
  const out = await gatherCandidates({
    targetDate,
    sampleSize: args.sample ?? undefined,
    targetSurvivors: args.survivors ?? undefined,
    apiKey,
  });
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  if (err.response?.status) {
    console.error(`  HTTP ${err.response.status}`, err.response.data?.status_message || "");
  }
  process.exit(1);
});
