const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Admin may already be initialized by another *.f.js (index.js requires them
// all). Guard so we never double-init. In the Cloud Functions runtime,
// initializeApp() with no args uses the platform's default credentials, so we
// avoid the deprecated functions.config() service-account path entirely.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.error("seo: admin init failed", e);
  }
}

const SITE = "https://cluevie.com";
const QUIZZES = "quizzes";
const ARCHIVE_PAGE_SIZE = 30;

// --- helpers ---------------------------------------------------------------

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function puzzlePath(quiz) {
  return `/puzzle/${quiz.quizNumber}-${slugify(quiz.title)}`;
}

// Quiz `date` is a Firestore Timestamp; tolerate Date or {seconds} too.
function quizDate(quiz) {
  const d = quiz && quiz.date;
  if (!d) return null;
  if (typeof d.toDate === "function") return d.toDate();
  if (typeof d.seconds === "number") return new Date(d.seconds * 1000);
  if (d instanceof Date) return d;
  return null;
}

function isoDay(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function layout({ title, description, canonical, ogImage, body }) {
  const img = ogImage || `${SITE}/og-image.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Cluevie" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${esc(img)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(img)}" />
<link rel="icon" type="image/png" href="/cluevie-icon.png" />
<style>
body{max-width:560px;margin:0 auto;padding:32px 24px;font-family:system-ui,-apple-system,'Hanken Grotesk',sans-serif;color:#2B2A28;background:#F3EAD9;line-height:1.5;}
a{color:#7A1F2B;} h1{font-size:30px;margin:0 0 4px;} h2{font-size:18px;margin:24px 0 8px;}
.cta{display:inline-block;margin:24px 0;padding:12px 20px;background:#7A1F2B;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;}
ul{padding-left:18px;} .meta{color:#6B665F;font-size:14px;} .nav{margin-top:28px;font-size:14px;}
img.poster{max-width:160px;border-radius:8px;float:right;margin:0 0 12px 16px;}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function absImage(image) {
  if (!image) return null;
  return /^https?:\/\//.test(image) ? image : null;
}

// --- page renderers --------------------------------------------------------

function renderPuzzle(quiz) {
  const date = quizDate(quiz);
  const poster = absImage(quiz.image);
  const cast = Array.isArray(quiz.clues) ? quiz.clues : [];
  const castLines = cast
    .map((c) => {
      const character = c.character ? ` as ${esc(c.character)}` : "";
      return `<li>${esc(c.name)}${character}</li>`;
    })
    .join("");
  const castNames = cast.map((c) => c.name).filter(Boolean).join(", ");
  const title = `Cluevie #${quiz.quizNumber} — ${quiz.title} (${quiz.year})`;
  const description =
    `Cluevie puzzle #${quiz.quizNumber}: the answer was ${quiz.title} (${quiz.year}). ` +
    `Cast clues — ${castNames}. Play today's daily movie quiz.`;
  const body = `
${poster ? `<img class="poster" src="${esc(poster)}" alt="${esc(quiz.title)} poster" />` : ""}
<p class="meta">Daily Movie Quiz · ${esc(isoDay(date))}</p>
<h1>Cluevie #${esc(quiz.quizNumber)}: ${esc(quiz.title)} (${esc(quiz.year)})</h1>
${quiz.genre ? `<p class="meta">${esc(quiz.genre)}</p>` : ""}
<p>This was Cluevie puzzle #${esc(quiz.quizNumber)}. Players had to name the movie
from six actor clues, revealed in reverse billing order. The answer was
<strong>${esc(quiz.title)}</strong>.</p>
<h2>The cast clues</h2>
<ul>${castLines}</ul>
<a class="cta" href="/">Play today's Cluevie</a>
<div class="nav"><a href="/archive">← All past puzzles</a></div>`;
  return layout({
    title,
    description,
    canonical: `${SITE}${puzzlePath(quiz)}`,
    ogImage: poster,
    body,
  });
}

function renderArchive(quizzes, page, hasNext) {
  const items = quizzes
    .map(
      (q) =>
        `<li><a href="${esc(puzzlePath(q))}">#${esc(q.quizNumber)} — ${esc(
          q.title
        )} (${esc(q.year)})</a> <span class="meta">${esc(
          isoDay(quizDate(q))
        )}</span></li>`
    )
    .join("");
  const prev = page > 1 ? `<a href="/archive?page=${page - 1}">← Newer</a>` : "";
  const next = hasNext ? `<a href="/archive?page=${page + 1}">Older →</a>` : "";
  const body = `
<h1>Cluevie Archive</h1>
<p>Every past Cluevie puzzle. Each day, name a movie from six actor clues
revealed hardest-first. <a href="/">Play today's puzzle</a>.</p>
<ul>${items}</ul>
<div class="nav">${prev} ${next}</div>`;
  return layout({
    title: "Cluevie Archive — Every Past Daily Movie Quiz",
    description:
      "Browse every past Cluevie daily movie quiz. Name the film from six actor clues.",
    canonical: `${SITE}/archive${page > 1 ? `?page=${page}` : ""}`,
    body,
  });
}

function renderSitemap(quizzes) {
  const urls = [
    `<url><loc>${SITE}/</loc></url>`,
    `<url><loc>${SITE}/archive</loc></url>`,
    `<url><loc>${SITE}/how-to-play</loc></url>`,
  ];
  for (const q of quizzes) {
    const day = isoDay(quizDate(q));
    urls.push(
      `<url><loc>${SITE}${puzzlePath(q)}</loc>${
        day ? `<lastmod>${day}</lastmod>` : ""
      }</url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// --- HTTP entry ------------------------------------------------------------

exports = module.exports = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  // Strip any query string and trailing slash for matching.
  const path = (req.path || "/").replace(/\/+$/, "") || "/";

  try {
    // --- sitemap ---
    if (path === "/sitemap.xml") {
      const snap = await db
        .collection(QUIZZES)
        .where("date", "<=", now)
        .orderBy("date", "desc")
        .get();
      const quizzes = snap.docs.map((d) => d.data());
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.set("Content-Type", "application/xml");
      return res.status(200).send(renderSitemap(quizzes));
    }

    // --- single puzzle ---
    const puzzleMatch = path.match(/^\/puzzle\/(\d+)(?:-.*)?$/);
    if (puzzleMatch) {
      const number = parseInt(puzzleMatch[1], 10);
      const snap = await db
        .collection(QUIZZES)
        .where("quizNumber", "==", number)
        .limit(1)
        .get();
      const quiz = snap.empty ? null : snap.docs[0].data();
      const date = quiz && quizDate(quiz);
      // 404 unknown or not-yet-aired puzzles so answers never leak early.
      if (!quiz || !date || date.getTime() > Date.now()) {
        res.set("Cache-Control", "public, max-age=300");
        return res.status(404).send(notFound());
      }
      res.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(renderPuzzle(quiz));
    }

    // --- archive index ---
    if (path === "/archive") {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const snap = await db
        .collection(QUIZZES)
        .where("date", "<=", now)
        .orderBy("date", "desc")
        .limit(ARCHIVE_PAGE_SIZE * page + 1)
        .get();
      const all = snap.docs.map((d) => d.data());
      const start = (page - 1) * ARCHIVE_PAGE_SIZE;
      const pageItems = all.slice(start, start + ARCHIVE_PAGE_SIZE);
      const hasNext = all.length > start + ARCHIVE_PAGE_SIZE;
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(renderArchive(pageItems, page, hasNext));
    }

    res.set("Cache-Control", "public, max-age=300");
    return res.status(404).send(notFound());
  } catch (e) {
    console.error("seo: render error", path, e);
    return res.status(500).send("Server error");
  }
});

function notFound() {
  return layout({
    title: "Not found — Cluevie",
    description: "That page doesn't exist.",
    canonical: `${SITE}/`,
    body: `<h1>Not found</h1><p>That puzzle isn't available.
<a href="/archive">Browse the archive</a> or <a href="/">play today's puzzle</a>.</p>`,
  });
}
