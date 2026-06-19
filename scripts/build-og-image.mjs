#!/usr/bin/env node
// Build the Open Graph preview image at public/og-image.png (1200×630).
// Writes the source SVG alongside it as public/og-image.svg.
//
//   node scripts/build-og-image.mjs

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fontDir = resolve(here, "og");
const publicDir = resolve(root, "public");

const W = 1200;
const H = 630;

const palette = {
  paper: "#F3EAD9",
  surface: "#FCF7EC",
  ink: "#2B1517",
  muted: "#9C8978",
  line: "#E6D9C4",
  accent: "#7C1F2C",
  accentInk: "#FBF3E8",
  clue: "#C8902F",
  correct: "#4F9A63",
  incorrect: "#CF4339",
  slotEmpty: "#ECE1CD",
};

function ticketIcon(cx, cy, color) {
  return `
    <g transform="translate(${cx} ${cy})">
      <rect x="-30" y="-19" width="60" height="38" rx="8" fill="${palette.ink}" opacity="0.82"/>
      <circle cx="-30" cy="0" r="6" fill="${color}"/>
      <circle cx="30" cy="0" r="6" fill="${color}"/>
      <line x1="3" y1="-12" x2="3" y2="12" stroke="${color}" stroke-width="2" stroke-dasharray="3 3"/>
    </g>`;
}

function checkIcon(cx, cy) {
  return `
    <path d="M ${cx - 18} ${cy + 2} l 12 12 l 24 -28"
      stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

function slot(x, y, size, kind) {
  const r = 16;
  switch (kind) {
    case "clue":
      return `
        <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${palette.clue}"/>
        ${ticketIcon(x + size / 2, y + size / 2, palette.clue)}`;
    case "correct":
      return `
        <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${palette.correct}"/>
        ${checkIcon(x + size / 2, y + size / 2)}`;
    case "empty":
    default:
      return `
        <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}"
          fill="${palette.slotEmpty}" stroke="${palette.line}" stroke-width="2"/>`;
  }
}

function buildSvg() {
  const slotSize = 96;
  const slotGap = 18;
  const totalWidth = slotSize * 6 + slotGap * 5;
  const gridX = (W - totalWidth) / 2;
  const gridY = 410;

  // 3 clues, 1 correct, 2 empty (the "got it in three" rhythm)
  const sequence = ["clue", "clue", "clue", "correct", "empty", "empty"];

  const slots = sequence
    .map((kind, i) => slot(gridX + i * (slotSize + slotGap), gridY, slotSize, kind))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.paper}"/>
      <stop offset="100%" stop-color="#EDE2CC"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#FFF6E1" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#FFF6E1" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#spot)"/>

  <!-- inner marquee frame -->
  <rect x="32" y="32" width="${W - 64}" height="${H - 64}" rx="22" ry="22"
    fill="none" stroke="${palette.accent}" stroke-width="2" stroke-opacity="0.18"/>
  <rect x="42" y="42" width="${W - 84}" height="${H - 84}" rx="14" ry="14"
    fill="none" stroke="${palette.accent}" stroke-width="1" stroke-opacity="0.12"/>

  <!-- eyebrow -->
  <text x="${W / 2}" y="138" text-anchor="middle"
    font-family="Hanken Grotesk" font-weight="700" font-size="22"
    letter-spacing="8" fill="${palette.muted}">DAILY MOVIE QUIZ · NO. 412</text>

  <!-- wordmark -->
  <text x="${W / 2}" y="320" text-anchor="middle"
    font-family="Shrikhand" font-size="220" fill="${palette.accent}">Cluevie</text>

  <!-- score grid -->
  ${slots}

  <!-- tagline -->
  <text x="${W / 2}" y="565" text-anchor="middle"
    font-family="Hanken Grotesk" font-weight="700" font-size="30" fill="${palette.ink}">
    Six actors. Reverse billing. Name the movie.
  </text>
</svg>`;
}

function main() {
  const svg = buildSvg();
  const svgPath = resolve(publicDir, "og-image.svg");
  writeFileSync(svgPath, svg);
  console.log(`wrote ${svgPath} (${svg.length.toLocaleString()} bytes)`);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    background: palette.paper,
    font: {
      loadSystemFonts: false,
      fontFiles: [
        resolve(fontDir, "Shrikhand-Regular.ttf"),
        resolve(fontDir, "HankenGrotesk-Bold.ttf"),
      ],
      defaultFontFamily: "HankenGrotesk",
    },
  });
  const png = resvg.render().asPng();
  const pngPath = resolve(publicDir, "og-image.png");
  writeFileSync(pngPath, png);
  console.log(`wrote ${pngPath} (${(png.length / 1024).toFixed(1)} KB)`);
}

main();
