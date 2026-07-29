import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import jsQR from "jsqr";
import QRCode from "qrcode";

import { KALLAX_GLYPH_COUNT, KALLAX_KEY_GLYPH_INDEX, kallaxGlyphs } from "../src/glyphs";
import { itemIds, items } from "../src/items";
import {
  ALPHA_DIAL_SYMBOLS,
  createDialValue,
  dialCodeMatches,
  isValidDialCode,
  rotateDialAt,
} from "../src/locks";

import {
  areFinalPresentsResolved,
  attemptResolvePin,
  attemptUseFirstAid,
  createDefaultGameState,
  isCritical,
  resolutionModeForPin,
  type PinResolutionResult,
} from "../src/game/engine";
import {
  BALCONY_DIAL_WORD,
  CABINET_DIAL_CODE,
  FINAL_PRESENT_PIN_IDS,
  getPinById,
  pins,
  printablePins,
  SEALED_PRESENT_PIN_ID,
  TOTAL_PIN_COUNT,
} from "../src/pins";
import {
  GAME_STATE_JOURNAL_KEY,
  flushGameStateSynchronously,
  loadSynchronousGameState,
  persistGameStateImmediately,
  queueGameStateWrite,
  type GameStateStorage,
} from "../src/game/persistence";
import { parsePinPayload, pinPayload } from "../src/scanner/payload";
import type { GameState } from "../src/types";

function renderQrPixels(payload: string): {
  data: Uint8ClampedArray;
  side: number;
} {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const quietZone = 4;
  const scale = 8;
  const side = (qr.modules.size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  data.fill(255);

  for (let moduleY = 0; moduleY < qr.modules.size; moduleY += 1) {
    for (let moduleX = 0; moduleX < qr.modules.size; moduleX += 1) {
      if (qr.modules.data[moduleY * qr.modules.size + moduleX] === 0) continue;

      const firstX = (moduleX + quietZone) * scale;
      const firstY = (moduleY + quietZone) * scale;
      for (let pixelY = firstY; pixelY < firstY + scale; pixelY += 1) {
        for (let pixelX = firstX; pixelX < firstX + scale; pixelX += 1) {
          const offset = (pixelY * side + pixelX) * 4;
          data[offset] = 11;
          data[offset + 1] = 10;
          data[offset + 2] = 8;
        }
      }
    }
  }

  return { data, side };
}

function resolveSuccessfully(
  state: GameState,
  pinId: number,
): GameState {
  const pin = getPinById(pinId);
  assert.ok(pin, `unknown pin ${pinId}`);
  const result = attemptResolvePin(state, pinId, state.startedAt + pinId, resolutionModeForPin(pin));
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : `pin ${pinId} refused: ${result.reason}`,
  );
  return result.state;
}

function stateAfter(lastPin: number): GameState {
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    state = resolveSuccessfully(state, pin.id);
    if (pin.id === lastPin) return state;
  }
  throw new Error(`Unknown terminal pin ${lastPin}`);
}

function stateBefore(pinId: number): GameState {
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    if (pin.id === pinId) return state;
    state = resolveSuccessfully(state, pin.id);
  }
  throw new Error(`Unknown target pin ${pinId}`);
}

function assertRefusal(
  result: PinResolutionResult,
  expectedState: GameState,
): asserts result is Extract<PinResolutionResult, { ok: false }> {
  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.strictEqual(result.state, expectedState, "a refusal must not mutate state");
  assert.equal(result.status, "refused");
  assert.ok(result.hint.length > 20, "refusals include a useful Host hint");
  assert.match(result.hint, /birthday|party|guest|arrangement/i);
}

test("walking pins 1 through 28 completes the whole chain", () => {
  let state = createDefaultGameState(1_000);

  for (const pin of pins) {
    const result = attemptResolvePin(state, pin.id, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(
      result.ok,
      true,
      result.ok ? undefined : `pin ${pin.id} refused: ${result.reason}`,
    );

    if (!result.ok) {
      continue;
    }

    state = result.state;

    if (pin.id === 3) assert.equal(state.act, 2);
    if (pin.id === 8) {
      assert.equal(state.act, 3);
      assert.equal(state.lastSavePin, 8);
    }
    if (pin.id === 18) assert.equal(state.act, 4);
    if (pin.id === 21) assert.equal(state.act, 5);
    if (pin.id === 23) {
      assert.ok(result.revokedItems.includes("candleLit"));
      assert.ok(!state.inventory.includes("candleLit"));
    }
    if (pin.id === 24) assert.ok(state.inventory.includes("candleLit"));
    if (pin.id === 26) {
      assert.equal(result.finished, true);
      assert.equal(result.gameCompleted, false);
      assert.equal(state.trophyAt, 1_026);
      assert.equal(state.finishedAt, null);
      assert.equal(areFinalPresentsResolved(state.resolvedPins), false);
      assert.equal(state.clearedZones.includes("kitchen"), false);
    }
    if (pin.id === 27) assert.equal(result.gameCompleted, false);
    if (pin.id === 28) assert.equal(result.gameCompleted, true);
  }

  assert.deepEqual(state.resolvedPins, pins.map((pin) => pin.id));
  assert.equal(state.health, 45);
  assert.equal(state.trophyAt, 1_026, "the final presents must not move the trophy time");
  assert.equal(state.finishedAt, 1_028, "the game ends only when the second present opens");
  assert.equal(areFinalPresentsResolved(state.resolvedPins), true);
  assert.ok(state.inventory.includes("theHand"));
  assert.ok(state.inventory.includes("theAltar"));
  assert.ok(state.inventory.includes("carbonator"));
});

test("the sealed present cycles early Host refusals from act IV onward", () => {
  const pin = getPinById(SEALED_PRESENT_PIN_ID);
  assert.ok(pin);
  assert.equal(pin.kind, "sealed");
  assert.equal(pin.scannableFromAct, 4);
  assert.ok((pin.earlyRefusals?.length ?? 0) >= 4);

  const actThree = stateAfter(8);
  const tooEarly = attemptResolvePin(actThree, SEALED_PRESENT_PIN_ID, 2_000, "scan", 0);
  assert.equal(tooEarly.ok, false);
  if (!tooEarly.ok) assert.equal(tooEarly.reason, "out-of-act");

  const actFour = stateAfter(18);
  const hints: string[] = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = attemptResolvePin(
      actFour,
      SEALED_PRESENT_PIN_ID,
      3_000 + attempt,
      "scan",
      attempt,
    );
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.strictEqual(result.state, actFour);
    assert.equal(result.reason, "sealed-present");
    assert.deepEqual(result.missingPins, [26]);
    hints.push(result.hint);
  }
  assert.equal(new Set(hints.slice(0, 4)).size, 4);
  assert.equal(hints[4], hints[0], "the fifth early scan cycles to the first refusal");

  const actFiveBeforeCandles = stateAfter(25);
  const stillSealed = attemptResolvePin(
    actFiveBeforeCandles,
    SEALED_PRESENT_PIN_ID,
    4_000,
    "scan",
    2,
  );
  assert.equal(stillSealed.ok, false);
  if (!stillSealed.ok) assert.equal(stillSealed.reason, "sealed-present");
});

test("pins 27 and 28 are order-independent after 26 and only the pair completes the game", () => {
  assert.deepEqual(FINAL_PRESENT_PIN_IDS, [27, 28]);
  assert.deepEqual(getPinById(27)?.requiresPin, [26]);
  assert.deepEqual(getPinById(28)?.requiresPin, [26]);
  assert.equal(getPinById(27)?.requiresPin?.includes(28), false);
  assert.equal(getPinById(28)?.requiresPin?.includes(27), false);

  for (const order of [[27, 28], [28, 27]] as const) {
    let state = stateAfter(26);
    assert.equal(areFinalPresentsResolved(state.resolvedPins), false);
    assert.equal(state.clearedZones.includes("corridor"), false);
    assert.equal(state.clearedZones.includes("kitchen"), false);

    for (const [index, pinId] of order.entries()) {
      const result = attemptResolvePin(state, pinId, 2_000 + pinId, "scan");
      assert.equal(result.ok, true, `pin ${pinId} resolves in order ${order.join(" then ")}`);
      if (!result.ok) continue;
      assert.equal(result.gameCompleted, index === 1);
      state = result.state;
    }

    assert.equal(areFinalPresentsResolved(state.resolvedPins), true);
    assert.equal(state.trophyAt, 1_026, "the trophy remains timestamped at pin 26");
    assert.equal(state.finishedAt, 2_000 + order[1]);
    assert.equal(state.clearedZones.includes("corridor"), true);
    assert.equal(state.clearedZones.includes("kitchen"), true);
    assert.ok(state.inventory.includes(itemIds.theHand));
    assert.ok(state.inventory.includes(itemIds.theAltar));
    assert.ok(state.inventory.includes(itemIds.carbonator));
  }
});

test("the trophy fires at 26 and only the final pair starts the quiet closing", () => {
  const trophySource = readFileSync(
    new URL("../src/components/TrophyScreen.tsx", import.meta.url),
    "utf8",
  );
  const scannerSource = readFileSync(
    new URL("../src/components/ScanScreen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(trophySource, /trophyUnlocked = trophyAt !== null/);
  assert.match(trophySource, /areFinalPresentsResolved\(state\.resolvedPins\)/);
  assert.match(trophySource, /window\.setTimeout/);
  assert.match(trophySource, /audio\.ambient\(null\)/);
  assert.doesNotMatch(trophySource, /audio\.silence\(\)/);
  assert.match(trophySource, /trophy-screen--quiet/);
  assert.match(scannerSource, /result\.pin\.id === 26 \|\| result\.gameCompleted/);
  assert.match(scannerSource, /FIND THE OTHER PRESENT/);
});
test("out-of-act and unknown scans refuse without changing GameState", () => {
  const state = createDefaultGameState(2_000);

  const future = attemptResolvePin(state, 4);
  assertRefusal(future, state);
  assert.equal(future.reason, "out-of-act");
  assert.deepEqual(state.resolvedPins, []);

  const unknown = attemptResolvePin(state, 99);
  assertRefusal(unknown, state);
  assert.equal(unknown.reason, "unknown-pin");
});

test("every physical predecessor gate refuses when its required pin is absent", () => {
  for (const pin of pins.filter((candidate) => candidate.requiresPin?.length)) {
    const reached = stateBefore(pin.id);
    for (const requiredPin of pin.requiresPin ?? []) {
      const state: GameState = {
        ...reached,
        resolvedPins: reached.resolvedPins.filter((id) => id !== requiredPin),
      };
      const result = attemptResolvePin(state, pin.id, state.startedAt, resolutionModeForPin(pin));

      assertRefusal(result, state);
      assert.equal(
        result.reason,
        pin.kind === "sealed" ? "sealed-present" : "missing-prerequisite-pins",
        `pin ${pin.id}`,
      );
      assert.ok(result.missingPins.includes(requiredPin), `pin ${pin.id}`);
    }
  }
});

test("every listed inventory gate requires all of its items", () => {
  for (const pin of pins.filter((candidate) => candidate.requires.length > 0)) {
    const reached = stateBefore(pin.id);

    for (const requiredItem of pin.requires) {
      const state: GameState = {
        ...reached,
        inventory: reached.inventory.filter((item) => item !== requiredItem),
      };
      const result = attemptResolvePin(state, pin.id, state.startedAt, resolutionModeForPin(pin));

      assertRefusal(result, state);
      assert.equal(result.reason, "missing-requirements", `pin ${pin.id}`);
      assert.ok(result.missingItems.includes(requiredItem), `pin ${pin.id}`);
      assert.ok(
        !result.hint.toLowerCase().includes(requiredItem.toLowerCase()),
        `pin ${pin.id} must not name ${requiredItem} in the player-facing hint`,
      );
    }
  }
});

test("a resolved pin cannot grant or damage twice", () => {
  const state = stateAfter(9);
  const result = attemptResolvePin(state, 9);

  assertRefusal(result, state);
  assert.equal(result.reason, "already-resolved");
  assert.equal(state.health, 85);
});

test("critical is strictly below 40 and first aid is consumed on use", () => {
  const beforeAid: GameState = {
    ...stateAfter(21),
    health: 39,
  };

  assert.equal(isCritical(40), false);
  assert.equal(isCritical(beforeAid.health), true);
  assert.ok(beforeAid.inventory.includes("firstAid"));

  const used = attemptUseFirstAid(beforeAid);
  assert.equal(used.ok, true);
  if (!used.ok) return;

  assert.equal(used.state.health, 100);
  assert.equal(used.restored, 61);
  assert.ok(!used.state.inventory.includes("firstAid"));
  assert.equal(isCritical(used.state.health), false);

  const refused = attemptUseFirstAid(used.state);
  assert.equal(refused.ok, false);
  assert.strictEqual(refused.state, used.state);
});

test("all 28 scanner payloads round-trip through the bundled jsQR fallback", () => {
  for (const pin of pins) {
    const payload = pinPayload(pin.id);
    const { data, side } = renderQrPixels(payload);
    const decoded = jsQR(data, side, side, { inversionAttempts: "attemptBoth" });

    assert.equal(decoded?.data, payload, "pin " + pin.id + " QR payload");
    assert.equal(
      parsePinPayload(decoded?.data ?? ""),
      pin.id,
      "pin " + pin.id + " scanner parse",
    );
  }
});

test("Part 1 amendments keep data, order, and printable contacts aligned", () => {
  const knownItemIds = new Set(items.map((item) => item.id));
  assert.equal(knownItemIds.has("lens"), false);
  assert.equal(knownItemIds.has("knowCell"), false);
  assert.equal("lens" in itemIds, false);
  assert.equal("knowCell" in itemIds, false);

  assert.deepEqual(getPinById(6)?.grants, [itemIds.kallaxGlyph]);
  assert.deepEqual(getPinById(12)?.grants, [itemIds.knowLoser]);
  assert.deepEqual(getPinById(14)?.requires, [itemIds.kallaxGlyph]);
  assert.deepEqual(getPinById(15)?.requires, []);
  assert.deepEqual(
    pins.slice(
      pins.findIndex((pin) => pin.id === 19),
      pins.findIndex((pin) => pin.id === 19) + 4,
    ).map((pin) => pin.id),
    [19, 20, 22, 21],
  );
  assert.deepEqual(getPinById(22)?.requiresPin, [20]);
  assert.deepEqual(getPinById(21)?.requiresPin, [22]);
  assert.deepEqual(getPinById(23)?.requiresPin, [21]);
  assert.deepEqual(getPinById(20)?.requires, [itemIds.herb, itemIds.chemFluid]);
  assert.deepEqual(getPinById(20)?.grants, [itemIds.firstAid]);
  assert.match(getPinById(20)?.bodyText ?? "", /glass.*mix.*drink/i);
  assert.doesNotMatch(getPinById(20)?.bodyText ?? "", /appliance|oven|microwave/i);
  assert.deepEqual(getPinById(25)?.requires, [itemIds.valve]);
  assert.match(getPinById(25)?.bodyText ?? "", /switch it off.*real fan/i);
  assert.doesNotMatch(getPinById(25)?.bodyText ?? "", /valve|handle/i);
  assert.doesNotMatch(getPinById(8)?.bodyText ?? "", /lockbox|physical box/i);

  assert.equal(TOTAL_PIN_COUNT, 28);
  assert.equal(printablePins.length, 27);
  assert.equal(printablePins.some((pin) => pin.id === 24), false);
  assert.deepEqual(
    pins.filter((pin) => !printablePins.includes(pin)).map((pin) => pin.id),
    [24],
  );

  assert.match(CABINET_DIAL_CODE, /^\d{3}$/);
  assert.equal(BALCONY_DIAL_WORD, "LOSER");
  assert.equal(KALLAX_GLYPH_COUNT, 16);
  assert.ok(KALLAX_KEY_GLYPH_INDEX >= 1 && KALLAX_KEY_GLYPH_INDEX <= 16);
  assert.deepEqual(
    kallaxGlyphs.map((glyph) => glyph.icon),
    Array.from({ length: 16 }, (_, index) =>
      `abstract-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("dial and in-app pins reject ordinary scanner resolution", () => {
  for (const pinId of [8, 16]) {
    const state = stateBefore(pinId);
    const refused = attemptResolvePin(state, pinId, state.startedAt, "scan");
    assertRefusal(refused, state);
    assert.equal(refused.reason, "interaction-required");

    const accepted = attemptResolvePin(state, pinId, state.startedAt, "dial");
    assert.equal(accepted.ok, true);
  }

  const beforeRelight = stateBefore(24);
  const scanned = attemptResolvePin(beforeRelight, 24, beforeRelight.startedAt, "scan");
  assertRefusal(scanned, beforeRelight);
  assert.equal(scanned.reason, "interaction-required");

  const relit = attemptResolvePin(beforeRelight, 24, beforeRelight.startedAt, "action");
  assert.equal(relit.ok, true);
  if (relit.ok) assert.ok(relit.state.inventory.includes(itemIds.candleLit));
});

test("zero-delay synchronous flush retains the newest mutation", () => {
  const values = new Map<string, string>();
  const storage: GameStateStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };

  const initial = createDefaultGameState(9_000);
  flushGameStateSynchronously(initial, storage);
  const newest = resolveSuccessfully(initial, 1);
  flushGameStateSynchronously(newest, storage);

  assert.deepEqual(loadSynchronousGameState(storage), newest);
});

test("queued snapshots coalesce and an explicit save commits in the same turn", async () => {
  const values = new Map<string, string>();
  const writes: GameState[] = [];
  const scheduled: Array<() => void> = [];
  const storage: GameStateStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push(JSON.parse(value) as GameState);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const schedule = (write: () => void) => {
    scheduled.push(write);
  };

  const initial = createDefaultGameState(10_000);
  const newest = resolveSuccessfully(initial, 1);
  queueGameStateWrite(initial, storage, schedule);
  queueGameStateWrite(newest, storage, schedule);

  assert.equal(scheduled.length, 1);
  assert.equal(writes.length, 0);
  scheduled[0]!();
  assert.equal(writes.length, 1);
  assert.deepEqual(loadSynchronousGameState(storage), newest);

  queueGameStateWrite(initial, storage, schedule);
  const immediate = resolveSuccessfully(newest, 2);
  const committed = persistGameStateImmediately(immediate, storage);
  assert.deepEqual(loadSynchronousGameState(storage), immediate);
  await committed;

  scheduled[1]!();
  assert.deepEqual(loadSynchronousGameState(storage), immediate);
  assert.equal(writes.length, 2);
});

test("local-only save migration recomputes zone clearance without a database", () => {
  const values = new Map<string, string>();
  const storage: GameStateStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const { playedVoiceIds, ...legacyState } = createDefaultGameState(11_000);
  assert.deepEqual(playedVoiceIds, []);
  const stale = {
    ...legacyState,
    act: 5,
    resolvedPins: [26],
    clearedZones: ["kitchen"],
    trophyAt: 11_500,
  };
  storage.setItem(GAME_STATE_JOURNAL_KEY, JSON.stringify(stale));

  const migrated = loadSynchronousGameState(storage);
  assert.ok(migrated);
  assert.deepEqual(migrated.playedVoiceIds, []);
  assert.equal(migrated.clearedZones.includes("kitchen"), false);

  const persistenceSource = readFileSync(
    new URL("../src/game/persistence.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(persistenceSource, /indexedDB|openDB|from ["']idb["']/);
});

test("dial helpers allow unlimited exact retries without lockout state", () => {
  const numeric = createDialValue("numeric");
  const alpha = createDialValue("alpha");

  assert.deepEqual(numeric, ["0", "0", "0"]);
  assert.deepEqual(alpha, ["A", "A", "A", "A", "A"]);
  assert.equal(isValidDialCode(CABINET_DIAL_CODE, "numeric"), true);
  assert.equal(isValidDialCode(BALCONY_DIAL_WORD, "alpha"), true);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    assert.equal(dialCodeMatches("000", CABINET_DIAL_CODE), false);
  }
  assert.equal(dialCodeMatches(CABINET_DIAL_CODE, CABINET_DIAL_CODE), true);
  assert.equal(dialCodeMatches("loser", BALCONY_DIAL_WORD), true);
  assert.deepEqual(
    rotateDialAt(alpha, 0, -1, ALPHA_DIAL_SYMBOLS),
    ["Z", "A", "A", "A", "A"],
  );
});
