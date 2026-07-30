import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const surveySource = readFileSync(
  new URL("../src/map/SurveyMap.tsx", import.meta.url),
  "utf8",
);
const screenSource = readFileSync(
  new URL("../src/components/MapScreen.tsx", import.meta.url),
  "utf8",
);
const mapCss = readFileSync(
  new URL("../src/styles/map.css", import.meta.url),
  "utf8",
);
const viewportSource = readFileSync(
  new URL("../src/map/useMapViewport.ts", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/components/GameApp.tsx", import.meta.url),
  "utf8",
);
const notesSource = readFileSync(
  new URL("../src/components/NotesScreen.tsx", import.meta.url),
  "utf8",
);

test("the map is an inline SVG survey with the requested paper details", () => {
  assert.match(surveySource, /<svg/);
  assert.doesNotMatch(surveySource, /<canvas|WebGL|three|fetch\(|https?:\/\//i);
  assert.match(surveySource, /survey-wall-hatch/);
  assert.match(surveySource, /survey-coffee/);
  assert.match(surveySource, /survey-north/);
  assert.match(surveySource, /survey-title-block/);
  assert.match(surveySource, /survey-legend-swatch--unresolved/);
  assert.match(surveySource, /survey-legend-swatch--cleared/);
  assert.match(surveySource, /survey-legend-swatch--unentered/);
  assert.match(surveySource, /START \/\/ FAR END/);
  assert.match(surveySource, /FRONT DOOR \/\/ SEALED/);
});

test("/map is a chrome-free full-bleed viewport with no scroll surface", () => {
  assert.match(appSource, /if \(route === "\/map"\) return <MapScreen state=\{state\} onClose=\{\(\) => navigate\("\/"\)\} \/>;/);
  assert.doesNotMatch(screenSource, /className="screen|screen-heading|<header|<h1|map-gesture-note|map-state-key/);
  assert.equal((screenSource.match(/<SurveyScroller\b/g) ?? []).length, 1);
  // `slice` crops any box/viewBox mismatch instead of silently shrinking the
  // drawing inside its own element, which is what clipped the bathroom.
  assert.match(surveySource, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(
    mapCss,
    /\.map-screen\s*\{[\s\S]*?position:\s*fixed[\s\S]*?inset:\s*0[\s\S]*?width:\s*100vw[\s\S]*?height:\s*100dvh[\s\S]*?padding:\s*0[\s\S]*?overflow:\s*hidden/,
  );
  assert.match(
    mapCss,
    /\.survey-scroller\s*\{[\s\S]*?overflow:\s*auto/,
  );
  // The ratio comes from the single injected token, never a hand-copied
  // literal; native scroll owns panning so clipping cannot recur.
  assert.match(mapCss, /aspect-ratio:\s*var\(--map-aspect\)/);
  assert.doesNotMatch(mapCss, /136dvh|73\.52/);
  assert.match(
    mapCss,
    /\.vhs-stage:has\(> \.map-screen\)\s*\{[\s\S]*?transform:\s*none !important[\s\S]*?filter:\s*none !important/,
  );
  assert.doesNotMatch(mapCss, /aspect-ratio:\s*3\s*\/\s*2/);
  
});

test("map page copy is removed and the Host route text lives in Notes as a document", () => {
  for (const removed of [
    "SURVEY // FLAT 33",
    "THE FLOORPLAN",
    "SPREAD TO INSPECT",
    "DRAG TO PAN",
    "DOUBLE-TAP TO RESET",
  ]) {
    assert.ok(!screenSource.includes(removed), `${removed} must not remain on /map`);
  }
  assert.doesNotMatch(screenSource, /The front door stays shut/);
  assert.match(notesSource, /id: "survey-route"/);
  assert.match(notesSource, /Four locks, four gifts, one letter in quarters/);
  assert.match(notesSource, /the letter assembles itself/);
});

test("rendered map surfaces carry room state and named gifts, never pin bookkeeping", () => {
  // 2026-07-30, owner decision: gifts named by an open lock DO appear on the
  // sheet (GIFT_MARKS). Pin counts, ids, and contact language stay banned.
  const renderSources = surveySource + "\n" + screenSource;
  assert.match(surveySource, /data-room=/);
  assert.match(surveySource, /data-room-state=/);
  assert.match(surveySource, /GIFT_MARKS/);
  assert.doesNotMatch(
    renderSources,
    /data-pin|pin-marker|pin-count|getPinById|remaining(?:Count)?|unresolved contacts?/i,
  );
  assert.doesNotMatch(renderSources, /aria-label=[^\n]*(?:pin|contact)/i);
});

test("room-state fills use only the shared rust, slate, and surface tokens", () => {
  assert.match(
    mapCss,
    /\[data-room-state="unresolved"\][\s\S]*?fill:\s*var\(--c-map-red\)/,
  );
  assert.match(
    mapCss,
    /\[data-room-state="cleared"\][\s\S]*?fill:\s*var\(--c-slate\)/,
  );
  assert.match(
    mapCss,
    /\[data-room-state="unentered"\][\s\S]*?fill:\s*var\(--c-surface\)/,
  );
  assert.match(
    mapCss,
    /\[data-room-state="unentered"\][\s\S]*?survey-room__line[\s\S]*?stroke-width:\s*1px/,
  );
  assert.match(mapCss, /\[data-outline-only="true"\][\s\S]*?fill:\s*none/);
  assert.doesNotMatch(mapCss, /#[0-9a-f]{3,8}\b/i);
});

test("map interaction is event-driven, frame-capped, and locally cleaned up", () => {
  assert.match(viewportSource, /requestAnimationFrame/);
  assert.match(viewportSource, /cancelAnimationFrame/);
  assert.match(viewportSource, /releasePointerCapture/);
  assert.match(viewportSource, /isMapViewportFrameDue/);
  assert.doesNotMatch(viewportSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource/i);
  assert.doesNotMatch(viewportSource, /setInterval|setTimeout/);
});

test("the renderer consumes the tested model and canonical room vocabulary", () => {
  assert.match(surveySource, /deriveSurveyMap/);
  assert.match(surveySource, /map\.rooms\.map/);
  assert.match(surveySource, /map\.connections\.map/);
  assert.match(surveySource, /map\.furniture\.map/);
  assert.match(surveySource, /map\.landmarks\.map/);
  assert.doesNotMatch(surveySource, /ROOM_GEOMETRY/);
  assert.match(surveySource, /room\.statusLabel/);
  assert.doesNotMatch(
    surveySource + screenSource,
    /SEARCHING|UNSEEN|SEARCH INCOMPLETE|NOT ENTERED/,
  );
});

test("survey typography and uneven ink stay on static design tokens", () => {
  assert.doesNotMatch(mapCss, /font-size:\s*\d+(?:\.\d+)?px/);
  assert.match(mapCss, /\.survey-title[\s\S]*?font-family:\s*var\(--font-award\)/);
  assert.match(mapCss, /\.survey-ink-echo[\s\S]*?stroke-dasharray/);
  assert.match(surveySource, /survey-ink-echo/);
  assert.match(surveySource, /survey-paper-fiber/);
  assert.doesNotMatch(mapCss, /animation\s*:/);
});
