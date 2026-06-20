#!/usr/bin/env node
// One-shot utility: pull a TMDB movie list and upsert each title
// into the Firestore `movies` collection used by the autocomplete.
//
// Usage:
//   cd functions
//   TMDB_API_KEY=xxx node scripts/import-tmdb-list.mjs top_rated
//   TMDB_API_KEY=xxx node scripts/import-tmdb-list.mjs popular --pages 10
//   TMDB_API_KEY=xxx node scripts/import-tmdb-list.mjs list:8228303 --dry-run
//
// Categories: top_rated, popular, now_playing, upcoming
// Or use `list:<id>` to import one of TMDB's user-curated lists.
//
// Docs are keyed by the TMDB id (e.g. "278"). When you create a quiz,
// set `answerId` to the same TMDB id so the guess check matches.

import axios from "axios";
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COLLECTION = "movies";
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "cluvie-509e6.appspot.com";
const INDEX_OBJECT = "movies.json";

function parseArgs(argv) {
  const args = { source: null, pages: Infinity, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--pages") args.pages = parseInt(argv[++i], 10);
    else if (a.startsWith("--pages=")) args.pages = parseInt(a.split("=")[1], 10);
    else if (!args.source) args.source = a;
  }
  return args;
}

// TMDB genre ids (movies). https://api.themoviedb.org/3/genre/movie/list
const GENRES = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  "science-fiction": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

function resolveEndpoint(source) {
  const valid = new Set(["top_rated", "popular", "now_playing", "upcoming"]);
  if (valid.has(source)) return { path: `/movie/${source}`, paginated: true };
  if (source.startsWith("list:")) {
    const id = source.slice(5);
    if (!/^\d+$/.test(id)) throw new Error(`Bad list id: ${id}`);
    return { path: `/list/${id}`, paginated: false };
  }
  if (source.startsWith("category:")) {
    const name = source.slice(9).toLowerCase();
    const id = GENRES[name];
    if (!id) {
      throw new Error(
        `Unknown category "${name}". Available: ${Object.keys(GENRES).sort().join(", ")}.`,
      );
    }
    return {
      path: "/discover/movie",
      paginated: true,
      extraParams: {
        with_genres: String(id),
        sort_by: "vote_average.desc",
        "vote_count.gte": 200,
      },
    };
  }
  throw new Error(
    `Unknown source "${source}". Use top_rated, popular, now_playing, upcoming, list:<id>, or category:<name>.`,
  );
}

function normalize(raw) {
  if (!raw || !raw.id || !raw.title) return null;
  const name = String(raw.title).trim();
  if (!name) return null;
  return {
    id: String(raw.id),
    name,
    term: name.toLowerCase(),
    image: raw.poster_path ? `${POSTER_BASE}${raw.poster_path}` : null,
    year: raw.release_date ? raw.release_date.slice(0, 4) : null,
  };
}

const CAST_SLICE = 20;

async function fetchDetailsAndCredits(apiKey, tmdbId) {
  const [details, credits] = await Promise.all([
    axios.get(`${TMDB_BASE}/movie/${tmdbId}`, {
      params: { api_key: apiKey, language: "en-US" },
      timeout: 15000,
    }),
    axios.get(`${TMDB_BASE}/movie/${tmdbId}/credits`, {
      params: { api_key: apiKey, language: "en-US" },
      timeout: 15000,
    }),
  ]);
  return { details: details.data, credits: credits.data };
}

function enrichRecord(base, details, credits) {
  const cast = (credits.cast || [])
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, CAST_SLICE)
    .map((c) => ({
      name: c.name || "",
      character: c.character || "",
      profilePath: c.profile_path || null,
      order: c.order ?? null,
      knownForDepartment: c.known_for_department || null,
    }));
  return {
    ...base,
    voteCount: details.vote_count ?? 0,
    popularity: details.popularity ?? 0,
    runtime: details.runtime ?? null,
    genre: (details.genres || []).map((g) => g.name).join(", "),
    cast,
  };
}

async function fetchPage(apiKey, endpoint, page) {
  const res = await axios.get(`${TMDB_BASE}${endpoint.path}`, {
    params: {
      api_key: apiKey,
      page,
      language: "en-US",
      ...(endpoint.extraParams || {}),
    },
    timeout: 15000,
  });
  return res.data;
}

async function collectMovies(apiKey, endpoint, maxPages) {
  if (!endpoint.paginated) {
    const data = await fetchPage(apiKey, endpoint, 1);
    const items = data.items || data.results || [];
    return items.map(normalize).filter(Boolean);
  }
  const first = await fetchPage(apiKey, endpoint, 1);
  const totalPages = Math.min(first.total_pages || 1, maxPages, 500);
  const out = (first.results || []).map(normalize).filter(Boolean);
  for (let page = 2; page <= totalPages; page++) {
    const data = await fetchPage(apiKey, endpoint, page);
    out.push(...(data.results || []).map(normalize).filter(Boolean));
    if (page % 5 === 0) {
      console.log(`  fetched page ${page}/${totalPages} (${out.length} so far)`);
    }
  }
  return out;
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

async function main() {
  const args = parseArgs(process.argv);
  if (!args.source) {
    console.error(
      "Usage: node scripts/import-tmdb-list.mjs <source> [--pages N] [--dry-run]",
    );
    console.error("");
    console.error("Sources:");
    console.error("  top_rated         - TMDB top-rated movies (closest to IMDB Top 250)");
    console.error("  popular           - currently popular movies (like IMDB moviemeter)");
    console.error("  now_playing       - in theaters now");
    console.error("  upcoming          - releasing soon");
    console.error("  list:<id>         - any TMDB list by its numeric id");
    console.error("  category:<name>   - top-rated in a genre (comedy, action, horror,");
    console.error("                       drama, scifi, etc.) — 5 pages = ~100 movies");
    console.error("");
    console.error("Requires TMDB_API_KEY env var. Get one free at themoviedb.org/settings/api");
    process.exit(1);
  }

  let endpoint;
  try {
    endpoint = resolveEndpoint(args.source);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("Missing TMDB_API_KEY env var.");
    process.exit(1);
  }

  console.log(`Source: ${args.source} → ${endpoint.path}`);
  const movies = await collectMovies(apiKey, endpoint, args.pages);
  console.log(`Collected ${movies.length} movies.`);
  if (!movies.length) {
    console.error("Nothing returned. Check the source name or your API key.");
    process.exit(2);
  }
  movies.slice(0, 5).forEach((m) =>
    console.log(`  · ${m.id}  ${m.year ?? "----"}  ${m.name}${m.image ? "  [poster]" : ""}`),
  );
  if (movies.length > 5) console.log(`  · … ${movies.length - 5} more`);

  if (args.dryRun) {
    console.log("\nDry run — no Firestore writes.");
    return;
  }

  admin.initializeApp({
    credential: loadCredential(),
    storageBucket: STORAGE_BUCKET,
  });
  const db = admin.firestore();

  console.log(`\nEnriching with /movie + /credits (this is the slow step) ...`);
  const enriched = [];
  const failed = [];
  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const { details, credits } = await fetchDetailsAndCredits(apiKey, m.id);
      enriched.push(enrichRecord(m, details, credits));
    } catch (err) {
      failed.push({ id: m.id, name: m.name, reason: err.response?.status || err.message });
    }
    if ((i + 1) % 20 === 0 || i + 1 === movies.length) {
      console.log(`  enriched ${i + 1}/${movies.length} (${failed.length} failed)`);
    }
  }
  if (failed.length) {
    console.warn(`  ⚠ ${failed.length} movies couldn't be enriched and will be skipped:`);
    failed.slice(0, 5).forEach((f) => console.warn(`    · ${f.id} ${f.name} — ${f.reason}`));
  }

  console.log(`\nUpserting ${enriched.length} into "${COLLECTION}" ...`);
  const batchSize = 200;
  let written = 0;
  for (let i = 0; i < enriched.length; i += batchSize) {
    const batch = db.batch();
    for (const m of enriched.slice(i, i + batchSize)) {
      const data = { ...m, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      for (const k of Object.keys(data)) if (data[k] === null) delete data[k];
      batch.set(db.collection(COLLECTION).doc(m.id), data, { merge: true });
    }
    await batch.commit();
    written += Math.min(batchSize, enriched.length - i);
    console.log(`  upserted ${written}/${enriched.length}`);
  }

  await rebuildSearchIndex(db);
  console.log("Done.");
}

async function rebuildSearchIndex(db) {
  console.log(`\nRebuilding search index from "${COLLECTION}" ...`);
  const snap = await db.collection(COLLECTION).get();
  const records = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const r = {
      id: d.id || doc.id,
      name: d.name,
      term: d.term || (d.name ? String(d.name).toLowerCase() : null),
    };
    if (d.image) r.image = d.image;
    if (d.year) r.year = d.year;
    if (r.id && r.name && r.term) records.push(r);
  });
  records.sort((a, b) => a.term.localeCompare(b.term));
  const json = JSON.stringify(records);
  console.log(`  ${records.length} entries · ${(json.length / 1024).toFixed(1)} KB raw`);

  const bucket = admin.storage().bucket();
  const file = bucket.file(INDEX_OBJECT);
  await file.save(json, {
    metadata: {
      contentType: "application/json",
      cacheControl: "public, max-age=3600, must-revalidate",
    },
    gzip: true,
    resumable: false,
  });
  await file.makePublic();
  console.log(`  uploaded: https://storage.googleapis.com/${bucket.name}/${INDEX_OBJECT}`);
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  if (err.response?.status) {
    console.error(`  HTTP ${err.response.status}`, err.response.data?.status_message || "");
  }
  process.exit(1);
});
