import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";

function asBuffer(contents) {
  return Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
}

function writeFullyAt(descriptor, bytes, label) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (written <= 0) {
      throw new Error(`[asset-guard] Short write while replacing placeholder: ${label}`);
    }
    offset += written;
  }
}

function readFullyAt(descriptor, length, label) {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = readSync(descriptor, bytes, offset, length - offset, offset);
    if (read <= 0) {
      throw new Error(`[asset-guard] Short read while verifying replacement: ${label}`);
    }
    offset += read;
  }
  return bytes;
}

/** Confirm that bytes are an asset placeholder previously produced by this generator. */
export function isVerifiedGeneratedPlaceholder(contents, metadata) {
  const sha256 = typeof metadata?.sha256 === "string" ? metadata.sha256.toLowerCase() : "";
  return (
    metadata?.placeholder === true
    && metadata?.generated === true
    && /^[a-f0-9]{64}$/.test(sha256)
    && createHash("sha256").update(asBuffer(contents)).digest("hex") === sha256
  );
}

/**
 * Plan a guarded binary write without mutating the filesystem.
 * Existing real assets are immutable; only an exact known placeholder may be replaced.
 */
export function planProtectedAssetWrite(
  file,
  contents,
  { knownPlaceholderBytes = [], label = file } = {},
) {
  const expected = asBuffer(contents);
  if (!existsSync(file)) {
    return Object.freeze({ action: "create", current: null, expected, label });
  }

  const current = readFileSync(file);
  if (current.equals(expected)) {
    return Object.freeze({ action: "unchanged", current, expected, label });
  }

  const isKnownPlaceholder = knownPlaceholderBytes
    .map(asBuffer)
    .some((placeholder) => current.equals(placeholder));
  if (!isKnownPlaceholder) {
    throw new Error(
      `[asset-guard] Refusing to overwrite existing non-placeholder asset: ${label}`,
    );
  }

  return Object.freeze({ action: "replace-placeholder", current, expected, label });
}

/** Apply a previously validated plan, rechecking the target immediately before mutation. */
export function applyProtectedAssetWrite(file, plan, { checkOnly = false } = {}) {
  const current = existsSync(file) ? readFileSync(file) : null;
  if (current?.equals(plan.expected)) {
    return Object.freeze({ changed: false, stale: false, action: "unchanged" });
  }

  if (plan.action === "unchanged") {
    throw new Error(
      `[asset-guard] Protected asset changed after preflight: ${plan.label}`,
    );
  }
  if (plan.action === "create" && current !== null) {
    throw new Error(
      `[asset-guard] Refusing to overwrite asset created after preflight: ${plan.label}`,
    );
  }
  if (
    plan.action === "replace-placeholder"
    && (current === null || plan.current === null || !current.equals(plan.current))
  ) {
    throw new Error(
      `[asset-guard] Refusing to overwrite asset changed after placeholder verification: ${plan.label}`,
    );
  }
  if (checkOnly) {
    return Object.freeze({ changed: false, stale: true, action: plan.action });
  }

  mkdirSync(path.dirname(file), { recursive: true });
  if (plan.action === "create") {
    writeFileSync(file, plan.expected, { flag: "wx" });
  } else {
    const descriptor = openSync(file, "r+");
    try {
      const openedBytes = readFileSync(descriptor);
      if (!openedBytes.equals(plan.current)) {
        throw new Error(
          `[asset-guard] Refusing to overwrite asset changed while opening: ${plan.label}`,
        );
      }
      writeFullyAt(descriptor, plan.expected, plan.label);
      ftruncateSync(descriptor, plan.expected.length);
      const verifiedBytes = readFullyAt(descriptor, plan.expected.length, plan.label);
      if (!verifiedBytes.equals(plan.expected)) {
        throw new Error(
          `[asset-guard] Replacement verification failed: ${plan.label}`,
        );
      }
    } finally {
      closeSync(descriptor);
    }
  }
  return Object.freeze({ changed: true, stale: false, action: plan.action });
}

/** Convenience wrapper for one guarded write. */
export function writeProtectedAsset(file, contents, options = {}) {
  const plan = planProtectedAssetWrite(file, contents, options);
  return applyProtectedAssetWrite(file, plan, options);
}
