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
const scrollerSource = readFileSync(
  new URL("../src/map/SurveyScroller.tsx", import.meta.url),
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

test("the map is an inline SVG blueprint with the survey furniture", () => {
  assert.match(surveySource, /<svg/);
  assert.doesNotMatch(surveySource, /<canvas|WebGL|three|fetch\(|https?:\/\//i);
  assert.match(surveySource, /survey-grid/);
  assert.match(surveySource, /survey-compass/);
  assert.match(surveySource, /FLAT 33 · ARCHITECTURAL SURVEY/);
  assert.match(surveySource, /CRIMSON · THE LOCK HOLDS/);
  assert.match(surveySource, /SLATE · RELEASED/);
  assert.match(surveySource, /MARK · YOUR OBJECTIVE/);
  assert.match(surveySource, /survey-objective/);
  assert.match(surveySource, /survey-terminal/);
  assert.match(surveySource, /YOU ARE HERE/);
  // The paper-survey dressing is gone: this is a drafting blueprint.
  assert.doesNotMatch(surveySource, /survey-coffee|survey-paper-fiber|survey-ink-echo/);
});

test("/map is a shell tab that fills the slot with no page scroll surface", () => {
  assert.match(appSource, /case "\/map":\s*\n\s*return <MapScreen state=\{state\} \/>;/);
  assert.doesNotMatch(screenSource, /className="screen|screen-heading|<header|<h1|map-gesture-note|map-state-key/);
  assert.equal((screenSource.match(/<SurveyScroller\b/g) ?? []).length, 1);
  assert.match(surveySource, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(
    mapCss,
    /\.map-screen\s*\{[\s\S]*?position:\s*relative[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%[\s\S]*?padding:\s*0[\s\S]*?overflow:\s*hidden/,
  );
  assert.match(mapCss, /\.survey-scroller\s*\{[\s\S]*?overflow:\s*auto/);
  // A live filter on the VHS stage would composite the whole screen on
  // every pan frame; the map route forces it off.
  assert.match(
    mapCss,
    /\.vhs-stage:has\(\.map-screen\)\s*\{[\s\S]*?transform:\s*none !important[\s\S]*?filter:\s*none !important/,
  );
});

test("the scroller owns pinch, double-tap, fit, and resize re-clamping", () => {
  assert.match(scrollerSource, /ResizeObserver/);
  assert.match(scrollerSource, /fitMapCanvasSize/);
  assert.match(scrollerSource, /pinchMapZoom/);
  assert.match(scrollerSource, /mapScrollAfterZoom/);
  assert.match(scrollerSource, /doubleTapTargetZoom/);
  assert.match(scrollerSource, /registerMapTap/);
  assert.match(scrollerSource, /removeEventListener\("touchmove", onTouchMove\)/);
  assert.doesNotMatch(scrollerSource, /fetch\(|XMLHttpRequest|WebSocket|EventSource/i);
  // Native scroll owns panning: no pointermove pan math may return.
  assert.doesNotMatch(scrollerSource, /pointermove/);
});

test("map page copy is removed and the Keeper route text lives in the letter tab", () => {
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
  const renderSources = surveySource + "\n" + screenSource;
  assert.match(surveySource, /data-room=/);
  assert.match(surveySource, /data-room-state=/);
  assert.match(surveySource, /GIFT_MARKS/);
  assert.doesNotMatch(
    renderSources,
    /data-pin|pin-marker|pin-count|getPinById|remaining(?:Count)?|unresolved contacts?/i,
  );
  assert.doesNotMatch(renderSources, /aria-label=[^\n]*(?:pin\b|contact)/i);
});

test("room-state fills follow the RE rule on shared tokens only", () => {
  // Current stage: deep crimson with a slow pulse.
  assert.match(
    mapCss,
    /\[data-room-state="unresolved"\][\s\S]*?fill:\s*var\(--c-chroma-red\)[\s\S]*?animation:\s*survey-holds-pulse/,
  );
  // Completed rooms: desaturated slate.
  assert.match(
    mapCss,
    /\[data-room-state="cleared"\][\s\S]*?fill:\s*var\(--c-slate\)/,
  );
  // Not yet reached: outline only, near-invisible.
  assert.match(
    mapCss,
    /\[data-room-state="unentered"\] \.survey-room__fill\s*\{[\s\S]*?fill:\s*none/,
  );
  assert.match(
    mapCss,
    /\[data-room-state="unentered"\][\s\S]*?survey-room__line[\s\S]*?stroke:\s*var\(--c-hairline\)/,
  );
  assert.match(mapCss, /\[data-outline-only="true"\][\s\S]*?fill:\s*none/);
  assert.doesNotMatch(mapCss, /#[0-9a-f]{3,8}\b/i);
  // Every map animation stops under prefers-reduced-motion.
  assert.match(
    mapCss,
    /prefers-reduced-motion[\s\S]*survey-room\[data-room-state="unresolved"\][\s\S]*animation:\s*none/,
  );
});

test("the renderer consumes the tested model and canonical room vocabulary", () => {
  assert.match(surveySource, /deriveSurveyMap/);
  assert.match(surveySource, /map\.rooms\.map/);
  assert.match(surveySource, /map\.connections\.map/);
  assert.match(surveySource, /map\.furniture\.map/);
  assert.match(surveySource, /map\.landmarks\.map/);
  assert.match(surveySource, /map\.objectiveZone/);
  assert.doesNotMatch(surveySource, /ROOM_GEOMETRY/);
  assert.match(surveySource, /room\.statusLabel/);
  assert.doesNotMatch(
    surveySource + screenSource,
    /SEARCHING|UNSEEN|SEARCH INCOMPLETE|NOT ENTERED|UNRESOLVED|UNENTERED/,
  );
});

test("survey typography stays on static design tokens", () => {
  assert.doesNotMatch(mapCss, /font-size:\s*\d+(?:\.\d+)?px/);
  assert.match(mapCss, /\.survey-title[\s\S]*?font-family:\s*var\(--font-award\)/);
});
