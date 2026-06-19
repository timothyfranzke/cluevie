#!/usr/bin/env node
// One-shot: enable cross-origin GETs on the project's default Storage
// bucket so the frontend can fetch movies.json from any origin.
//
// Usage:
//   cd functions
//   node scripts/set-storage-cors.mjs                 # set CORS
//   node scripts/set-storage-cors.mjs --show          # print current config

import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "cluvie-509e6.appspot.com";

const CORS = [
  {
    origin: ["*"],
    method: ["GET", "HEAD"],
    responseHeader: ["Content-Type", "Cache-Control", "ETag"],
    maxAgeSeconds: 3600,
  },
];

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
  const showOnly = process.argv.includes("--show");

  admin.initializeApp({
    credential: loadCredential(),
    storageBucket: STORAGE_BUCKET,
  });
  const bucket = admin.storage().bucket();

  if (showOnly) {
    const [metadata] = await bucket.getMetadata();
    console.log(`Bucket: ${bucket.name}`);
    console.log("CORS:");
    console.log(JSON.stringify(metadata.cors ?? [], null, 2));
    return;
  }

  console.log(`Setting CORS on gs://${bucket.name} ...`);
  await bucket.setCorsConfiguration(CORS);
  console.log("Applied:");
  console.log(JSON.stringify(CORS, null, 2));
  console.log("\nTry your fetch again — may take a few seconds to propagate.");
}

main().catch((err) => {
  console.error("\nFatal:", err.message || err);
  process.exit(1);
});
