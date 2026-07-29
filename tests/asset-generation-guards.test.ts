import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

interface ProtectedWritePlan {
  readonly action: "create" | "unchanged" | "replace-placeholder";
}

interface ProtectedAssetModule {
  isVerifiedGeneratedPlaceholder(
    contents: Buffer,
    metadata: { placeholder?: boolean; generated?: boolean; sha256?: string },
  ): boolean;
  planProtectedAssetWrite(
    file: string,
    contents: Buffer,
    options?: { knownPlaceholderBytes?: readonly Buffer[]; label?: string },
  ): ProtectedWritePlan;
  applyProtectedAssetWrite(
    file: string,
    plan: ProtectedWritePlan,
    options?: { checkOnly?: boolean },
  ): { readonly changed: boolean; readonly stale: boolean };
}

async function assetGuard(): Promise<ProtectedAssetModule> {
  const url = pathToFileURL(path.resolve("scripts/lib/protected-asset.mjs")).href;
  return await import(url) as ProtectedAssetModule;
}

test("asset guard refuses real overwrite and only replaces a proven placeholder", async () => {
  const { planProtectedAssetWrite, applyProtectedAssetWrite } = await assetGuard();
  const root = mkdtempSync(path.join(tmpdir(), "bh7-asset-guard-"));
  const file = path.join(root, "asset.bin");
  const real = Buffer.from("real production asset");
  const replacement = Buffer.from("replacement");

  try {
    writeFileSync(file, real);
    assert.throws(
      () => planProtectedAssetWrite(file, replacement, { label: "asset.bin" }),
      /Refusing to overwrite existing non-placeholder asset: asset\.bin/,
    );
    assert.deepEqual(readFileSync(file), real);

    const plan = planProtectedAssetWrite(file, replacement, {
      knownPlaceholderBytes: [real],
      label: "asset.bin",
    });
    assert.equal(plan.action, "replace-placeholder");
    const result = applyProtectedAssetWrite(file, plan);
    assert.equal(result.changed, true);
    assert.deepEqual(readFileSync(file), replacement);

    const missing = path.join(root, "missing.bin");
    const checkPlan = planProtectedAssetWrite(missing, replacement);
    const checked = applyProtectedAssetWrite(missing, checkPlan, { checkOnly: true });
    assert.equal(checked.stale, true);
    assert.equal(existsSync(missing), false);

    const replacedDuringPreflight = path.join(root, "replaced-during-preflight.bin");
    writeFileSync(replacedDuringPreflight, Buffer.from("known placeholder"));
    const replacementPlan = planProtectedAssetWrite(replacedDuringPreflight, replacement, {
      knownPlaceholderBytes: [Buffer.from("known placeholder")],
      label: "replaced-during-preflight.bin",
    });
    writeFileSync(replacedDuringPreflight, real);
    assert.throws(
      () => applyProtectedAssetWrite(replacedDuringPreflight, replacementPlan),
      /changed after placeholder verification/,
    );
    assert.deepEqual(readFileSync(replacedDuringPreflight), real);

    const createdDuringPreflight = path.join(root, "created-during-preflight.bin");
    const creationPlan = planProtectedAssetWrite(createdDuringPreflight, replacement, {
      label: "created-during-preflight.bin",
    });
    writeFileSync(createdDuringPreflight, real);
    assert.throws(
      () => applyProtectedAssetWrite(createdDuringPreflight, creationPlan),
      /created after preflight/,
    );
    assert.deepEqual(readFileSync(createdDuringPreflight), real);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("placeholder provenance requires generator flags and an exact SHA-256", async () => {
  const { isVerifiedGeneratedPlaceholder } = await assetGuard();
  const bytes = Buffer.from("generator-owned placeholder");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  assert.equal(
    isVerifiedGeneratedPlaceholder(bytes, { placeholder: true, generated: true, sha256 }),
    true,
  );
  assert.equal(
    isVerifiedGeneratedPlaceholder(bytes, { placeholder: false, generated: true, sha256 }),
    false,
  );
  assert.equal(
    isVerifiedGeneratedPlaceholder(bytes, {
      placeholder: true,
      generated: true,
      sha256: "0".repeat(64),
    }),
    false,
  );
});

test("production build is asset-free and Node is pinned to supported major 22", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    engines: { node: string };
    scripts: Record<string, string>;
  };
  const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    packages: Record<string, { engines?: { node?: string } }>;
  };

  assert.equal(packageJson.engines.node, ">=22.13.0 <23");
  assert.equal(packageLock.packages[""]?.engines?.node, ">=22.13.0 <23");
  assert.equal(packageJson.scripts.prebuild, undefined);
  assert.equal(packageJson.scripts.postbuild, undefined);
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.equal(
    packageJson.scripts["generate:assets"],
    "npm run generate:audio && npm run generate:media && npm run generate:ar",
  );
  assert.equal(packageJson.scripts["audit:build"], "node scripts/audit-build-output.mjs");
  assert.doesNotMatch(packageJson.scripts.build, /generate|ffmpeg|scripts\/|public[\\/]/i);

  for (const generator of [
    "scripts/generate-audio-assets.mjs",
    "scripts/process-image-assets.mjs",
    "scripts/generate-ar-assets.mjs",
  ]) {
    assert.match(readFileSync(generator, "utf8"), /lib\/protected-asset\.mjs/);
  }

  const mediaGenerator = readFileSync("scripts/process-image-assets.mjs", "utf8");
  assert.doesNotMatch(mediaGenerator, /\brmSync\b|removeOrReport/);
  assert.match(mediaGenerator, /output: "ar\/textures\/creature"[^\n]+webp: false/);

  const docs = readFileSync("ASSETS.md", "utf8");
  assert.match(docs, /generated locally and committed to Git/);
  assert.match(docs, /npm run generate:assets/);
  assert.match(docs, /ffmpeg is required|require `ffmpeg`/i);
});
