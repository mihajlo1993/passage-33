// Generates QR-MARKS.html: a standalone, printable page with the three
// physical QR marks. Codes are pure black on white for cheap-printer
// reliability; everything is inlined so the file works offline anywhere.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MARKS = [
  {
    id: 1,
    title: "START",
    name: "Waking",
    where: "Far end of the corridor, where she wakes. Eye height.",
  },
  {
    id: 27,
    title: "THE BOX",
    name: "Full Circle",
    where: "On the lid of the corridor box (the letter lives inside).",
  },
  {
    id: 28,
    title: "THE PRESENT",
    name: "The Present",
    where: "On the wrapping paper of the sealed carbonator, visible from Act 4.",
  },
];

const images = await Promise.all(
  MARKS.map((mark) =>
    QRCode.toDataURL(`bh7://pin/${mark.id}`, {
      errorCorrectionLevel: "Q",
      margin: 2,
      width: 560,
      color: { dark: "#000000", light: "#FFFFFF" },
    }),
  ),
);

const cards = MARKS.map((mark, index) => `
    <section class="card">
      <header>
        <span class="pin">PIN ${String(mark.id).padStart(2, "0")}</span>
        <h2>${mark.title}</h2>
        <p class="name">${mark.name}</p>
      </header>
      <img src="${images[index]}" alt="QR mark for pin ${mark.id}" />
      <footer>
        <p class="where"><strong>TAPE IT:</strong> ${mark.where}</p>
        <p class="payload">BH7 // HOUSE CODE // bh7://pin/${mark.id}</p>
      </footer>
    </section>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Passage 33: the three printed marks</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Courier New", Courier, monospace;
    background: #ffffff;
    color: #000000;
    padding: 12mm;
  }
  .sheet-title {
    text-align: center;
    letter-spacing: 0.35em;
    font-size: 13px;
    padding-bottom: 8mm;
    text-transform: uppercase;
  }
  .cards { display: flex; flex-direction: column; gap: 8mm; align-items: center; }
  .card {
    width: 92mm;
    border: 1.2px solid #000;
    padding: 5mm;
    text-align: center;
    page-break-inside: avoid;
  }
  .card header h2 { font-size: 22px; letter-spacing: 0.25em; }
  .card .pin { font-size: 10px; letter-spacing: 0.3em; }
  .card .name { font-size: 11px; letter-spacing: 0.2em; padding-bottom: 3mm; }
  .card img { width: 62mm; height: 62mm; image-rendering: pixelated; }
  .card .where { font-size: 10px; text-align: left; padding-top: 3mm; line-height: 1.5; }
  .card .payload { font-size: 8px; letter-spacing: 0.12em; padding-top: 2mm; color: #444; }
  .cut-note { text-align: center; font-size: 9px; padding-top: 8mm; letter-spacing: 0.2em; }
  @media print {
    body { padding: 8mm; }
    .cut-note { display: none; }
  }
</style>
</head>
<body>
  <p class="sheet-title">BIRTHDAY HOUSE SEVEN // THE THREE MARKS</p>
  <div class="cards">
${cards}
  </div>
  <p class="cut-note">CUT ALONG THE BORDERS. THE "TAPE IT" LINES ARE FOR YOU, NOT FOR HER: FOLD THEM BACK OR TRIM THEM OFF.</p>
</body>
</html>
`;

const out = path.join(repoRoot, "QR-MARKS.html");
writeFileSync(out, html);
console.log("wrote", out);
