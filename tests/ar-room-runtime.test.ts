import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RoomXrRuntimeError,
  billboardYawRadians,
  createRoomXrRuntime,
  isLocalCreatureWebpUrl,
  isHorizontalFloorHitMatrix,
  roomCollapseProgress,
} from "../src/ar/roomRuntime";
import { motion } from "../src/tokens";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("room billboard yaw faces the viewer and never pitches", () => {
  assert.equal(billboardYawRadians(0, -2, 0, 0), 0);
  assert.equal(billboardYawRadians(0, 0, 1, 0), Math.PI / 2);
  assert.equal(billboardYawRadians(0, 0, -1, 0), -Math.PI / 2);
  assert.equal(billboardYawRadians(1, 1, 1, 1), 0);
});

test("room placement accepts horizontal floor poses and rejects walls", () => {
  const floor = new Float32Array(16);
  floor[5] = 1;
  assert.equal(isHorizontalFloorHitMatrix(floor), true);

  const invertedFloor = new Float32Array(16);
  invertedFloor[5] = -1;
  assert.equal(isHorizontalFloorHitMatrix(invertedFloor), true);

  const wall = new Float32Array(16);
  wall[5] = 0;
  assert.equal(isHorizontalFloorHitMatrix(wall), false);
  assert.equal(isHorizontalFloorHitMatrix([]), false);
});

test("room collapse duration comes from tokens and clamps in place", () => {
  const duration = motion.eventMs.arCollapseDuration;
  assert.equal(roomCollapseProgress(Number.NaN), 0);
  assert.equal(roomCollapseProgress(-1), 0);
  assert.equal(roomCollapseProgress(0), 0);
  assert.equal(roomCollapseProgress(duration / 2), 0.5);
  assert.equal(roomCollapseProgress(duration), 1);
  assert.equal(roomCollapseProgress(duration * 4), 1);
});

test("only the bundled local WebP creature URL is accepted", () => {
  assert.equal(isLocalCreatureWebpUrl("/ar/textures/creature.webp"), true);
  assert.equal(isLocalCreatureWebpUrl("/ar/textures/other.webp"), false);
  assert.equal(isLocalCreatureWebpUrl("data:image/webp;base64,AAAA"), false);
  assert.equal(isLocalCreatureWebpUrl("https://example.invalid/monster.webp"), false);
});

test("room runtime is offline, shares no camera API, and requests exact XR features", () => {
  const runtime = source("../src/ar/roomRuntime.ts");

  assert.doesNotMatch(
    runtime,
    /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|TextureLoader|getUserMedia|getDisplayMedia|getTracks|MediaStreamTrack|\.stop\s*\(/,
  );
  assert.match(runtime, /AR_CREATURE_ASSET\.url/);
  assert.match(runtime, /new Image\(\)/);
  assert.match(runtime, /new THREE\.Texture\(image\)/);
  assert.match(runtime, /requestSession\(\s*WEBXR_SESSION_MODE/);
  assert.match(runtime, /createRoomWebXrSessionInit\(options\.overlayRoot\)/);
  assert.match(runtime, /setReferenceSpaceType\("local"\)/);
  assert.match(runtime, /requestReferenceSpace\("viewer"\)/);
  assert.match(runtime, /requestHitTestSource/);
  assert.match(runtime, /entityTypes: \["plane"\]/);
  assert.match(runtime, /getHitTestResults\(hitTestSource\)\.find/);
  assert.match(runtime, /isHorizontalFloorHitMatrix\(pose\.transform\.matrix\)/);
});

test("room runtime caps rendering and owns complete idempotent teardown", () => {
  const runtime = source("../src/ar/roomRuntime.ts");

  assert.match(runtime, /effects\.ar\.renderPixelRatioMax/);
  assert.match(runtime, /isArFrameDue\(timestampMs, lastXrTimestampMs\)/);
  assert.match(runtime, /renderer\?\.setAnimationLoop\(null\)/);
  assert.match(runtime, /hitTestSource\.cancel\(\)/);
  assert.match(runtime, /await activeSession\.end\(\)/);
  assert.match(runtime, /creatureGeometry\?\.dispose\(\)/);
  assert.match(runtime, /creatureMaterial\?\.dispose\(\)/);
  assert.match(runtime, /creatureTexture\?\.dispose\(\)/);
  assert.match(runtime, /renderer\.dispose\(\)/);
  assert.match(runtime, /renderer\.forceContextLoss\(\)/);
  assert.match(runtime, /canvas\.remove\(\)/);
  assert.match(
    runtime,
    /pendingStart\.catch\(\(\) => undefined\)\.finally\(releaseGraphics\)/,
  );
  assert.ok((runtime.match(/assertStartupActive\(/g) ?? []).length >= 6);
  assert.match(runtime, /acquiredHitTestSource\.cancel\(\)/);
  assert.match(runtime, /decodedTexture\.dispose\(\)/);
});

test("dispose waits for a pending immersive request and ends its late session", async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const gate: { resolve?: (session: XRSession) => void } = {};
  let endCalls = 0;
  let requestCalls = 0;

  const request = new Promise<XRSession>((resolve) => {
    gate.resolve = resolve;
  });
  const lateSession = {
    end: async () => {
      endCalls += 1;
    },
    addEventListener() {},
    removeEventListener() {},
  } as unknown as XRSession;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      xr: {
        requestSession() {
          requestCalls += 1;
          return request;
        },
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      removeEventListener() {},
    },
  });

  try {
    const reportedErrors: RoomXrRuntimeError[] = [];
    const runtime = createRoomXrRuntime({
      mount: {
        clientWidth: 390,
        clientHeight: 844,
        append() {},
      } as unknown as HTMLElement,
      overlayRoot: {} as Element,
      onError(error) {
        reportedErrors.push(error);
      },
    });

    const startResult = runtime.start().then(
      () => null,
      (error: unknown) => error,
    );
    const disposal = runtime.dispose();
    let disposalSettled = false;
    void disposal.then(() => {
      disposalSettled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(requestCalls, 1);
    assert.equal(disposalSettled, false);

    const resolveRequest = gate.resolve;
    assert.ok(resolveRequest);
    resolveRequest(lateSession);

    const startError = await startResult;
    await disposal;

    assert.ok(startError instanceof RoomXrRuntimeError);
    assert.equal(startError.code, "runtime-failed");
    assert.equal(endCalls, 1);
    assert.equal(runtime.phase, "disposed");
    assert.deepEqual(reportedErrors, []);
  } finally {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
