import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OperatorPanel } from "../src/operator/OperatorPanel";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("the dormant production panel renders zero HTML", () => {
  assert.equal(renderToStaticMarkup(createElement(OperatorPanel)), "");
});

test("closed operator access leaves no named or interactive DOM affordance", () => {
  const panel = source("../src/operator/OperatorPanel.tsx");
  const access = source("../src/operator/useOperatorAccess.ts");

  const nullReturn = panel.indexOf("if (!access.open) return null;");
  const overlay = panel.indexOf("className=\"operator-overlay\"");
  assert.ok(nullReturn >= 0);
  assert.ok(overlay > nullReturn);
  assert.doesNotMatch(access, /return\s*\([\s\S]*<[a-z]/i);
  assert.match(access, /window\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(panel, /import\.meta\.env\.DEV/);
  assert.match(panel, /createPortal/);
  assert.match(panel, /document\.body/);
  assert.doesNotMatch(panel, /suspendVhs/);
});

test("panel exposes every instant recovery control without dialogs", () => {
  const panel = source("../src/operator/OperatorPanel.tsx");
  for (const label of [
    "RESOLVE",
    "UN-RESOLVE",
    "GRANT",
    "REVOKE",
    "HEALTH",
    "ACT",
    "FORCE ON",
    "FORCE OFF",
    "UNMUTE",
    "MUTE ALL",
    "VHS INTENSITY",
    "SKIP CURRENT SCARE",
    "FULL RESET TO PIN 1",
  ]) {
    assert.ok(panel.includes(label), `missing operator control: ${label}`);
  }
  assert.doesNotMatch(panel, /\b(?:confirm|prompt|alert)\s*\(/);
  assert.match(panel, /currentPinForOperator/);
  assert.match(panel, /currentZoneForOperator/);
  assert.match(panel, /audioInitialization/);
  assert.match(panel, /arInitialization/);
});

test("operator styling is token-only, square, mechanical, and imported", () => {
  const styles = source("../src/styles/operator.css");
  const rootStyles = source("../src/styles.css");
  assert.match(rootStyles, /@import "\.\/styles\/operator\.css"/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(styles, /box-shadow/i);
  const radii = Array.from(styles.matchAll(/border-radius:\s*([^;]+);/gi));
  assert.ok(
    radii.every((match) => match[1]?.trim() === "0"),
  );
  assert.match(styles, /z-index:\s*2147483647/);
});

test("operator recovery writes survive an in-flight hydration", () => {
  const store = source("../src/game/store.ts");
  assert.match(store, /operatorMutationRevision === hydrationRevision/);
  assert.match(store, /replaceStateFromOperator/);
  assert.match(store, /persistGameStateImmediately\(gameState\)/);
});

test("operator runtime exposes synchronous scare and reset subscriptions", () => {
  const runtime = source("../src/operator/runtime.ts");
  assert.match(runtime, /subscribeToOperatorScareSkip/);
  assert.match(runtime, /scareSkipListeners\.forEach/);
  assert.match(runtime, /subscribeToOperatorReset/);
  assert.match(runtime, /resetListeners\.forEach/);
});
