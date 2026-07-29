# Preparing the two printed AR sheets

The app ships with safe placeholder art and a deliberately unusable placeholder target database. Follow this page when the final A3 sheets are ready. Nothing here requires changing app code.

All work can be done offline. Use an offline image editor and a local MindAR compiler compatible with the repository's pinned MindAR 1.2.5. Do not link images, fonts, or target files from the web.

## 1. Photograph each A3 sheet

Photograph `sheet01` and `sheet02` separately.

1. Put one sheet flat on a rigid, non-reflective surface.
2. Use even, indirect light. Avoid glare, hard shadows, fingers, tape, and objects crossing the paper.
3. Hold the camera square to the centre of the page. Keep all four corners visible and keep the page in portrait orientation.
4. Focus on the printed drawing. The photograph needs crisp, unique detail across the page; blur and large blank areas make tracking unreliable.
5. In an offline editor, correct perspective and crop exactly to the paper edges.
6. Resize the crop to exactly **1754 pixels wide by 2480 pixels high**. Export a fully opaque PNG; do not use JPEG.

Save the two photographs with these exact names:

```text
src/ar/assets/source/sheet01.png
src/ar/assets/source/sheet02.png
```

Do not rotate or mirror either image after this point. The same PNG files must be used for the masks and for target compilation.

## 2. Prepare the two masks

The mask tells the generator which photographed pixels become the isolated overlay. The overlay is built from the photograph at build time; it is not separate redrawn art.

1. Duplicate `sheet01.png` without moving, scaling, rotating, or cropping it.
2. Select only the figure printed on the sheet.
3. Export a 1754 by 2480 PNG mask. Either of these forms is accepted:
   - the figure is opaque and everything else is transparent; or
   - the figure is white and everything else is black.
4. Keep the edge tight. A one- or two-pixel feather is enough; do not include the page border or a large halo.
5. Repeat the same process for only the herb on `sheet02.png`.

Save the masks as:

```text
src/ar/assets/source/sheet01-mask.png
src/ar/assets/source/sheet02-mask.png
```

Each photograph and its mask are a pair. The generator stops if only one file in a pair exists, if a file is not a PNG, if dimensions differ, or if a mask is empty or covers most of the page.

## 3. Compile one MindAR database in stable order

Use one local MindAR image-target compiler to create one database. The order is part of the app contract:

| Compiler index | Add this image |
| --- | --- |
| `0` | `sheet01.png` |
| `1` | `sheet02.png` |

In plain terms: target index 0 is always sheet 01, and target index 1 is always sheet 02.

Add `sheet01.png` first, wait for it to appear as the first target, then add `sheet02.png`. If the compiler uses a multi-file picker that reorders files, add them one at a time. Confirm the preview still shows sheet 01 first and sheet 02 second before compiling.

Compile/export the database, rename it exactly `targets.mind`, and put it here:

```text
src/ar/assets/source/targets.mind
```

The generator checks that it is a MindAR version-2 database with exactly two 1754 by 2480 targets. The `.mind` format does not retain source filenames, so it cannot discover a reversed pair after export. The visual order check in the compiler is therefore mandatory.

## 4. Optional room-creature replacement

The room creature uses a separate, build-time black-key source. Save it as:

```text
src/ar/assets/source/monster-source.png
```

It must be exactly **1024 by 2048**, fully opaque, with an exact pure-black background and at least one non-black creature pixel. The generator turns exact black pixels transparent and embeds the resulting PNG. Near-black creature detail remains visible. No canvas work or black-key pass happens on the phone.

## 5. Generate and verify

From the repository root, run:

```text
node scripts/generate-ar-assets.mjs
node scripts/generate-ar-assets.mjs --check
```

The first command writes `src/ar/generated/ar-assets.generated.ts`. The second command writes nothing and fails if that checked-in output does not exactly match the sources. Continuous integration may use the silent form:

```text
node scripts/generate-ar-assets.mjs --check --quiet
```

The generated sheet textures are reduced to 512 by 724 for the Android memory budget. Original 1754 by 2480 photographs remain the inputs to the `.mind` compiler. All PNGs and database bytes are embedded; the running app makes no fetch or CDN request.

If a source file is absent, the generator embeds its deterministic placeholder and marks that asset as a placeholder. A missing `targets.mind` is marked explicitly and must not be passed to MindAR as a real target database.

## Do not change these contracts

- `AR_TARGET_ORDER` in `src/ar/assets.ts` remains `sheet01`, then `sheet02`.
- `IMAGE_AR_SCENES.sheet01.targetIndex` remains `0`, and `IMAGE_AR_SCENES.sheet02.targetIndex` remains `1`.
- Keep all six source filenames and the `src/ar/assets/source` destination exactly as listed above.
- Do not edit `src/ar/generated/ar-assets.generated.ts` by hand. Regenerate it.
- Do not add runtime image processing, canvas keying, network URLs, `fetch`, or CDN assets.
