// Builds public/models/keycard3d.glb: the Cadastral Division clearance card.
// A thin rounded-feel box with printed faces and, along ONE long edge, the
// embossed 1993 baked faintly into the edge texture, so the "read the rim"
// puzzle is physically real: visible only when the light grazes it.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { createCanvas } from "canvas";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- Textures ----
// Atlas: 1024x512. Left 512x320 = front face; right 512x320 = back face;
// bottom strip 1024x64 = the long edge with the embossed digits.
const atlas = createCanvas(1024, 512);
const ctx = atlas.getContext("2d");

function cardFace(x, y, front) {
  const w = 512;
  const h = 320;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "#ded5c2");
  grad.addColorStop(0.5, "#cfc5ae");
  grad.addColorStop(1, "#b8ad94");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // aged blotches
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(96, 78, 52, ${0.03 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(x + Math.random() * w, y + Math.random() * h, 8 + Math.random() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(60, 46, 26, 0.9)";
  ctx.lineWidth = 6;
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
  ctx.fillStyle = "rgba(50, 38, 20, 0.92)";
  ctx.textAlign = "left";
  if (front) {
    ctx.font = "bold 42px Georgia";
    ctx.fillText("CADASTRAL DIVISION", x + 40, y + 84);
    ctx.font = "26px Georgia";
    ctx.fillText("FIELD CLEARANCE · ONE BEARER", x + 40, y + 130);
    ctx.fillText("FILE 33 · ISSUE DATE ILLEGIBLE", x + 40, y + 168);
    ctx.font = "20px Georgia";
    ctx.fillText("THE SURVEY OF THIS ADDRESS", x + 40, y + 232);
    ctx.fillText("WAS OPENED AND NEVER CLOSED", x + 40, y + 260);
    // a worn photo box
    ctx.fillStyle = "rgba(70, 56, 34, 0.5)";
    ctx.fillRect(x + 372, y + 196, 96, 84);
  } else {
    ctx.font = "24px Georgia";
    ctx.fillText("PROPERTY OF THE DIVISION", x + 40, y + 90);
    ctx.fillText("IF FOUND, THE DIVISION KNOWS", x + 40, y + 126);
    // magnetic-stripe-like band
    ctx.fillStyle = "rgba(52, 40, 22, 0.85)";
    ctx.fillRect(x, y + 180, w, 56);
  }
}

cardFace(0, 0, true);
cardFace(512, 0, false);

// Edge strip: cream base, digits VERY low contrast (embossed, not printed).
const edgeY = 448;
const edgeGrad = ctx.createLinearGradient(0, edgeY, 0, edgeY + 64);
edgeGrad.addColorStop(0, "#d6ccb6");
edgeGrad.addColorStop(1, "#bfb49a");
ctx.fillStyle = edgeGrad;
ctx.fillRect(0, edgeY, 1024, 64);
ctx.font = "bold 44px Georgia";
ctx.textAlign = "center";
// A shade darker plus a highlight offset: reads as relief under raking light.
ctx.fillStyle = "rgba(140, 126, 100, 0.55)";
ctx.fillText("1 9 9 3", 512, edgeY + 46);
ctx.fillStyle = "rgba(240, 232, 214, 0.5)";
ctx.fillText("1 9 9 3", 510, edgeY + 44);

const png = atlas.toBuffer("image/png", { compressionLevel: 9 });

// ---- Geometry: a credit-card-proportioned slab, 85.6 x 54 x 2.4 (cm/10) ----
const document = new Document();
const buffer = document.createBuffer();

const hx = 0.0428; // half width
const hy = 0.027; // half height
const hz = 0.0024; // half thickness

// UV rects in the atlas (u0,v0,u1,v1), v measured from top of image.
const FRONT_UV = [0, 0, 0.5, 0.625];
const BACK_UV = [0.5, 0, 1.0, 0.625];
const EDGE_UV = [0, 0.875, 1.0, 1.0];
const PLAIN_UV = [0.02, 0.7, 0.06, 0.74]; // a plain patch of the atlas gap

ctx.fillStyle = "#c9bfa8";
ctx.fillRect(0, 340, 1024, 100); // ensure the plain patch region is card-cream

const png2 = atlas.toBuffer("image/png", { compressionLevel: 9 });

const faces = [
  { n: [0, 0, 1], c: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], uv: FRONT_UV },
  { n: [0, 0, -1], c: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], uv: BACK_UV },
  { n: [0, -1, 0], c: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], uv: EDGE_UV },
  { n: [0, 1, 0], c: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], uv: PLAIN_UV },
  { n: [1, 0, 0], c: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], uv: PLAIN_UV },
  { n: [-1, 0, 0], c: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], uv: PLAIN_UV },
];

const positions = [];
const normals = [];
const uvs = [];
const indices = [];
faces.forEach((face, faceIndex) => {
  const [u0, v0, u1, v1] = face.uv;
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

const texture = document.createTexture("card-atlas")
  .setImage(png2)
  .setMimeType("image/png");

const material = document.createMaterial("card")
  .setBaseColorTexture(texture)
  .setMetallicFactor(0.0)
  .setRoughnessFactor(0.62);

const primitive = document.createPrimitive()
  .setAttribute("POSITION", positionAccessor)
  .setAttribute("NORMAL", normalAccessor)
  .setAttribute("TEXCOORD_0", uvAccessor)
  .setIndices(indexAccessor)
  .setMaterial(material);

const mesh = document.createMesh("card").addPrimitive(primitive);
const node = document.createNode("card").setMesh(mesh).setRotation([0.2, 0.35, 0.05, 0.91]);
document.createScene("scene").addChild(node);

const io = new NodeIO();
const glb = await io.writeBinary(document);
const out = path.join(repoRoot, "public", "models", "keycard3d.glb");
writeFileSync(out, glb);
console.log("wrote", out, glb.byteLength, "bytes");
