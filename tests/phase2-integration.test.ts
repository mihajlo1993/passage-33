import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PHASE2_VOICE_CUES_BY_PIN,
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
import type { GameState, HostVoiceId, ZoneId } from "../src/types";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");
const compact = (value: string) => value.replace(/\s+/g, " ");

const GAMEPLAY_ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 22, 21, 23, 24, 25, 26, 27, 28,
] as const;




test("the coordinator walks all nine pins without engine voices", () => {
  const plays: string[] = [];
  const voices: HostVoiceId[] = [];
  const coordinator = new Phase2IntegrationCoordinator({
    audio: {
      setZone: () => undefined,
      play: (id) => { plays.push(id); },
      startVoice: async (id) => { voices.push(id); return null; },
      heartbeat: () => undefined,
    },
    voices: { claim: () => true },
  });
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    const result = attemptResolvePin(state, pin, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(result.ok, true, `pin ${pin.id}`);
    state = result.state;
    coordinator.handleResolution(result);
  }
  assert.equal(voices.length, 0, "the Keeper speaks outside the engine");
  assert.ok(plays.filter((id) => id === "found").length >= 4);
  coordinator.stopSession();
});

test("the engine voice map is empty by design", () => {
  assert.equal(Object.keys(PHASE2_VOICE_CUES_BY_PIN).length, 0);
});

test("health anchors and critical flags preserve the exact Phase 2 contract", () => {
  assert.deepEqual(phase2HealthProfile(100), {
    health: 100,
    intensity: 0.05,
    unstableTimecode: false,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(60), {
    health: 60,
    intensity: 0.14,
    unstableTimecode: false,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(40), {
    health: 40,
    intensity: 0.3,
    unstableTimecode: true,
    periodicDropFrames: false,
  });
  assert.deepEqual(phase2HealthProfile(19), {
    health: 19,
    intensity: 0.5,
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
  const home = compact(source("src/components/HomeScreen.tsx"));
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

  assert.match(app, /new Phase2IntegrationCoordinator/);
  assert.match(app, /coordinator\.syncZoneFromResolvedPins\(store\.resolvedPins\)/);
  assert.match(app, /coordinator\.syncHealth\(store\.health\)/);
  assert.match(app, /coordinator\.handleResolution\(resolution\)/);
  assert.doesNotMatch(director, /useGameStore/);
  assert.doesNotMatch(director, /\.play\(|\.say\(|VOICE_CUES/);
  assert.doesNotMatch(director, /health < 20/);
  assert.match(engine, /crossfadeImpulse\(/);

  assert.match(home, /previewPin\(pin\.id, resolutionModeForPin\(pin\)\)/);
  assert.doesNotMatch(scanner, /\bcontact\(\)|\bfound\(\)|\bstutter\(\)/);

  assert.match(mapScreen, /<SurveyScroller state=\{state\}/);
  assert.match(mapModel, /const cleared = new Set\(state\.clearedZones\)/);
  assert.match(mapModel, /state\.resolvedPins\.includes\(BALCONY_UNLOCK_PIN\)/);
  assert.match(pinSource, /id: 7,[\s\S]*beat: 'threshold'/);

  assert.match(app, /useWakeLock\(\)/);
});
