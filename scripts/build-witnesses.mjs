// Builds the Keeper's four witnesses: bespoke bronze artifacts, one per lock,
// in the same material language as the seal cube. Each sits on an engraved
// catalogue base and carries content that genuinely serves its riddle:
//   witnessField.glb   - a woven field with the runner resting on it (lock I)
//   witnessRunner.glb  - the runner itself, wheel and beaded tail (lock II)
//   witnessWager.glb   - a three-sided obelisk wearing 1993 / 2 / IIII (lock III)
//   witnessSparkle.glb - the carbonator breathing out stars (lock IV)
// Undersides are mirror-safe (tick ring + tally notches, no words), because
// bottom-cap text orientation depends on the viewer. Deterministic output.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { createCanvas } from "canvas";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ============================ atlas drawing ============================ */

const ATLAS = 1024;

// Named regions of the 1024x1024 atlas, in pixels. PLAIN is the default
// bronze swatch; parts without markings sample its middle. Facet regions are
// cut at the physical facet's aspect (0.066 x 0.028, about 2.37:1) so the
// engraving is never stretched.
const R = {
  PLAIN: { x: 0, y: 0, w: 256, h: 256 },
  CHAMFER: { x: 256, y: 0, w: 128, h: 128 },
  SLAB_TOP: { x: 400, y: 0, w: 368, h: 240 },
  // The big underside region keeps the discovery crisp at full zoom. The
  // wager witness cannot use it (its number faces own that space) and takes
  // the small one instead; its three bold bars survive 256px fine.
  UNDER: { x: 512, y: 256, w: 512, h: 512 },
  UNDER_SMALL: { x: 768, y: 0, w: 256, h: 256 },
  BODY: { x: 0, y: 256, w: 512, h: 216 },
  FACET_FRONT: { x: 0, y: 592, w: 512, h: 216 },
  FACET_BACK: { x: 512, y: 592, w: 512, h: 216 },
  FACET_LEFT: { x: 0, y: 808, w: 512, h: 216 },
  FACET_RIGHT: { x: 512, y: 808, w: 512, h: 216 },
};

const INK = "rgba(30, 20, 8, 0.92)";
const INK_SOFT = "rgba(30, 20, 8, 0.45)";
const GLINT = "rgba(228, 205, 160, 0.30)";

function makeAtlas() {
  const canvas = createCanvas(ATLAS, ATLAS);
  const ctx = canvas.getContext("2d");
  // One warm bronze wash over everything, with slow diagonal variation and a
  // deterministic mottle so no face reads as flat plastic.
  const gradient = ctx.createLinearGradient(0, 0, ATLAS, ATLAS);
  gradient.addColorStop(0, "#7a5b33");
  gradient.addColorStop(0.45, "#8f6f41");
  gradient.addColorStop(0.72, "#6b4e2c");
  gradient.addColorStop(1, "#5e4426");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  let seed = 33;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i += 1) {
    const x = rand() * ATLAS;
    const y = rand() * ATLAS;
    const r = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? "rgba(40, 28, 14, 0.10)" : "rgba(220, 195, 150, 0.06)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, ctx };
}

/**
 * Engraved text: dark fill with a thin light glint offset up-left. Clipped
 * to its region, shrunk to fit its width, and optionally pre-compressed on X
 * (scaleX) so text drawn for a non-matching surface aspect still reads true.
 */
function etchText(ctx, region, text, size, cy = 0.5, scaleX = 1, font = "Georgia") {
  const x = region.x + region.w / 2;
  const y = region.y + region.h * cy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.w, region.h);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px ${font}`;
  const width = ctx.measureText(text).width * scaleX;
  const maxWidth = region.w * 0.8;
  const shrink = width > maxWidth ? maxWidth / width : 1;
  ctx.translate(x, y);
  ctx.scale(scaleX * shrink, shrink);
  ctx.fillStyle = GLINT;
  ctx.fillText(text, -1.5, -1.5);
  ctx.fillStyle = INK;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A worn double border inside a region, like the seal cube faces. */
function wornBorder(ctx, region, inset = 8) {
  ctx.strokeStyle = "rgba(40, 28, 14, 0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(region.x + inset, region.y + inset, region.w - inset * 2, region.h - inset * 2);
  ctx.strokeStyle = GLINT;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(region.x + inset + 6, region.y + inset + 6, region.w - inset * 2 - 12, region.h - inset * 2 - 12);
}

/**
 * The underside catalogue mark, deliberately wordless so it cannot mirror:
 * thirty-three ticks around the rim (the years held) and one deep tally
 * notch per lock in the centre.
 */
function drawUnderside(ctx, region, lockNumber) {
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const rim = region.w * 0.42;
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, rim, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rim * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (let i = 0; i < 33; i += 1) {
    const a = (i / 33) * Math.PI * 2 - Math.PI / 2;
    const r0 = rim * 0.88;
    const r1 = rim * 1.0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  // central tally: one bar per lock, clockmaker style (IIII, never IV).
  const barH = region.h * 0.22;
  const gap = region.w * 0.055;
  const total = (lockNumber - 1) * gap;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (let i = 0; i < lockNumber; i += 1) {
    const bx = cx - total / 2 + i * gap;
    ctx.strokeStyle = GLINT;
    ctx.beginPath();
    ctx.moveTo(bx - 2, cy - barH / 2 - 2);
    ctx.lineTo(bx - 2, cy + barH / 2 - 2);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(bx, cy - barH / 2);
    ctx.lineTo(bx, cy + barH / 2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function drawRivets(ctx, region) {
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  for (const dy of [-region.h * 0.18, region.h * 0.18]) {
    const grad = ctx.createRadialGradient(cx, cy + dy, 1, cx, cy + dy, 12);
    grad.addColorStop(0, "rgba(228, 205, 160, 0.5)");
    grad.addColorStop(0.5, "rgba(30, 20, 8, 0.8)");
    grad.addColorStop(1, "rgba(30, 20, 8, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy + dy, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ============================ geometry ============================ */

function makeBuilder() {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

function rotY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function rotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function mulMat(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}
function applyMat(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** xf = { rot?: mat3, t?: [x,y,z] } applied to every emitted vertex. */
function emit(b, xf, position, normal, uv) {
  const rot = xf?.rot ?? IDENTITY;
  const t = xf?.t ?? [0, 0, 0];
  const p = applyMat(rot, position);
  const n = applyMat(rot, normal);
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  b.positions.push(p[0] + t[0], p[1] + t[1], p[2] + t[2]);
  b.normals.push(n[0] / len, n[1] / len, n[2] / len);
  b.uvs.push(uv[0], uv[1]);
}

/** uv helper: pixel point inside a region -> normalised atlas uv. */
function uvAt(region, fx, fy) {
  return [(region.x + region.w * fx) / ATLAS, (region.y + region.h * fy) / ATLAS];
}
const PLAIN_UV = uvAt(R.PLAIN, 0.5, 0.5);

/** Quad from 4 corners ccw seen from outside, one normal, region-mapped. */
function quad(b, xf, corners, normal, region, uvCorners) {
  const base = b.positions.length / 3;
  const uvs = uvCorners ?? [uvAt(region, 0, 1), uvAt(region, 1, 1), uvAt(region, 1, 0), uvAt(region, 0, 0)];
  corners.forEach((corner, i) => emit(b, xf, corner, normal, uvs[i]));
  b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Prism from a footprint polygon in XZ (points ordered by increasing angle,
 * i.e. counterclockwise looking down +Y at standard axes). Side i spans
 * points[i] -> points[i+1]; outward normal (z1-z0, 0, x0-x1).
 * sideRegions[i] may be null for the plain swatch.
 */
function polyPrism(b, xf, points, y0, y1, sideRegions, topRegion, bottomRegion) {
  const count = points.length;
  for (let i = 0; i < count; i += 1) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % count];
    const n = [z1 - z0, 0, x0 - x1];
    const region = sideRegions?.[i] ?? null;
    const corners = [
      [x1, y0, z1],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z1],
    ];
    if (region) {
      quad(b, xf, corners, n, region);
    } else {
      quad(b, xf, corners, n, null, [PLAIN_UV, PLAIN_UV, PLAIN_UV, PLAIN_UV]);
    }
  }
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const planarUv = (region, x, z, mirrorX) => {
    if (!region) return PLAIN_UV;
    const fx = (x - minX) / (maxX - minX || 1);
    const fz = (z - minZ) / (maxZ - minZ || 1);
    return uvAt(region, mirrorX ? 1 - fx : fx, fz);
  };
  // top cap, fan triangulated, normal +Y
  let base = b.positions.length / 3;
  points.forEach(([x, z]) => emit(b, xf, [x, y1, z], [0, 1, 0], planarUv(topRegion, x, z, false)));
  for (let i = 1; i < count - 1; i += 1) b.indices.push(base, base + i + 1, base + i);
  // bottom cap, normal -Y, X mirrored so drawn art reads sanely from below
  base = b.positions.length / 3;
  points.forEach(([x, z]) => emit(b, xf, [x, y0, z], [0, -1, 0], planarUv(bottomRegion, x, z, true)));
  for (let i = 1; i < count - 1; i += 1) b.indices.push(base, base + i, base + i + 1);
}

/** Ellipsoid at origin (use xf to place), radii [rx, ry, rz]. */
function ellipsoid(b, xf, radii, latBands, lonBands, region) {
  const [rx, ry, rz] = radii;
  const base = b.positions.length / 3;
  for (let lat = 0; lat <= latBands; lat += 1) {
    const phi = (lat / latBands) * Math.PI;
    for (let lon = 0; lon <= lonBands; lon += 1) {
      const theta = (lon / lonBands) * Math.PI * 2;
      const x = rx * Math.sin(phi) * Math.cos(theta);
      const y = ry * Math.cos(phi);
      const z = rz * Math.sin(phi) * Math.sin(theta);
      const n = [x / (rx * rx), y / (ry * ry), z / (rz * rz)];
      const uv = region ? uvAt(region, lon / lonBands, lat / latBands) : PLAIN_UV;
      emit(b, xf, [x, y, z], n, uv);
    }
  }
  for (let lat = 0; lat < latBands; lat += 1) {
    for (let lon = 0; lon < lonBands; lon += 1) {
      const a = base + lat * (lonBands + 1) + lon;
      const d = a + lonBands + 1;
      b.indices.push(a, a + 1, d, a + 1, d + 1, d);
    }
  }
}

/** Vertical cylinder, y0..y1, optional textured wrap and caps. */
function cylinder(b, xf, r, y0, y1, segments, sideRegion, topRegion, bottomRegion) {
  const base = b.positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    const uvTop = sideRegion ? uvAt(sideRegion, i / segments, 0) : PLAIN_UV;
    const uvBottom = sideRegion ? uvAt(sideRegion, i / segments, 1) : PLAIN_UV;
    emit(b, xf, [x, y1, z], [Math.cos(a), 0, Math.sin(a)], uvTop);
    emit(b, xf, [x, y0, z], [Math.cos(a), 0, Math.sin(a)], uvBottom);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = base + i * 2;
    b.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const cap = (y, normalY, region, mirrorX) => {
    const centerIndex = b.positions.length / 3;
    emit(b, xf, [0, y, 0], [0, normalY, 0], region ? uvAt(region, 0.5, 0.5) : PLAIN_UV);
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      const fx = 0.5 + (mirrorX ? -1 : 1) * 0.5 * Math.cos(a);
      const fz = 0.5 + 0.5 * Math.sin(a);
      emit(b, xf, [x, y, z], [0, normalY, 0], region ? uvAt(region, fx, fz) : PLAIN_UV);
    }
    for (let i = 0; i < segments; i += 1) {
      if (normalY > 0) b.indices.push(centerIndex, centerIndex + 2 + i, centerIndex + 1 + i);
      else b.indices.push(centerIndex, centerIndex + 1 + i, centerIndex + 2 + i);
    }
  };
  if (topRegion !== undefined) cap(y1, 1, topRegion, false);
  if (bottomRegion !== undefined) cap(y0, -1, bottomRegion, true);
}

/**
 * Tapered prism (obelisk shaft): same polygon scaled at top, plus a pyramid
 * apex. Face normals computed from the actual slanted quads.
 */
function obelisk(b, xf, pointsBottom, scaleTop, y0, y1, apexY, sideRegions) {
  const count = pointsBottom.length;
  const pointsTop = pointsBottom.map(([x, z]) => [x * scaleTop, z * scaleTop]);
  for (let i = 0; i < count; i += 1) {
    const [x0, z0] = pointsBottom[i];
    const [x1, z1] = pointsBottom[(i + 1) % count];
    const [tx0, tz0] = pointsTop[i];
    const [tx1, tz1] = pointsTop[(i + 1) % count];
    const edge = [x0 - x1, 0, z0 - z1];
    const up = [tx1 - x1, y1 - y0, tz1 - z1];
    const n = [
      edge[1] * up[2] - edge[2] * up[1],
      edge[2] * up[0] - edge[0] * up[2],
      edge[0] * up[1] - edge[1] * up[0],
    ];
    const region = sideRegions?.[i] ?? null;
    // slanted quad: bottom edge full width, top edge inset
    const corners = [
      [x1, y0, z1],
      [x0, y0, z0],
      [tx0, y1, tz0],
      [tx1, y1, tz1],
    ];
    const uvs = region
      ? [uvAt(region, 0, 1), uvAt(region, 1, 1), uvAt(region, 0.86, 0), uvAt(region, 0.14, 0)]
      : [PLAIN_UV, PLAIN_UV, PLAIN_UV, PLAIN_UV];
    quad(b, xf, corners, n, null, uvs);
  }
  // apex pyramid
  for (let i = 0; i < count; i += 1) {
    const [x0, z0] = pointsTop[i];
    const [x1, z1] = pointsTop[(i + 1) % count];
    const edge = [x0 - x1, 0, z0 - z1];
    const up = [0 - x1, apexY - y1, 0 - z1];
    const n = [
      edge[1] * up[2] - edge[2] * up[1],
      edge[2] * up[0] - edge[0] * up[2],
      edge[0] * up[1] - edge[1] * up[0],
    ];
    const base = b.positions.length / 3;
    emit(b, xf, [x1, y1, z1], n, PLAIN_UV);
    emit(b, xf, [x0, y1, z0], n, PLAIN_UV);
    emit(b, xf, [0, apexY, 0], n, PLAIN_UV);
    b.indices.push(base, base + 1, base + 2);
  }
}

/* ============================ shared base ============================ */

const BASE_HALF = 0.05;
const BASE_CHAMFER = 0.017;
const BASE_HEIGHT = 0.028;

/**
 * The catalogue base every witness stands on: a chamfered square plinth.
 * Wide facets: front (+Z) lock title, back (-Z) THE KEEPER MCMXCIII,
 * left (-X) HELD IN TRUST, right (+X) THIRTY THREE YEARS.
 * Footprint points ordered by increasing angle starting near +X,+Z corner.
 */
function catalogueBase(b, underRegion = R.UNDER) {
  const a = BASE_HALF;
  const c = BASE_CHAMFER;
  const points = [
    [a, a - c],
    [a - c, a],
    [-a + c, a],
    [-a, a - c],
    [-a, -a + c],
    [-a + c, -a],
    [a - c, -a],
    [a, -a + c],
  ];
  // Side i spans points[i] -> points[i+1]; from the derivation used by the
  // seal cube: edge (a-c,a)->(-a+c,a) has outward normal +Z (the front).
  const sides = [
    R.CHAMFER, // corner +X,+Z
    R.FACET_FRONT, // +Z
    R.CHAMFER,
    R.FACET_LEFT, // -X
    R.CHAMFER,
    R.FACET_BACK, // -Z
    R.CHAMFER,
    R.FACET_RIGHT, // +X
  ];
  polyPrism(b, null, points, 0, BASE_HEIGHT, sides, null, underRegion);
}

function drawBaseFacets(ctx, frontText) {
  for (const region of [R.FACET_FRONT, R.FACET_BACK, R.FACET_LEFT, R.FACET_RIGHT]) {
    wornBorder(ctx, region, 7);
  }
  etchText(ctx, R.FACET_FRONT, frontText, 78);
  etchText(ctx, R.FACET_BACK, "THE KEEPER  ·  MCMXCIII", 68);
  etchText(ctx, R.FACET_LEFT, "HELD IN TRUST", 68);
  etchText(ctx, R.FACET_RIGHT, "THIRTY THREE YEARS", 64);
  drawRivets(ctx, R.CHAMFER);
}

/* ============================ the witnesses ============================ */

function writeGlb(name, b, atlasCanvas) {
  const document = new Document();
  const buffer = document.createBuffer();
  const positionAccessor = document.createAccessor()
    .setType("VEC3").setArray(new Float32Array(b.positions)).setBuffer(buffer);
  const normalAccessor = document.createAccessor()
    .setType("VEC3").setArray(new Float32Array(b.normals)).setBuffer(buffer);
  const uvAccessor = document.createAccessor()
    .setType("VEC2").setArray(new Float32Array(b.uvs)).setBuffer(buffer);
  const indexAccessor = document.createAccessor()
    .setType("SCALAR").setArray(new Uint32Array(b.indices)).setBuffer(buffer);
  const png = atlasCanvas.toBuffer("image/png", { compressionLevel: 9 });
  const texture = document.createTexture(`${name}-atlas`)
    .setImage(png)
    .setMimeType("image/png");
  const material = document.createMaterial("bronze")
    .setBaseColorTexture(texture)
    .setMetallicFactor(0.85)
    .setRoughnessFactor(0.45);
  const primitive = document.createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setAttribute("TEXCOORD_0", uvAccessor)
    .setIndices(indexAccessor)
    .setMaterial(material);
  const mesh = document.createMesh(name).addPrimitive(primitive);
  const node = document.createNode(name).setMesh(mesh);
  document.createScene("scene").addChild(node);
  return new NodeIO().writeBinary(document).then((glb) => {
    const out = path.join(repoRoot, "public", "models", `${name}.glb`);
    writeFileSync(out, glb);
    console.log("wrote", out, glb.byteLength, "bytes");
  });
}

/* ---- Lock I: THE FIELD. A woven field, and the runner upon it. ---- */
function buildField() {
  const { canvas, ctx } = makeAtlas();
  drawBaseFacets(ctx, "LOCK I  ·  THE FIELD");
  drawUnderside(ctx, R.UNDER, 1);

  // Slab top: a woven crosshatch and a faint kept-journey loop.
  const slabTop = R.SLAB_TOP;
  wornBorder(ctx, slabTop, 10);
  ctx.strokeStyle = "rgba(30, 20, 8, 0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i += 1) {
    const y = slabTop.y + 14 + (i / 21) * (slabTop.h - 28);
    ctx.beginPath();
    ctx.moveTo(slabTop.x + 14, y);
    ctx.lineTo(slabTop.x + slabTop.w - 14, y);
    ctx.stroke();
  }
  for (let i = 0; i < 42; i += 1) {
    const x = slabTop.x + 14 + (i / 41) * (slabTop.w - 28);
    ctx.beginPath();
    ctx.moveTo(x, slabTop.y + 14);
    ctx.lineTo(x, slabTop.y + slabTop.h - 14);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(228, 205, 160, 0.20)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(
    slabTop.x + slabTop.w * 0.44, slabTop.y + slabTop.h * 0.52,
    slabTop.w * 0.26, slabTop.h * 0.3, -0.35, 0, Math.PI * 2,
  );
  ctx.stroke();

  const b = makeBuilder();
  catalogueBase(b);

  // The field: a thin slab, slightly turned, as if set down and left.
  const turn = { rot: rotY(-0.16), t: [0, 0, 0] };
  const sw = 0.043;
  const sd = 0.031;
  const sy0 = BASE_HEIGHT + 0.0004;
  const sy1 = BASE_HEIGHT + 0.007;
  const slabPoints = [
    [sw, sd],
    [-sw, sd],
    [-sw, -sd],
    [sw, -sd],
  ];
  polyPrism(b, turn, slabPoints, sy0, sy1, null, R.SLAB_TOP, null);

  // The runner at rest on the field, nose toward the field's far edge.
  ellipsoid(
    b,
    { rot: rotY(-0.16), t: applyMat(rotY(-0.16), [0.016, 0, 0.006]).map((v, i) => (i === 1 ? sy1 + 0.0075 : v)) },
    [0.0105, 0.0085, 0.0155],
    10,
    14,
    null,
  );
  return writeGlb("witnessField", b, canvas);
}

/* ---- Lock II: THE RUNNER. The tenant itself, wheel and tail. ---- */
function buildRunner() {
  const { canvas, ctx } = makeAtlas();
  drawBaseFacets(ctx, "LOCK II  ·  THE RUNNER");
  drawUnderside(ctx, R.UNDER, 2);

  // Body wrap: seam lines over the nose. In the ellipsoid parametrisation
  // +Z (the nose, toward the default camera) sits at u = 0.25.
  const body = R.BODY;
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 4;
  for (const fu of [0.22, 0.28]) {
    ctx.beginPath();
    ctx.moveTo(body.x + body.w * fu, body.y + body.h * 0.06);
    ctx.lineTo(body.x + body.w * fu, body.y + body.h * 0.46);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(body.x + body.w * 0.25, body.y + body.h * 0.3);
  ctx.lineTo(body.x + body.w * 0.25, body.y + body.h * 0.5);
  ctx.stroke();

  const b = makeBuilder();
  catalogueBase(b);

  // Body: a bronze runner, nose toward +Z where the camera starts.
  ellipsoid(
    b,
    { t: [0, BASE_HEIGHT + 0.017, -0.003] },
    [0.024, 0.019, 0.035],
    14,
    20,
    R.BODY,
  );
  // Scroll wheel: a cylinder rolling along Z, sunk to a sliver at the nose.
  cylinder(
    b,
    { rot: rotZ(Math.PI / 2), t: [0, BASE_HEIGHT + 0.0285, 0.0195] },
    0.007,
    -0.0035,
    0.0035,
    14,
    null,
    null,
    null,
  );
  // The tail: beads shrinking away behind it in a lazy S, kept on the base.
  const beads = 6;
  for (let i = 0; i < beads; i += 1) {
    const t = i / (beads - 1);
    const r = 0.0052 - t * 0.0024;
    const x = Math.sin(t * 2.2) * 0.009;
    const z = -0.034 - t * 0.013;
    ellipsoid(b, { t: [x, BASE_HEIGHT + r, z] }, [r, r, r], 8, 10, null);
  }
  return writeGlb("witnessRunner", b, canvas);
}

/* ---- Lock III: THE WAGER. Three numbers ride the obelisk. ---- */
function buildWager() {
  const { canvas, ctx } = makeAtlas();
  drawBaseFacets(ctx, "LOCK III  ·  THE WAGER");
  drawUnderside(ctx, R.UNDER_SMALL, 3);

  // Three shaft faces: the year, the night, the count of locks. The face is
  // physically 0.057 wide by 0.082 tall; the regions are squarer, so the
  // digits are pre-compressed to keep their true proportions on the bronze.
  const FACE_ASPECT_FIX = (0.057 / 0.082) / (341 / 336);
  const faces = [
    { region: { x: 0, y: 256, w: 341, h: 336 }, text: "1993" },
    { region: { x: 341, y: 256, w: 341, h: 336 }, text: "2" },
    { region: { x: 682, y: 256, w: 341, h: 336 }, text: "IIII" },
  ];
  for (const face of faces) {
    wornBorder(ctx, face.region, 12);
    etchText(ctx, face.region, face.text, 160, 0.54, FACE_ASPECT_FIX);
    etchText(ctx, face.region, "+", 64, 0.14, FACE_ASPECT_FIX);
  }

  const b = makeBuilder();
  catalogueBase(b, R.UNDER_SMALL);

  // Footprint points by increasing angle; face i spans points[i]->[i+1].
  // Angles 30, 150, 270 degrees put face 0 square to +Z, facing the camera.
  const r = 0.033;
  const tri = [30, 150, 270].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  obelisk(
    b,
    null,
    tri,
    0.62,
    BASE_HEIGHT,
    BASE_HEIGHT + 0.082,
    BASE_HEIGHT + 0.104,
    faces.map((face) => face.region),
  );
  return writeGlb("witnessWager", b, canvas);
}

/* ---- Lock IV: THE SPARKLE. Silver in, stars out. ---- */
function buildSparkle() {
  const { canvas, ctx } = makeAtlas();
  drawBaseFacets(ctx, "LOCK IV  ·  THE SPARKLE");
  drawUnderside(ctx, R.UNDER, 4);

  // Body wrap: fine fluting and three etched stars rising near the front.
  const body = R.BODY;
  ctx.strokeStyle = "rgba(30, 20, 8, 0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i += 1) {
    const x = body.x + (i / 48) * body.w;
    ctx.beginPath();
    ctx.moveTo(x, body.y + 8);
    ctx.lineTo(x, body.y + body.h - 8);
    ctx.stroke();
  }
  const star = (cx, cy, size) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * size, cy - Math.sin(a) * size);
      ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
      ctx.stroke();
    }
  };
  star(body.x + body.w * 0.22, body.y + body.h * 0.7, 26);
  star(body.x + body.w * 0.27, body.y + body.h * 0.42, 19);
  star(body.x + body.w * 0.31, body.y + body.h * 0.18, 14);

  const b = makeBuilder();
  catalogueBase(b);

  const y = BASE_HEIGHT;
  // Bottle body, shoulder, neck, cap.
  cylinder(b, null, 0.019, y, y + 0.05, 24, R.BODY, undefined, undefined);
  ellipsoid(b, { t: [0, y + 0.05, 0] }, [0.019, 0.011, 0.019], 8, 24, null);
  cylinder(b, null, 0.0085, y + 0.05, y + 0.064, 16, null, undefined, undefined);
  ellipsoid(b, { t: [0, y + 0.066, 0] }, [0.0115, 0.009, 0.0115], 8, 16, null);
  // The lever: hinged at the cap, its free end arcing outward and down
  // beside the body, the way the real one waits to be pressed.
  const leverRot = rotZ(0.4);
  const leverPoints = [
    [0.0035, 0.0026],
    [-0.0035, 0.0026],
    [-0.0035, -0.0026],
    [0.0035, -0.0026],
  ];
  polyPrism(
    b,
    { rot: leverRot, t: [0.014, y + 0.05, 0] },
    leverPoints,
    -0.024,
    0.024,
    null,
    null,
    null,
  );
  // Stars rising out of the mouth. They remain physical evidence for the
  // last witness while the testimony controls stay explicit and separate.
  for (let i = 0; i < 7; i += 1) {
    const t = i / 6;
    const r = 0.0032 + 0.0009 * ((i * 7) % 3);
    const x = 0.012 * Math.sin(i * 2.1);
    const z = 0.012 * Math.cos(i * 1.7);
    ellipsoid(b, { t: [x, y + 0.084 + t * 0.09, z] }, [r, r, r], 6, 8, null);
  }
  return writeGlb("witnessSparkle", b, canvas);
}

/* ============================ run ============================ */

await buildField();
await buildRunner();
await buildWager();
await buildSparkle();
console.log("the four witnesses are cast.");
