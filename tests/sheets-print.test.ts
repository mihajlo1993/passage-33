import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SheetsScreen } from "../src/components/SheetsScreen";
import {
  HOST_ROOM_NAMES,
  PrintableSurveyMap,
} from "../src/map/PrintableSurveyMap";
import {
  mapFurniture,
  mapLandmarks,
  roomConnections,
  roomDefinitions,
} from "../src/map/model";
import { printablePins } from "../src/pins";
import { kallaxGlyphs } from "../src/glyphs";

const sheetsCss = readFileSync(
  new URL("../src/styles/sheets.css", import.meta.url),
  "utf8",
);
const sheetsSource = readFileSync(
  new URL("../src/components/SheetsScreen.tsx", import.meta.url),
  "utf8",
);
const printableMapSource = readFileSync(
  new URL("../src/map/PrintableSurveyMap.tsx", import.meta.url),
  "utf8",
);
const codesCss = readFileSync(
  new URL("../src/styles/codes.css", import.meta.url),
  "utf8",
);
const glyphsCss = readFileSync(
  new URL("../src/styles/glyphs.css", import.meta.url),
  "utf8",
);
const codesSource = readFileSync(
  new URL("../src/components/CodesScreen.tsx", import.meta.url),
  "utf8",
);
const glyphsSource = readFileSync(
  new URL("../src/components/GlyphsScreen.tsx", import.meta.url),
  "utf8",
);
const codesRouteSource = readFileSync(
  new URL("../src/components/print/CodesRoute.tsx", import.meta.url),
  "utf8",
);
const glyphsRouteSource = readFileSync(
  new URL("../src/components/print/GlyphsRoute.tsx", import.meta.url),
  "utf8",
);
const sheetsRouteSource = readFileSync(
  new URL("../src/components/print/SheetsRoute.tsx", import.meta.url),
  "utf8",
);

const appSource = readFileSync(
  new URL("../src/components/GameApp.tsx", import.meta.url),
  "utf8",
);
const globalStylesSource = readFileSync(
  new URL("../src/styles.css", import.meta.url),
  "utf8",
);
const tokenSource = readFileSync(
  new URL("../src/tokens.ts", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../src/main.tsx", import.meta.url),
  "utf8",
);

test("/sheets is a production route with its print tokens and stylesheet wired", () => {
  assert.match(appSource, /lazy\(\(\) => import\(["']\.\/print\/SheetsRoute["']\)/);
  assert.doesNotMatch(appSource, /import \{ SheetsScreen \} from ["']\.\/SheetsScreen["']/);
  assert.match(appSource, /"\/sheets"/);
  assert.match(appSource, /route === "\/sheets"[\s\S]*?<LazySheetsScreen/);
  assert.match(sheetsRouteSource, /import ["']\.\.\/\.\.\/styles\/sheets\.css["']/);
  assert.doesNotMatch(sheetsSource, /styles\/sheets\.css/);
  assert.doesNotMatch(globalStylesSource, /styles\/sheets\.css/);
  assert.match(tokenSource, /printBlack:\s*['"]#000000['"]/);
  assert.match(tokenSource, /printWhite:\s*['"]#FFFFFF['"]/);
  assert.match(mainSource, /"--c-print-black":\s*colours\.printBlack/);
  assert.match(mainSource, /"--c-print-white":\s*colours\.printWhite/);
});

test("/sheets renders exactly three explicit print pages", () => {
  const markup = renderToStaticMarkup(createElement(SheetsScreen));
  assert.equal((markup.match(/class="prop-sheet /g) ?? []).length, 3);
  assert.match(markup, /data-sheet="01"/);
  assert.match(markup, /data-sheet="02"/);
  assert.match(markup, /data-sheet="03"/);
  assert.match(sheetsCss, /@page\s*\{[\s\S]*?size:\s*A4 portrait/);
  assert.match(
    sheetsCss,
    /\.prop-sheet\s*\{[\s\S]*?width:\s*210mm[\s\S]*?height:\s*297mm/,
  );
  assert.match(
    sheetsCss,
    /\.prop-sheet\s*\{[\s\S]*?break-after:\s*page[\s\S]*?page-break-after:\s*always/,
  );
});

test("image sheets load only available print PNGs and label missing decorative sources", () => {
  const markup = renderToStaticMarkup(createElement(SheetsScreen));
  assert.ok(markup.includes("/media/sheet01.png"));
  assert.ok(!markup.includes("/media/sheet01.webp"));
  assert.ok(!markup.includes("/media/sheet02.png"));
  assert.match(markup, /data-sheet="02"[\s\S]*?class="prop-sheet__missing"/);
  assert.match(markup, /Sheet 02[\s\S]*?Source missing/);
  assert.match(sheetsSource, /MEDIA_ASSETS\[baseName\]/);
  assert.doesNotMatch(sheetsSource, /setMissing|<source\b|<picture\b/);
  assert.doesNotMatch(sheetsSource, /fetch\(|https?:\/\//i);
});

test("all desktop print routes are lazy and own their print CSS", () => {
  for (const [screen, route] of [
    ["Codes", "codes"],
    ["Glyphs", "glyphs"],
    ["Sheets", "sheets"],
  ] as const) {
    assert.match(
      appSource,
      new RegExp(`lazy\\(\\(\\) => import\\(["']\\./print/${screen}Route["']\\)`),
    );
    assert.match(appSource, new RegExp(`route === ["']/${route}["']`));
  }
  assert.match(codesRouteSource, /import ["']\.\.\/\.\.\/styles\/codes\.css["']/);
  assert.match(glyphsRouteSource, /import ["']\.\.\/\.\.\/styles\/glyphs\.css["']/);
  assert.doesNotMatch(codesSource, /styles\/codes\.css/);
  assert.doesNotMatch(glyphsSource, /styles\/glyphs\.css/);
  assert.doesNotMatch(globalStylesSource, /styles\/(?:codes|glyphs|sheets)\.css/);
});

test("Sheet 03 consumes every canonical survey-model collection", () => {
  const markup = renderToStaticMarkup(createElement(PrintableSurveyMap));
  assert.equal((markup.match(/class="print-survey__room"/g) ?? []).length, roomDefinitions.length);
  assert.equal((markup.match(/data-room=/g) ?? []).length, roomDefinitions.length);
  assert.equal((markup.match(/class="print-survey__door"/g) ?? []).length, roomConnections.filter(({ passage }) => passage === "door").length);
  assert.equal((markup.match(/class="print-survey__furniture"/g) ?? []).length >= mapFurniture.length, true);
  for (const landmark of mapLandmarks) assert.match(markup, new RegExp(landmark.label));
  for (const hostName of Object.values(HOST_ROOM_NAMES)) {
    assert.ok(markup.includes(hostName.replaceAll("'", "&#x27;")));
  }
  assert.match(printableMapSource, /roomDefinitions\.map/);
  assert.match(printableMapSource, /roomConnections\.map/);
  assert.match(printableMapSource, /mapFurniture\.map/);
  assert.match(printableMapSource, /mapLandmarks\.map/);
});

test("Sheet 03 is black-on-white line work with hatching and a Host title block", () => {
  const markup = renderToStaticMarkup(createElement(PrintableSurveyMap));
  assert.match(markup, /print-survey-wall-hatch/);
  assert.match(markup, /print-survey__north/);
  assert.match(markup, /print-survey__title-block/);
  assert.match(markup, /HOST&#x27;S MASTER SURVEY/);
  assert.doesNotMatch(markup, /data-room-state|UNRESOLVED|CLEARED|UNENTERED/);
  assert.ok((markup.match(/fill="none"/g) ?? []).length >= roomDefinitions.length);
  assert.match(sheetsCss, /--c-print-black/);
  assert.match(sheetsCss, /--c-print-white/);
  assert.doesNotMatch(sheetsCss, /#[0-9a-f]{3,8}\b/i);
});

test("pressed-text setup area is at least 140mm by 20mm and never prints hidden prose", () => {
  const markup = renderToStaticMarkup(createElement(SheetsScreen));
  assert.equal((markup.match(/press text here/g) ?? []).length, 1);
  assert.match(markup, /pressed-text-area__tick--north-west/);
  assert.match(markup, /pressed-text-area__tick--south-east/);

  const areaRule = sheetsCss.match(/\.pressed-text-area\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const width = Number(areaRule.match(/width:\s*([\d.]+)mm/)?.[1]);
  const height = Number(areaRule.match(/height:\s*([\d.]+)mm/)?.[1]);
  assert.ok(width >= 140, `pressed-text width ${width}mm`);
  assert.ok(height >= 20, `pressed-text height ${height}mm`);
  assert.doesNotMatch(
    sheetsSource + printableMapSource,
    /hidden (?:message|text)|secret (?:message|text)|chem(?:ical)? fluid/i,
  );
});

test("/sheets print layout uses physical units rather than viewport or pixel units", () => {
  assert.doesNotMatch(sheetsCss, /\b(?:d?v[wh]|px|rem|em)\b/i);
  assert.match(sheetsCss, /\.prop-sheet--image\s*\{[\s\S]*?padding:\s*10mm/);
  assert.match(sheetsCss, /\.prop-sheet__image\s*\{[\s\S]*?object-fit:\s*contain/);
});

test("print output suppresses runtime VHS and operator overlays", () => {
  assert.match(sheetsCss, /@media print\s*\{[\s\S]*?\.vhs-stage\s*\{[\s\S]*?filter:\s*none/);
  assert.match(
    sheetsCss,
    /\.vhs-overlay,[\s\S]*?\.operator-overlay\s*\{[\s\S]*?display:\s*none/,
  );
  assert.match(sheetsCss, /\.sheets-screen :where\([\s\S]*?text-shadow:\s*none/);
});

test("the original /codes route prints 27 labelled local codes at 30mm or larger", () => {
  assert.equal(printablePins.length, 27);
  assert.equal(printablePins.some(({ id }) => id === 24), false);
  assert.match(codesSource, /PIN \{formattedId\}/);
  assert.match(codesSource, /\{pin\.name\}/);
  assert.match(codesSource, /\{zoneName\}/);
  assert.match(codesCss, /@page\s*\{[\s\S]*?size:\s*A4 portrait/);
  assert.match(codesCss, /page-break-after:\s*always/);

  const qrRule = codesCss.match(/\.code-card__qr\s*\{([\s\S]*?)\}/g)?.at(-1) ?? "";
  const printWidth = Number(qrRule.match(/width:\s*min\(100%,\s*([\d.]+)mm\)/)?.[1]);
  assert.ok(printWidth >= 30, `QR print width ${printWidth}mm`);
});

test("the original /glyphs route prints sixteen labels and one setup-only key page", () => {
  assert.equal(kallaxGlyphs.length, 16);
  assert.match(glyphsSource, /kallaxGlyphs\.map/);
  assert.match(glyphsSource, /SETUP ONLY \/\/ DO NOT LEAVE IN PLAY/);
  assert.match(glyphsSource, /glyph-page glyph-page--key/);
  assert.match(glyphsCss, /@page\s*\{[\s\S]*?size:\s*A4 portrait/);
  assert.match(glyphsCss, /page-break-after:\s*always/);
  assert.match(glyphsCss, /width:\s*190mm/);
});
