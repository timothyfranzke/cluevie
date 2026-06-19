#!/usr/bin/env node
// Re-read the movies collection and re-upload movies.json.
// Useful for cache-busting (e.g. after enabling CORS) without re-fetching TMDB.
//
//   cd functions
//   node scripts/rebuild-index.mjs

import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COLLECTION = "movies";
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "cluvie-509e6.appspot.com";
const INDEX_OBJECT = "movies.json";

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
  admin.initializeApp({
    credential: loadCredential(),
    storageBucket: STORAGE_BUCKET,
  });
  const db = admin.firestore();

  console.log(`Reading "${COLLECTION}" ...`);
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
  console.log(`Uploaded: https://storage.googleapis.com/${bucket.name}/${INDEX_OBJECT}`);
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  process.exit(1);
});
