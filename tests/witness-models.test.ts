import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { itemIds } from "../src/items";
import { modelByItem } from "../src/models/manifest";
import { pins, riddleConfigByPin } from "../src/pins";

const root = new URL("..", import.meta.url);

/**
 * The witness contract: every lock's bench shows a bespoke bronze witness,
 * the same witness she is granted as an item afterwards, and every witness
 * carries an underside secret for the examine screen. The bench never gates.
 */

const ARTIFACT_BY_RIDDLE_PIN: Record<number, keyof typeof itemIds> = {
  1: "sealArtifact",
  3: "jarArtifact",
  5: "reliquaryArtifact",
  8: "candleArtifact",
};

test("every riddle bench model is a real on-disk witness GLB with a bench note", () => {
  const entries = Object.entries(riddleConfigByPin);
  assert.equal(entries.length, 4);
  for (const [pinId, config] of entries) {
    assert.match(
      config!.model,
      /^\/models\/witness[A-Za-z]+\.glb$/,
      `pin ${pinId} must stand a bespoke witness on the bench, not a stock asset`,
    );
    const bytes = readFileSync(new URL("public" + config!.model, root));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", `${config!.model} is not a binary glTF`);
    assert.ok(bytes.length <= 2 * 1024 * 1024, `${config!.model} exceeds 2 MB`);
    assert.ok(config!.benchNote.length > 0, `pin ${pinId} bench note required`);
  }
});

test("the bench witness and the granted artifact are the same object", () => {
  for (const [pinIdRaw, artifactId] of Object.entries(ARTIFACT_BY_RIDDLE_PIN)) {
    const pinId = Number(pinIdRaw);
    const pin = pins.find((candidate) => candidate.id === pinId);
    assert.ok(pin, `pin ${pinId} exists`);
    assert.ok(
      pin!.grants.includes(itemIds[artifactId]),
      `pin ${pinId} must grant ${artifactId}`,
    );
    const config = riddleConfigByPin[pinId];
    const model = modelByItem[itemIds[artifactId]];
    assert.ok(config && model, `pin ${pinId} needs both a riddle config and an item model`);
    assert.equal(
      model!.src,
      config!.model,
      `pin ${pinId}: the item examine model must be the bench witness itself`,
    );
  }
});

test("every witness carries an underside secret for the examine screen", () => {
  for (const artifactId of Object.values(ARTIFACT_BY_RIDDLE_PIN)) {
    const model = modelByItem[itemIds[artifactId]];
    assert.ok(model?.secret, `${artifactId} needs a secret`);
    assert.ok(model!.secret!.hint.length > 0);
    assert.ok(model!.secret!.revealText.length > 0);
    assert.notEqual(model!.secret!.view, "edge", `${artifactId} secrets live on the underside`);
  }
});

test("the bench lets her roll the witness fully over and never gates on it", () => {
  const source = readFileSync(new URL("src/components/RiddleLock.tsx", root), "utf8");
  assert.match(source, /max-camera-orbit="Infinity 180deg auto"/, "underside must be reachable");
  assert.match(source, /\{config\.benchNote\}/, "the bench note comes from the riddle config");
  assert.doesNotMatch(source, /camera-change/, "the bench never watches her camera");
  assert.doesNotMatch(source, /getCameraOrbit/, "the bench never gates on orbit angles");
});

test("the witness build script is deterministic and mirror-safe below", () => {
  const script = readFileSync(new URL("scripts/build-witnesses.mjs", root), "utf8");
  assert.doesNotMatch(script, /Math\.random|Date\.now/, "witness builds must be deterministic");
  assert.match(script, /33/, "the underside carries the thirty-three ticks");
  for (const name of ["witnessField", "witnessRunner", "witnessWager", "witnessSparkle"]) {
    assert.match(script, new RegExp(name), `script must build ${name}`);
  }
});
