// Generates PRINT-PACK.html: every printed prop the puzzles need.
// Self-contained; print on A4 portrait, 100% scale (no fit-to-page!),
// because the crest card must come out at exactly 60mm.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const icons = JSON.parse(
  readFileSync(
    path.join(repoRoot, "node_modules", "@iconify-json", "game-icons", "icons.json"),
    "utf8",
  ),
);

function glyphSvg(index, sizeMm) {
  const name = "abstract-" + String(index).padStart(3, "0");
  const icon = icons.icons[name];
  if (!icon) throw new Error("missing glyph " + name);
  return `<svg viewBox="0 0 512 512" style="width:${sizeMm}mm;height:${sizeMm}mm;fill:#000">${icon.body}</svg>`;
}

// Tile faces: correct faces are SQUARE frames spelling SALT in the seal
// order (Bathroom, Kitchen, Balcony, Corridor). Backs are HEX frames with
// decoy letters. Stage two tiles hex-side-up.
const TILES = [
  { room: "BATHROOM", front: "S", back: "M" },
  { room: "KITCHEN", front: "A", back: "O" },
  { room: "BALCONY", front: "L", back: "L" },
  { room: "CORRIDOR", front: "T", back: "D" },
];

function tileCard(room, letter, square) {
  const frame = square
    ? `<div class="tile-frame tile-frame--square"></div>`
    : `<svg class="tile-frame tile-frame--hex" viewBox="0 0 100 100"><polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill="none" stroke="#000" stroke-width="3"/></svg>`;
  return `
    <div class="tile">
      ${frame}
      <strong>${room}</strong>
      <span class="tile-letter">${letter}</span>
    </div>`;
}

// Crest card: 60mm circle, 12 segments. Numbers are placed so that when the
// on-screen wheel locks, its two windows frame 4 and 9. Segment slots are
// numbered clockwise from the notch (slot 1 = first 30deg after the notch).
// Window geometry puts the windows over slots 11 and 3.
const CREST_SLOTS = [7, 12, 9, 5, 1, 10, 6, 2, 11, 8, 4, 3];
// slot index (1-based): 1..12; slot 11 must be 4 and slot 3 must be 9.
CREST_SLOTS[10] = 4;
CREST_SLOTS[2] = 9;

function crestCard() {
  const segments = CREST_SLOTS.map((value, index) => {
    const angle = -90 + 15 + index * 30; // degrees, notch at top
    const rad = (angle * Math.PI) / 180;
    const x = 50 + 38 * Math.cos(rad);
    const y = 50 + 38 * Math.sin(rad);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9" font-family="Georgia">${value}</text>`;
  }).join("");
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = ((-90 + index * 30) * Math.PI) / 180;
    return `<line x1="${(50 + 28 * Math.cos(angle)).toFixed(1)}" y1="${(50 + 28 * Math.sin(angle)).toFixed(1)}" x2="${(50 + 47 * Math.cos(angle)).toFixed(1)}" y2="${(50 + 47 * Math.sin(angle)).toFixed(1)}" stroke="#000" stroke-width="0.6"/>`;
  }).join("");
  return `
    <svg class="crest" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="47" fill="none" stroke="#000" stroke-width="1.4"/>
      <circle cx="50" cy="50" r="28" fill="none" stroke="#000" stroke-width="0.8"/>
      ${spokes}
      ${segments}
      <polygon points="47,2 53,2 50,9" fill="#000"/>
      <text x="50" y="52" text-anchor="middle" font-size="7" font-family="Georgia">CADASTRAL</text>
    </svg>`;
}

const RING_MIRRORED = "_10726".split("").reverse().join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The House Keeps The Count: print pack</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Courier New", monospace; color: #000; background: #fff; padding: 10mm; }
  h1 { font-size: 14px; letter-spacing: 0.3em; text-align: center; padding-bottom: 6mm; }
  h2 { font-size: 12px; letter-spacing: 0.2em; border-bottom: 1px solid #000; margin: 8mm 0 4mm; padding-bottom: 1mm; }
  .note { font-size: 9px; color: #444; padding: 1mm 0 3mm; }
  .row { display: flex; flex-wrap: wrap; gap: 6mm; }
  .tile { position: relative; width: 62mm; height: 62mm; border: 0.5mm dashed #999;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3mm; }
  .tile strong { font-size: 12px; letter-spacing: 0.25em; }
  .tile-letter { font-size: 34px; font-weight: bold; position: absolute; right: 5mm; bottom: 3mm; }
  .tile-frame--square { position: absolute; inset: 6mm; border: 1.2mm solid #000; }
  .tile-frame--hex { position: absolute; inset: 4mm; width: calc(100% - 8mm); height: calc(100% - 8mm); }
  .crest { width: 60mm; height: 60mm; }
  .census { width: 180mm; border: 0.5mm solid #000; padding: 5mm; font-size: 11px; line-height: 1.8; }
  .census li { margin-left: 6mm; padding-bottom: 2mm; }
  .tag { width: 55mm; min-height: 30mm; border: 0.5mm dashed #999; padding: 4mm;
         display: flex; flex-direction: column; gap: 2mm; align-items: center; font-size: 10px; }
  .tag .mirror { font-size: 26px; font-weight: bold; transform: scaleX(-1); letter-spacing: 0.1em; }
  .letters { display: flex; flex-wrap: wrap; gap: 4mm; }
  .letter-circle { width: 22mm; height: 22mm; border: 0.6mm solid #000; border-radius: 50%;
                   display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; }
  .caster-arm { border: 0.5mm solid #000; display: flex; align-items: flex-end; justify-content: center;
                font-size: 8px; padding: 1mm; }
  .marker { width: 60mm; height: 24mm; border: 0.6mm solid #000; display: flex; align-items: center;
            justify-content: center; font-size: 11px; letter-spacing: 0.2em; }
  .page-break { page-break-before: always; }
  @page { size: A4 portrait; margin: 8mm; }
</style>
</head>
<body>
  <h1>CADASTRAL DIVISION · PRINT PACK</h1>
  <p class="note">Print at 100% scale. Do NOT use fit-to-page: the crest card must measure exactly 60mm across.</p>

  <h2>1 · Cadastral tiles: FRONTS (square frames, one per room)</h2>
  <p class="note">Cut out. Glue each front to its back (same room) so every tile is double-sided. Stage per the placement map.</p>
  <div class="row">${TILES.map((tile) => tileCard(tile.room, tile.front, true)).join("")}</div>

  <div class="page-break"></div>
  <h2>2 · Cadastral tiles: BACKS (hex frames, decoys)</h2>
  <div class="row">${TILES.map((tile) => tileCard(tile.room, tile.back, false)).join("")}</div>

  <div class="page-break"></div>
  <h2>3 · The census card (with the reliquary, balcony sleeve)</h2>
  <div class="census">
    <p><strong>CADASTRAL CENSUS · FILE 33 · FIVE WOUNDS</strong></p>
    <ol>
      <li>FIRST WOUND: the balcony rail. Count its slats.</li>
      <li>SECOND WOUND: the kitchen fan's blades, multiplied by the drawers directly beneath it.</li>
      <li>THIRD WOUND: the shower's shortest wall. Count the tiles in one row.</li>
      <li>FOURTH WOUND: the shelf of sixteen mouths, plus the number on your own front door.</li>
      <li>FIFTH WOUND: the year on the coin card inside the cistern lid. Sum its digits.</li>
    </ol>
    <p>The terminal accepts each wound on its own. The house has never once been miscounted.</p>
  </div>
  <p class="note">SETUP: verify each answer in the flat matches the terminal (currently 7, 12, 14, 21, 19). Adjust the flat or the questions, or ask the developer to retune the terminal.</p>

  <h2>4 · The coin card (tape inside the cistern lid, zip-lock bag)</h2>
  <div class="marker">COMMEMORATIVE · 1990 · SUM THE DIGITS</div>

  <div class="page-break"></div>
  <h2>5 · The crest card (60mm; lives with the census card)</h2>
  ${crestCard()}
  <p class="note">She holds this flat against the phone screen, notch up, and turns the on-screen wheel underneath until the notches marry.</p>

  <h2>6 · The three coat tags (pin to her coat: arm, pocket, hem)</h2>
  <div class="row">
    <div class="tag"><span>ARM</span>${glyphSvg(7, 18)}<span>as the surveyor set his stone</span></div>
    <div class="tag"><span>POCKET</span><span class="mirror">${RING_MIRRORED}</span><span>one figure was not recorded</span></div>
    <div class="tag"><span>HEM</span><span style="font-size:20px;font-weight:bold">[ E33 ]</span><span>the missing frame</span></div>
  </div>

  <div class="page-break"></div>
  <h2>7 · The shadow cast: letters, arms, marks</h2>
  <p class="note">SETUP (do this yourself, once, tonight): cut the three arms, fold each base tab, stand them on the floor mark in a fan. Rest the phone on the cradle mark with the torch on. Tape the letter circles on the corridor wall so the three arm shadows touch R, A, T (shortest arm on R). Scatter the other five letters around them convincingly.</p>
  <div class="letters">
    ${["R", "A", "T", "E", "N", "O", "S", "H"].map((letter) => `<div class="letter-circle">${letter}</div>`).join("")}
  </div>
  <div class="row" style="padding-top:6mm">
    <div class="caster-arm" style="width:20mm;height:60mm">ARM 1 (short)</div>
    <div class="caster-arm" style="width:20mm;height:90mm">ARM 2</div>
    <div class="caster-arm" style="width:20mm;height:120mm">ARM 3 (long)</div>
  </div>
  <div class="row" style="padding-top:6mm">
    <div class="marker">CASTER STANDS HERE</div>
    <div class="marker">TORCH RESTS HERE</div>
  </div>
</body>
</html>
`;

writeFileSync(path.join(repoRoot, "PRINT-PACK.html"), html);
console.log("wrote PRINT-PACK.html");
