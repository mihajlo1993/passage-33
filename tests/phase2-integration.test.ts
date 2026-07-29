import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  Phase2IntegrationCoordinator,
  canResolveRoomAr,
  phase2ArRouteForPin,
  phase2HealthProfile,
} from "../src/game/phase2Integration";
import {
  attemptResolvePin,
  createDefaultGameState,
  resolutionModeForPin,
} from "../src/game/engine";
import { itemIds } from "../src/items";
import { deriveSurveyMap } from "../src/map/model";
import { pins } from "../src/pins";
import type { GameState, ZoneId } from "../src/types";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");
const compact = (value: string) => value.replace(/\s+/g, " ");

const GAMEPLAY_ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 22, 21, 23, 24, 25, 26, 27,
] as const;

test("Phase 2 coordinator walks every pin with state-driven effect spies", () => {
  let activePin: number | null = null;
  const tagged = <T>(value: T) => ({ pin: activePin, value });
  const trace = {
    zones: [] as Array<{ pin: number | null; value: ZoneId }>,
    ambient: [] as Array<{ pin: number | null; value: string | null }>,
    audio: [] as Array<{ pin: number | null; value: string }>,
    voice: [] as Array<{ pin: number | null; value: string }>,
    audioHeartbeat: [] as boolean[],
    intensity: [] as number[],
    timecode: [] as Array<string | null>,
    glitches: [] as Array<{ pin: number | null; value: number }>,
    drops: [] as number[],
    contacts: [] as Array<number | null>,
    found: [] as Array<number | null>,
    stutters: [] as Array<number | null>,
    hapticHeartbeat: [] as boolean[],
    wake: [] as string[],
    torch: [] as Array<{ pin: number | null; value: string }>,
  };

  const coordinator = new Phase2IntegrationCoordinator({
    audio: {
      setZone: (zone) => trace.zones.push(tagged(zone)),
      ambient: (id) => trace.ambient.push(tagged(id)),
      play: (id) => {
        trace.audio.push(tagged(id));
      },
      say: (id) => {
        trace.voice.push(tagged(id));
      },
      heartbeat: (enabled) => trace.audioHeartbeat.push(enabled),
    },
    vhs: {
      setIntensity: (intensity) => trace.intensity.push(intensity),
      setTimecode: (timecode) => trace.timecode.push(timecode),
      glitch: (duration) => trace.glitches.push(tagged(duration)),
      dropFrames: (duration) => trace.drops.push(duration),
    },
    haptics: {
      contact: () => trace.contacts.push(activePin),
      found: () => trace.found.push(activePin),
      stutter: () => trace.stutters.push(activePin),
      heartbeat: (enabled) => trace.hapticHeartbeat.push(enabled),
    },
    wakeLock: {
      acquire: () => {
        trace.wake.push("acquire");
      },
      release: () => {
        trace.wake.push("release");
      },
    },
    torch: {
      on: () => {
        trace.torch.push(tagged("on"));
      },
      off: () => {
        trace.torch.push(tagged("off"));
      },
    },
  });

  coordinator.startSession();
  let state: GameState = createDefaultGameState(1_000);
  coordinator.syncZoneFromResolvedPins(state.resolvedPins);

  const visited: number[] = [];
  const zoneClearPins: Partial<Record<ZoneId, number>> = {};

  for (const pinId of GAMEPLAY_ORDER) {
    const pin = pins.find((candidate) => candidate.id === pinId);
    assert.ok(pin, `pin ${pinId} exists`);
    activePin = pinId;

    if (pinId === 8) {
      coordinator.handleDialAttempt(false);
    }

    if (pinId === 15) {
      coordinator.enterFieldDesk();
    }

    if (pinId === 16) {
      const missingKnowledge: GameState = {
        ...state,
        inventory: state.inventory.filter((id) => id !== itemIds.knowLoser),
      };
      const gateRefusal = attemptResolvePin(
        missingKnowledge,
        pin,
        2_000 + pinId,
        "dial",
      );
      assert.equal(gateRefusal.ok, false);
      coordinator.handleResolution(gateRefusal);
    }

    if (pinId === 18) {
      assert.equal(canResolveRoomAr(state, false), false);
      assert.equal(canResolveRoomAr(
        { inventory: state.inventory.filter((id) => id !== itemIds.pistol) },
        true,
      ), false);
      assert.equal(canResolveRoomAr(state, true), true);

      const noPistol: GameState = {
        ...state,
        inventory: state.inventory.filter((id) => id !== itemIds.pistol),
      };
      const refused = attemptResolvePin(noPistol, pin, 2_018, "ar");
      assert.equal(refused.ok, false);
      assert.equal(refused.reason, "missing-requirements");
    }

    const beforeMap = deriveSurveyMap(state);
    const result = attemptResolvePin(
      state,
      pin,
      3_000 + pinId,
      resolutionModeForPin(pin),
    );
    if (!result.ok) {
      assert.fail(`pin ${pinId} was refused: ${result.reason}`);
    }

    coordinator.handleResolution(result);
    state = result.state;
    coordinator.syncHealth(state.health);
    visited.push(pinId);

    const afterMap = deriveSurveyMap(state);
    const unresolvedInZone = pins.filter(
      (candidate) =>
        candidate.zone === pin.zone
        && !state.resolvedPins.includes(candidate.id),
    );
    if (unresolvedInZone.length === 0) {
      const beforeRoom = beforeMap.rooms.find((room) => room.id === pin.zone);
      const afterRoom = afterMap.rooms.find((room) => room.id === pin.zone);
      assert.notEqual(beforeRoom?.status, "cleared");
      assert.equal(afterRoom?.status, "cleared");
      zoneClearPins[pin.zone] = pinId;
    }

    if (result.saveTriggered) coordinator.handleSaveWritten();
    if (pinId === 15) coordinator.leaveFieldDesk();

    if (pinId === 15) {
      assert.equal(
        afterMap.rooms.find((room) => room.id === "balcony")?.outlineLocked,
        true,
      );
    }
    if (pinId === 16) {
      assert.equal(
        afterMap.rooms.find((room) => room.id === "balcony")?.outlineLocked,
        false,
      );
    }
  }

  assert.deepEqual(visited, [...GAMEPLAY_ORDER]);
  assert.deepEqual([...visited].sort((a, b) => a - b), Array.from({ length: 27 }, (_, index) => index + 1));
  assert.deepEqual(zoneClearPins, {
    corridor: 27,
    bathroom: 8,
    entry: 11,
    living: 18,
    balcony: 17,
    kitchen: 26,
  });

  assert.deepEqual(
    trace.zones.map(({ value }) => value),
    ["corridor", "bathroom", "entry", "living", "balcony", "living", "kitchen", "corridor"],
  );
  assert.deepEqual(
    trace.ambient.map(({ value }) => value),
    trace.zones.map(({ value }) => "ambient-" + value),
  );

  for (const pinId of GAMEPLAY_ORDER) {
    assert.ok(
      trace.audio.some((event) => event.pin === pinId && event.value === "ui-contact"),
      `pin ${pinId} emits its resolved cue`,
    );
    assert.ok(
      trace.voice.some(
        (event) =>
          event.pin === pinId
          && event.value === "voice-pin-" + String(pinId).padStart(2, "0"),
      ),
      `pin ${pinId} emits its Host voice id`,
    );
  }

  for (const pin of pins.filter((candidate) => candidate.grants.length > 0)) {
    assert.ok(
      trace.audio.some((event) => event.pin === pin.id && event.value === "ui-found"),
      `pin ${pin.id} emits item-granted audio`,
    );
    assert.ok(trace.found.includes(pin.id), `pin ${pin.id} emits found haptics`);
  }

  assert.ok(trace.audio.some((event) => event.pin === 16 && event.value === "ui-refused"));
  assert.ok(trace.audio.some((event) => event.pin === 8 && event.value === "ui-refused"));
  assert.ok(trace.audio.some((event) => event.pin === 8 && event.value === "ui-found"));
  assert.ok(trace.audio.some((event) => event.pin === 16 && event.value === "ui-found"));
  assert.deepEqual(
    trace.audio.filter((event) => event.value === "save-deck").map(({ pin }) => pin),
    [2, 8],
  );

  assert.deepEqual(trace.glitches.map(({ pin }) => pin), [9, 18, 22]);
  assert.deepEqual(trace.contacts, [9, 18, 22]);
  assert.deepEqual(trace.stutters, [9]);
  assert.deepEqual(trace.torch, [
    { pin: 15, value: "on" },
    { pin: 15, value: "off" },
  ]);

  assert.equal(phase2ArRouteForPin(3), "image");
  assert.equal(phase2ArRouteForPin(17), "image");
  assert.equal(phase2ArRouteForPin(18), "room");
  assert.equal(phase2ArRouteForPin(2), null);

  trace.intensity.length = 0;
  trace.timecode.length = 0;
  trace.drops.length = 0;
  trace.audioHeartbeat.length = 0;
  trace.hapticHeartbeat.length = 0;

  for (const health of [100, 60, 40, 19, 40]) {
    coordinator.syncHealth(health);
  }

  assert.deepEqual(trace.intensity, [0.15, 0.35, 0.6, 0.85, 0.6]);
  assert.deepEqual(trace.timecode, [null, null, "REC --:--:--", "REC --:--:--", "REC --:--:--"]);
  assert.equal(trace.drops.length, 1);
  assert.deepEqual(trace.audioHeartbeat, [true, false]);
  assert.deepEqual(trace.hapticHeartbeat, [true, false]);

  coordinator.stopSession();
  assert.deepEqual(trace.wake, ["acquire", "release"]);
});

test("health anchors and critical flags preserve the exact Phase 2 contract", () => {
  assert.deepEqual(phase2HealthProfile(100), {
    health: 100,
    intensity: 0.15,
    unstableTimecode: false,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(60), {
    health: 60,
    intensity: 0.35,
    unstableTimecode: false,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(40), {
    health: 40,
    intensity: 0.6,
    unstableTimecode: true,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(19), {
    health: 19,
    intensity: 0.85,
    unstableTimecode: true,
    periodicDropFrames: true,
  });
});

test("production source mounts and drives every Phase 2 integration surface", () => {
  const main = compact(source("src/main.tsx"));
  const app = compact(source("src/components/GameApp.tsx"));
  const director = compact(source("src/audio/AudioDirector.tsx"));
  const engine = compact(source("src/audio/engine.ts"));
  const mapScreen = compact(source("src/components/MapScreen.tsx"));
  const mapModel = compact(source("src/map/model.ts"));
  const scanner = compact(source("src/components/ScanScreen.tsx"));
  const dial = compact(source("src/components/DialLockScreen.tsx"));
  const save = compact(source("src/components/SaveScreen.tsx"));
  const arScreen = compact(source("src/ar/ARScreen.tsx"));
  const imageAr = compact(source("src/ar/ImageARScreen.tsx"));
  const room = compact(source("src/ar/RoomARScreen.tsx"));
  const fieldDesk = compact(source("src/components/FieldDeskTorch.tsx"));
  const pinSource = compact(source("src/pins.ts"));

  const vhsStart = main.indexOf("<VHSLayer");
  const appMount = main.indexOf("<GameApp", vhsStart);
  const vhsEnd = main.indexOf("</VHSLayer>", appMount);
  assert.ok(vhsStart >= 0 && appMount > vhsStart && vhsEnd > appMount);

  assert.match(app, /getVHSHealthProfile\(store\.health\)/);
  assert.match(app, /profile\.unstableTimecode/);
  assert.match(app, /profile\.periodicDropFrames/);
  assert.match(app, /window\.setInterval/);
  assert.match(app, /resolution\?\.ok && resolution\.damage > 0/);

  assert.match(director, /Phase2IntegrationCoordinator/);
  assert.match(director, /coordinator\.syncZoneFromResolvedPins\(resolvedPins\)/);
  assert.match(director, /coordinator\.syncHealth\(health\)/);
  assert.doesNotMatch(director, /health < 20/);
  assert.match(engine, /crossfadeImpulse\(/);

  assert.match(scanner, /presentAttempt\(preview, true\)/);
  assert.doesNotMatch(scanner, /\bcontact\(\)|\bfound\(\)|\bstutter\(\)/);
  assert.match(dial, /audio\.play\(phase2DialAudioCue\(false\)\)/);
  assert.match(save, /onCommit\(\) \.then\(\(\) => audio\.play\(SAVE_WRITTEN_AUDIO_CUE\)\)/);

  assert.match(mapScreen, /<SurveyMap state=\{state\}/);
  assert.match(mapModel, /const cleared = new Set\(state\.clearedZones\)/);
  assert.match(mapModel, /state\.resolvedPins\.includes\(BALCONY_UNLOCK_PIN\)/);

  assert.match(scanner, /pinId === 3 \|\| pinId === 17 \|\| pinId === 18/);
  assert.match(scanner, /navigate\("\/ar\?pin=" \+ String\(pinId\)\)/);
  assert.match(pinSource, /id: 18,[\s\S]*requires: \[itemIds\.pistol\][\s\S]*resolution: 'ar'/);
  assert.match(room, /shotFiredRef\.current = true;[\s\S]*onResolved\(\)/);

  assert.match(arScreen, /subscribeToOperatorScareSkip/);
  assert.match(arScreen, /if \(resolve\(\)\) leave\(\)/);
  assert.match(imageAr, /reportOperatorArInitialization\("not-started"\)/);
  assert.match(imageAr, /reportOperatorArInitialization\("ready"\)/);
  assert.match(imageAr, /reportOperatorArInitialization\("error"\)/);
  assert.match(room, /reportOperatorArInitialization\("not-started"\)/);
  assert.match(room, /reportOperatorArInitialization\("ready"\)/);
  assert.match(room, /reportOperatorArInitialization\("error"\)/);

  assert.match(app, /useWakeLock\(\)/);
  assert.match(fieldDesk, /camera\.status === "ready" && torch\.supported && !torch\.enabled/);
  assert.match(fieldDesk, /void torch\.on\(\)/);
  assert.match(fieldDesk, /latestOff\.current\(\)\.finally\(camera\.stop\)/);
});
