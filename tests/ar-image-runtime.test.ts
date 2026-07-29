import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AR_FRAME_INTERVAL_MS } from "../src/ar/config";
import {
  startCappedMindArProcessing,
  type MindArFrameHost,
} from "../src/ar/mindarFrameLoop";

import type {
  Controller,
  MindArControllerUpdate,
} from "mind-ar/dist/mindar-image.prod.js";

const runtimeSource = readFileSync(
  new URL("../src/ar/imageRuntime.ts", import.meta.url),
  "utf8",
);
const declarationSource = readFileSync(
  new URL("../src/ar/mindar.d.ts", import.meta.url),
  "utf8",
);
const frameLoopSource = readFileSync(
  new URL("../src/ar/mindarFrameLoop.ts", import.meta.url),
  "utf8",
);

test("image tracking uses only the compiled controller and embedded assets", () => {
  assert.match(
    runtimeSource,
    /import \{ Controller \} from "mind-ar\/dist\/mindar-image\.prod\.js"/,
  );
  assert.match(runtimeSource, /targetDatabaseBuffer\(\)/);
  assert.match(runtimeSource, /AR_SHEET_ASSETS\[sceneDefinition\.targetId\]/);
  assert.match(runtimeSource, /addImageTargetsFromBuffer\(targetDatabaseBuffer\(\)\)/);
  assert.match(runtimeSource, /startCappedMindArProcessing\(/);
  assert.doesNotMatch(runtimeSource, /controller\.processVideo\(/);
  assert.doesNotMatch(
    runtimeSource,
    /\bfetch\s*\(|getUserMedia|srcObject|getTracks\s*\(|track\.stop\s*\(|TextureLoader|MindARThree|imageTargetSrc|addImageTargets\s*\(|XMLHttpRequest|WebSocket|EventSource|https?:\/\//,
  );
});

test("placeholder and malformed targets use typed fallback errors", () => {
  assert.match(runtimeSource, /class ImageArFallbackError extends Error/);
  assert.match(runtimeSource, /AR_TARGET_DATABASE\.placeholder/);
  assert.match(runtimeSource, /"placeholder-target-database"/);
  assert.match(runtimeSource, /"invalid-target-database"/);
  assert.match(runtimeSource, /targetDimensions\.length !== TARGET_DATABASE_SIZE/);
  assert.match(runtimeSource, /options\.onFallback\?\.\(error, sceneDefinition\)/);
});

test("the app-owned video and MindAR target matrix keep exact conventions", () => {
  assert.match(runtimeSource, /video\.width = video\.videoWidth/);
  assert.match(runtimeSource, /video\.height = video\.videoHeight/);
  assert.match(runtimeSource, /maxTrack: 1/);
  assert.match(
    runtimeSource,
    /controller\.interestedTargetIndex = sceneDefinition\.targetIndex/,
  );
  assert.match(
    runtimeSource,
    /new Vector3\(targetWidth \/ 2, targetHeight \/ 2, 0\)/,
  );
  assert.match(
    runtimeSource,
    /new Vector3\(targetWidth, targetWidth, targetWidth\)/,
  );
  assert.match(runtimeSource, /rawTargetMatrix\.fromArray\(update\.worldMatrix\)/);
  assert.match(
    runtimeSource,
    /visual\.root\.matrix\.copy\(rawTargetMatrix\)\.multiply\(normalizationMatrix\)/,
  );
});

test("paper and overlays decode locally without a loader", () => {
  assert.match(runtimeSource, /const image: HTMLImageElement = document\.createElement\("img"\)/);
  assert.match(runtimeSource, /dataUri\.startsWith\("data:image\/"\)/);
  assert.match(runtimeSource, /const texture = new Texture\(image\)/);
  assert.match(runtimeSource, /new PlaneGeometry\(1, aspect\)/);
  assert.match(runtimeSource, /new MeshBasicMaterial\(/);
  assert.doesNotMatch(runtimeSource, /Loader\s*\(|\.load\s*\(/);
});

test("sheet 01 peels and reaches while sheet 02 pulses and lifts", () => {
  for (const uniform of ["uPeel", "uReach", "uOpacity", "uDisplacement"]) {
    assert.match(runtimeSource, new RegExp(uniform));
  }
  assert.match(runtimeSource, /shoulderMask[\s\S]*uv\.y/);
  assert.match(runtimeSource, /new ShaderMaterial\(/);
  assert.match(runtimeSource, /overlayPivot\.scale\.setScalar\(scale\)/);
  assert.match(runtimeSource, /overlayPivot\.rotation\.x = -reachProgress/);
  assert.match(runtimeSource, /const pulse = Math\.sin/);
  assert.match(runtimeSource, /position\.y = easedProgress \* effects\.ar\.herbLiftMeters/);
  assert.match(runtimeSource, /material\.opacity = easedProgress/);
  for (const token of [
    "wallPeelScale",
    "wallReachScale",
    "wallShoulderDegrees",
    "wallUvDisplacement",
    "herbPulseScale",
    "herbLiftMeters",
  ]) {
    assert.match(runtimeSource, new RegExp(`effects\\.ar\\.${token}`));
  }
  assert.doesNotMatch(runtimeSource, /stagedProgress|IMAGE_SEQUENCE_DURATION_MS/);
  assert.doesNotMatch(runtimeSource, /spring|bounce/i);
});

test("rendering and image processing are both gated to 30fps", () => {
  assert.match(runtimeSource, /isArFrameDue\(timestampMs, lastRenderAtMs\)/);
  assert.match(runtimeSource, /window\.requestAnimationFrame\(renderFrame\)/);
  assert.match(runtimeSource, /window\.cancelAnimationFrame\(animationFrame\)/);
  assert.match(runtimeSource, /effects\.ar\.renderPixelRatioMax/);
  assert.match(frameLoopSource, /isArFrameDue\(timestampMs, lastFrameStartedAtMs\)/);
  assert.match(frameLoopSource, /frameHost\.requestFrame\(runScheduledFrame\)/);
  assert.match(frameLoopSource, /await controller\._detectAndMatch/);
  assert.match(frameLoopSource, /await controller\._trackAndUpdate/);
  assert.match(frameLoopSource, /processFrame\(\)\.then/);
  assert.doesNotMatch(frameLoopSource, /controller\.processVideo\(/);
  assert.doesNotMatch(frameLoopSource, /setInterval|setTimeout/);
  assert.doesNotMatch(runtimeSource, /MAX_PIXEL_RATIO/);
  assert.doesNotMatch(
    runtimeSource,
    /(?:Ambient|Directional|Hemisphere|Point|RectArea|Spot)Light|shadowMap|EffectComposer|postprocessing|GLTFLoader|FBXLoader|OBJLoader/,
  );
});

test("found, lost, and completion callbacks have guarded lifecycle state", () => {
  assert.match(runtimeSource, /if \(!targetVisible\)[\s\S]*options\.onFound/);
  assert.match(runtimeSource, /options\.onLost\?\.\(sceneDefinition\)/);
  assert.match(runtimeSource, /if \(targetVisible && !completeNotified\)/);
  assert.match(runtimeSource, /completeNotified = true/);
  assert.match(runtimeSource, /options\.onComplete\?\.\(sceneDefinition\)/);
});

test("cleanup releases only owned AR resources and never camera media", () => {
  assert.match(runtimeSource, /window\.removeEventListener\("resize", resize\)/);
  assert.match(runtimeSource, /ownedTrackingLoop\.stop\(\)/);
  assert.match(runtimeSource, /ownedController\.stopProcessVideo\(\)/);
  assert.match(runtimeSource, /ownedController\.dispose\(\)/);
  assert.match(runtimeSource, /paperGeometry\.dispose\(\)/);
  assert.match(runtimeSource, /overlayMaterial\.dispose\(\)/);
  assert.match(runtimeSource, /paperTexture\.dispose\(\)/);
  assert.match(runtimeSource, /for \(const texture of ownedTextures\)/);
  assert.match(runtimeSource, /ownedRenderer\.dispose\(\)/);
  assert.match(runtimeSource, /ownedRenderer\.domElement\.remove\(\)/);
  assert.match(runtimeSource, /originalVideoWidthAttribute/);
  assert.doesNotMatch(
    runtimeSource,
    /video\.pause\s*\(|video\.remove\s*\(|srcObject|getTracks\s*\(|track\.stop\s*\(/,
  );
});

test("the narrow declaration exposes only controller APIs used by the runtime", () => {
  assert.match(
    declarationSource,
    /declare module "mind-ar\/dist\/mindar-image\.prod\.js"/,
  );
  assert.match(declarationSource, /class Controller/);
  assert.match(declarationSource, /addImageTargetsFromBuffer/);
  assert.match(declarationSource, /dummyRun/);
  assert.doesNotMatch(declarationSource, /\bprocessVideo\s*\(/);
  assert.match(declarationSource, /stopProcessVideo/);
  assert.match(declarationSource, /getProjectionMatrix/);
  assert.match(declarationSource, /dispose/);
  assert.doesNotMatch(declarationSource, /MindARThree|addImageTargets\s*\(/);
});

test("runtime source adds no private colors or remote assets", () => {
  assert.doesNotMatch(runtimeSource, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(runtimeSource, /https?:\/\//i);
  assert.match(runtimeSource, /motion\.eventMs\.arImageReveal/);
  assert.match(runtimeSource, /motion\.eventMs\.arHerbReward/);
  assert.match(runtimeSource, /layout\.spacingPx\.none/);
});
interface FakeControllerStats {
  loaded: number;
  disposed: number;
  detected: number;
  tracked: number;
  stopped: number;
  readonly updates: MindArControllerUpdate[];
}

interface DetectionResult {
  readonly targetIndex: number;
  readonly modelViewTransform: number[][];
}

class ManualFrameHost implements MindArFrameHost {
  private nextHandle = 1;
  private readonly frames = new Map<number, FrameRequestCallback>();

  get pendingCount(): number {
    return this.frames.size;
  }

  requestFrame(callback: FrameRequestCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.frames.set(handle, callback);
    return handle;
  }

  cancelFrame(handle: number): void {
    this.frames.delete(handle);
  }

  fireNext(timestampMs: number): void {
    const first = this.frames.entries().next().value;
    assert.ok(first, "a frame is scheduled");
    const [handle, callback] = first;
    this.frames.delete(handle);
    callback(timestampMs);
  }
}

function createControllerFixture(
  detect: (targetIndexes: number[]) => Promise<DetectionResult> = async () => ({
    targetIndex: 0,
    modelViewTransform: [[1]],
  }),
): {
  readonly controller: Controller;
  readonly input: HTMLVideoElement;
  readonly stats: FakeControllerStats;
} {
  const stats: FakeControllerStats = {
    loaded: 0,
    disposed: 0,
    detected: 0,
    tracked: 0,
    stopped: 0,
    updates: [],
  };
  const controller = {
    inputWidth: 640,
    inputHeight: 480,
    maxTrack: 1,
    warmupTolerance: 0,
    missTolerance: 0,
    filterMinCF: 0.001,
    filterBeta: 1000,
    interestedTargetIndex: -1,
    processingVideo: false,
    markerDimensions: [[1, 1]],
    trackingStates: [],
    inputLoader: {
      loadInput: (_input: HTMLVideoElement) => {
        stats.loaded += 1;
        return {
          dispose: () => {
            stats.disposed += 1;
          },
        };
      },
    },
    onUpdate: (update: MindArControllerUpdate) => {
      stats.updates.push(update);
    },
    _detectAndMatch: async (_input: unknown, targetIndexes: number[]) => {
      stats.detected += 1;
      return detect(targetIndexes);
    },
    _trackAndUpdate: async () => {
      stats.tracked += 1;
      return [[1]];
    },
    _glModelViewMatrix: () => Array.from({ length: 16 }, (_, index) => index),
    getRotatedZ90Matrix: (matrix: number[]) => matrix,
    stopProcessVideo: () => {
      stats.stopped += 1;
      controller.processingVideo = false;
    },
  } as unknown as Controller;

  return {
    controller,
    input: { width: 640, height: 480 } as HTMLVideoElement,
    stats,
  };
}

async function settleProcessing(): Promise<void> {
  for (let turn = 0; turn < 12; turn += 1) {
    await Promise.resolve();
  }
}

test("MindAR detection and tracking passes are capped to the AR frame interval", async () => {
  const host = new ManualFrameHost();
  const fixture = createControllerFixture();
  const loop = startCappedMindArProcessing({
    controller: fixture.controller,
    input: fixture.input,
    frameHost: host,
  });

  host.fireNext(0);
  await settleProcessing();
  assert.equal(fixture.stats.loaded, 1);
  assert.equal(fixture.stats.detected, 1);
  assert.equal(fixture.stats.tracked, 1);
  assert.equal(fixture.stats.disposed, 1);
  assert.deepEqual(
    fixture.stats.updates.map((update) => update.type),
    ["updateMatrix", "processDone"],
  );

  host.fireNext(AR_FRAME_INTERVAL_MS - 0.1);
  assert.equal(fixture.stats.loaded, 1, "an early frame performs no ML work");
  host.fireNext(AR_FRAME_INTERVAL_MS);
  await settleProcessing();
  assert.equal(fixture.stats.loaded, 2);
  assert.equal(fixture.stats.disposed, 2);

  loop.stop();
  assert.equal(loop.running, false);
  assert.equal(fixture.controller.processingVideo, false);
  assert.equal(host.pendingCount, 0);
  assert.equal(fixture.stats.stopped, 1);
});

test("MindAR processing never overlaps an unfinished detector pass", async () => {
  const detectionGate: {
    resolve?: (result: DetectionResult) => void;
  } = {};
  const pendingDetection = new Promise<DetectionResult>((resolve) => {
    detectionGate.resolve = resolve;
  });
  const host = new ManualFrameHost();
  const fixture = createControllerFixture(() => pendingDetection);
  const loop = startCappedMindArProcessing({
    controller: fixture.controller,
    input: fixture.input,
    frameHost: host,
  });

  host.fireNext(0);
  assert.equal(fixture.stats.detected, 1);
  assert.equal(host.pendingCount, 0, "no next frame exists while detection awaits");

  const releaseDetection = detectionGate.resolve;
  assert.ok(releaseDetection, "the detector gate is initialized");
  releaseDetection({ targetIndex: 0, modelViewTransform: [[1]] });
  await settleProcessing();
  assert.equal(fixture.stats.disposed, 1);
  assert.equal(host.pendingCount, 1);
  loop.stop();
});

test("MindAR processing failures dispose tensors and notify once", async () => {
  const failure = new Error("detector failed");
  const host = new ManualFrameHost();
  const fixture = createControllerFixture(async () => {
    throw failure;
  });
  const errors: unknown[] = [];
  const loop = startCappedMindArProcessing({
    controller: fixture.controller,
    input: fixture.input,
    frameHost: host,
    onError: (error) => errors.push(error),
  });

  host.fireNext(0);
  await settleProcessing();
  assert.deepEqual(errors, [failure]);
  assert.equal(fixture.stats.disposed, 1);
  assert.equal(loop.running, false);
  assert.equal(fixture.controller.processingVideo, false);
  assert.equal(host.pendingCount, 0);
});

test("the runtime never starts MindAR's native self-paced processing loop", () => {
  assert.match(runtimeSource, /startCappedMindArProcessing\s*\(\s*\{/);
  assert.match(frameLoopSource, /isArFrameDue\(timestampMs, lastFrameStartedAtMs\)/);
  assert.doesNotMatch(runtimeSource, /\.processVideo\s*\(/);
  assert.doesNotMatch(frameLoopSource, /\.processVideo\s*\(|tf\.nextFrame/);
});
