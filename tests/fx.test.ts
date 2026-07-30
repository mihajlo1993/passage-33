import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { effects } from "../src/tokens";
import {
  VHS_FRAME_INTERVAL_MS,
  clampVHSIntensity,
  getVHSHealthProfile,
  getVHSRenderProfile,
  isVHSFrameDue,
  randomIntegerInclusive,
  sampleVHSFrameGeometry,
} from "../src/fx/model";

test("health anchors and critical flags match the degradation contract", () => {
  assert.equal(getVHSHealthProfile(100).intensity, 0.05);
  assert.equal(getVHSHealthProfile(60).intensity, 0.14);
  assert.equal(getVHSHealthProfile(40).intensity, 0.3);
  assert.equal(getVHSHealthProfile(20).intensity, 0.5);
  assert.equal(getVHSHealthProfile(19).intensity, 0.5);

  assert.equal(getVHSHealthProfile(40).unstableTimecode, true);
  assert.equal(getVHSHealthProfile(20).periodicDropFrames, false);
  assert.equal(getVHSHealthProfile(19).periodicDropFrames, true);
  // Midpoint of the 100..60 segment on the filmic curve.
  assert.equal(getVHSHealthProfile(80).intensity, 0.095);
});

test("intensity math clamps invalid and out-of-range inputs", () => {
  assert.equal(clampVHSIntensity(-1), 0);
  assert.equal(clampVHSIntensity(0.4), 0.4);
  assert.equal(clampVHSIntensity(2), 1);
  assert.equal(clampVHSIntensity(Number.NaN), 0);
});

test("disabled render profile is completely neutral", () => {
  assert.deepEqual(getVHSRenderProfile(0.85, true), {
    disabled: true,
    intensity: 0,
    canvasOpacity: 0,
    saturation: 1,
    contrast: 1,
    blurPx: 0,
    chromaOffsetPx: 0,
  });

  const enabled = getVHSRenderProfile(0.6, false);
  assert.equal(enabled.disabled, false);
  assert.ok(enabled.canvasOpacity > 0);
  assert.ok(enabled.saturation < 1);
  assert.ok(enabled.contrast > 1);
  assert.ok(enabled.blurPx > 0 && enabled.blurPx < 1);
});

test("sampled dropout, tear, and jitter geometry stays in integer bounds", () => {
  assert.equal(
    randomIntegerInclusive(
      effects.vhs.dropoutMinPx,
      effects.vhs.dropoutMaxPx,
      () => 0,
    ),
    effects.vhs.dropoutMinPx,
  );
  assert.equal(
    randomIntegerInclusive(
      effects.vhs.dropoutMinPx,
      effects.vhs.dropoutMaxPx,
      () => 1,
    ),
    effects.vhs.dropoutMaxPx,
  );

  for (let index = 0; index < 200; index += 1) {
    const sample = sampleVHSFrameGeometry(0.85, false);
    assert.ok(Number.isInteger(sample.dropoutHeightPx));
    assert.ok(Number.isInteger(sample.tearHeightPx));
    assert.ok(Number.isInteger(sample.jitterYPx));
    assert.ok(sample.dropoutHeightPx >= effects.vhs.dropoutMinPx);
    assert.ok(sample.dropoutHeightPx <= effects.vhs.dropoutMaxPx);
    assert.ok(sample.tearHeightPx >= effects.vhs.tearMinPx);
    assert.ok(sample.tearHeightPx <= effects.vhs.tearMaxPx);
    assert.ok(Math.abs(sample.jitterYPx) <= effects.vhs.dropoutMaxPx);
  }

  assert.deepEqual(sampleVHSFrameGeometry(1, true), {
    dropoutHeightPx: 0,
    tearHeightPx: 0,
    jitterYPx: 0,
  });
});

test("timestamp gate caps rendering at the configured frame rate", () => {
  assert.equal(VHS_FRAME_INTERVAL_MS, 1_000 / effects.vhs.maxFps);
  assert.equal(isVHSFrameDue(0, null), true);
  assert.equal(isVHSFrameDue(VHS_FRAME_INTERVAL_MS - 0.01, 0), false);
  assert.equal(isVHSFrameDue(VHS_FRAME_INTERVAL_MS, 0), true);
});
test("implementation keeps the VHS path cheap, local, and disableable", () => {
  const layerSource = readFileSync(
    new URL("../src/fx/VHSLayer.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = readFileSync(
    new URL("../src/styles/fx.css", import.meta.url),
    "utf8",
  );

  assert.equal(effects.vhs.renderScale, 0.5);
  assert.equal(effects.vhs.maxFps, 30);
  assert.equal(effects.vhs.grainCycleFrames, 3);
  assert.equal(effects.vhs.dropoutMinPx, 1);
  assert.equal(effects.vhs.dropoutMaxPx, 4);
  assert.equal(effects.vhs.tearMinPx, 12);
  assert.equal(effects.vhs.tearMaxPx, 20);
  assert.match(layerSource, /getContext\("2d"/);
  assert.match(layerSource, /isVHSFrameDue\(timestamp/);
  assert.match(layerSource, /document\.createElement\("canvas"\)/);
  assert.match(layerSource, /disabled \|\| !canvas/);
  assert.match(cssSource, /position:\s*fixed/);
  assert.match(cssSource, /pointer-events:\s*none/);
  assert.match(cssSource, /image-rendering:\s*pixelated/);
  assert.match(cssSource, /mix-blend-mode:\s*screen/);
  assert.doesNotMatch(
    layerSource + cssSource,
    /https?:\/\/|fetch\s*\(|WebGL|html2canvas|getDisplayMedia/,
  );
});
