import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

import { itemIds } from "../src/items";
import { modelByItem } from "../src/models/manifest";

const root = new URL("..", import.meta.url);

test("every examine model belongs to a real item and a local glb path", () => {
  const knownItemIds = new Set<string>(Object.values(itemIds));
  for (const [itemId, model] of Object.entries(modelByItem)) {
    assert.ok(knownItemIds.has(itemId), `unknown item id in modelByItem: ${itemId}`);
    assert.match(
      model!.src,
      /^\/models\/[A-Za-z0-9]+\.glb$/,
      `model src must be a local /models path: ${model!.src}`,
    );
    assert.ok(model!.alt.length > 0, `model alt text required: ${itemId}`);
    if (model!.secret) {
      assert.ok(model!.secret.hint.length > 0);
      assert.ok(model!.secret.revealText.length > 0);
    }
  }
});

test("every referenced model exists on disk as a real GLB and ships offline", () => {
  const seen = new Set<string>();
  for (const model of Object.values(modelByItem)) {
    if (seen.has(model!.src)) continue;
    seen.add(model!.src);
    const filePath = new URL("public" + model!.src, root);
    const bytes = readFileSync(filePath);
    assert.equal(
      bytes.subarray(0, 4).toString("ascii"),
      "glTF",
      `${model!.src} is not a binary glTF`,
    );
    assert.ok(bytes.length <= 2 * 1024 * 1024, `${model!.src} exceeds 2 MB`);
  }

  const viteConfig = readFileSync(new URL("vite.config.ts", root), "utf8");
  assert.match(
    viteConfig,
    /globPatterns:[\s\S]*?glb/,
    "GLB models must be in the offline precache globs",
  );
});

test("the model-viewer bundle is vendored locally and loaded before the app", () => {
  const vendored = statSync(new URL("public/vendor/model-viewer.min.js", root));
  assert.ok(vendored.size > 500_000, "vendored bundle looks truncated");

  const html = readFileSync(new URL("index.html", root), "utf8");
  const vendorAt = html.indexOf('src="/vendor/model-viewer.min.js"');
  const appAt = html.indexOf('src="/src/main.tsx"');
  assert.ok(vendorAt >= 0, "index.html must load the vendored model-viewer");
  assert.ok(appAt > vendorAt, "model-viewer must be declared before the app entry");
  assert.match(html, /<script type="module" src="\/vendor\/model-viewer\.min\.js"><\/script>/);
});

test("the examine screen degrades: broken models fall back to the icon panel", () => {
  const inventory = readFileSync(
    new URL("src/components/InventoryScreen.tsx", root),
    "utf8",
  );
  assert.match(inventory, /onUnavailable=\{/);
  assert.match(inventory, /brokenModels/);

  const examine = readFileSync(
    new URL("src/components/ExamineModel.tsx", root),
    "utf8",
  );
  assert.match(examine, /addEventListener\("error", handleError\)/);
  assert.match(examine, /user-interaction/);
});
