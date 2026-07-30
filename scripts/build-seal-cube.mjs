// Builds public/models/sealcube.glb: the bronze survey seal. Six faces, one
// texture atlas drawn with node-canvas: five room glyphs and one blank face
// with a circular depression. Deterministic output.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { createCanvas } from "canvas";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- Texture atlas: 3x2 grid of 256px faces ----
const FACE = 256;
const atlas = createCanvas(FACE * 3, FACE * 2);
const ctx = atlas.getContext("2d");

function bronzeFace(cx, cy, label, blank = false) {
  const x = cx * FACE;
  const y = cy * FACE;
  const gradient = ctx.createLinearGradient(x, y, x + FACE, y + FACE);
  gradient.addColorStop(0, "#7a5b33");
  gradient.addColorStop(0.5, "#8f6f41");
  gradient.addColorStop(1, "#5e4426");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, FACE, FACE);
  // wear at the edges
  ctx.strokeStyle = "rgba(40, 28, 14, 0.9)";
  ctx.lineWidth = 10;
  ctx.strokeRect(x + 5, y + 5, FACE - 10, FACE - 10);
  ctx.strokeStyle = "rgba(220, 195, 150, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 14, y + 14, FACE - 28, FACE - 28);
  if (blank) {
    // circular depression
    const grad = ctx.createRadialGradient(
      x + FACE / 2, y + FACE / 2, 8,
      x + FACE / 2, y + FACE / 2, 56,
    );
    grad.addColorStop(0, "rgba(30, 20, 8, 0.95)");
    grad.addColorStop(1, "rgba(30, 20, 8, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + FACE / 2, y + FACE / 2, 56, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "rgba(30, 20, 8, 0.92)";
  ctx.font = "bold 118px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + FACE / 2, y + FACE / 2 + 6);
  ctx.font = "22px Georgia";
  ctx.fillText("· CADASTRAL ·", x + FACE / 2, y + FACE - 34);
}

// Atlas layout: [corridor C][bathroom B][kitchen K] / [living L][balcony Y][blank]
bronzeFace(0, 0, "C");
bronzeFace(1, 0, "B");
bronzeFace(2, 0, "K");
bronzeFace(0, 1, "L");
bronzeFace(1, 1, "Y");
bronzeFace(2, 1, "", true);

const png = atlas.toBuffer("image/png", { compressionLevel: 9 });

// ---- Geometry: a unit cube, 24 verts, per-face UVs into the atlas ----
const document = new Document();
const buffer = document.createBuffer();

const h = 0.06; // 12cm cube
// face definitions: [normal, corners(ccw seen from outside), atlas cell]
const faces = [
  { n: [0, 0, 1], c: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], cell: [0, 0] },   // front  = corridor C
  { n: [1, 0, 0], c: [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]], cell: [1, 0] },   // right  = bathroom B
  { n: [0, 0, -1], c: [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]], cell: [2, 0] }, // back = kitchen K
  { n: [-1, 0, 0], c: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]], cell: [0, 1] }, // left = living L
  { n: [0, 1, 0], c: [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]], cell: [1, 1] },   // top    = balcony Y
  { n: [0, -1, 0], c: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]], cell: [2, 1] }, // bottom = blank
];

const positions = [];
const normals = [];
const uvs = [];
const indices = [];
faces.forEach((face, faceIndex) => {
  const [cu, cv] = face.cell;
  const u0 = cu / 3;
  const u1 = (cu + 1) / 3;
  const v0 = cv / 2;
  const v1 = (cv + 1) / 2;
  const faceUvs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
  face.c.forEach((corner, cornerIndex) => {
    positions.push(...corner);
    normals.push(...face.n);
    uvs.push(...faceUvs[cornerIndex]);
  });
  const base = faceIndex * 4;
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
});

const positionAccessor = document.createAccessor()
  .setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer);
const normalAccessor = document.createAccessor()
  .setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer);
const uvAccessor = document.createAccessor()
  .setType("VEC2").setArray(new Float32Array(uvs)).setBuffer(buffer);
const indexAccessor = document.createAccessor()
  .setType("SCALAR").setArray(new Uint16Array(indices)).setBuffer(buffer);

const texture = document.createTexture("seal-atlas")
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

const mesh = document.createMesh("seal").addPrimitive(primitive);
const node = document.createNode("seal").setMesh(mesh);
document.createScene("scene").addChild(node);

const io = new NodeIO();
const glb = await io.writeBinary(document);
const out = path.join(repoRoot, "public", "models", "sealcube.glb");
writeFileSync(out, glb);
console.log("wrote", out, glb.byteLength, "bytes");
