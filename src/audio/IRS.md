# Zone impulse responses

The six shipped convolution impulses are deterministic build output. When no replacement exists, `scripts/generate-audio-assets.mjs` uses a seeded PRNG, a one-pole filtered-noise field, fixed early returns, and a polynomial decay envelope. It then normalizes to a 0.72 peak and writes mono signed-16 PCM at 12 kHz. The pre-delay is leading digital silence already baked into each WAV; the runtime must not add it again. `wet` is the runtime linear send/gain target and is not baked into the samples.

| Zone / filename | Length | Pre-delay | Wet | Seed | Filter coefficient | Decay power | Character |
|---|---:|---:|---:|---:|---:|---:|---|
| Corridor / `ir/corridor.wav` | 1,800 ms | 18 ms | 0.34 | 731001 | 0.18 | 3 | Narrow, long, dark. |
| Bathroom / `ir/bathroom.wav` | 1,150 ms | 6 ms | 0.52 | 731002 | 0.58 | 4 | Tiled and bright. |
| Entry / `ir/entry.wav` | 900 ms | 10 ms | 0.28 | 731003 | 0.34 | 4 | Small and hard. |
| Living / `ir/living.wav` | 1,350 ms | 14 ms | 0.30 | 731004 | 0.15 | 3 | Soft mid-frequency tail. |
| Balcony / `ir/balcony.wav` | 2,600 ms | 110 ms | 0.10 | 731005 | 0.11 | 3 | Nearly dry, distant return. |
| Kitchen / `ir/kitchen.wav` | 1,050 ms | 8 ms | 0.38 | 731006 | 0.45 | 4 | Hard and reflective. |

The filter coefficient is dimensionless at the fixed 12 kHz generation rate; a larger value follows more high-frequency noise. Decay power controls how quickly `(1 - progress)` falls through the tail.

## Tuning or replacing an IR

For a deterministic synthetic revision, change only that zone's values in `manifest.json`, regenerate, and commit the manifest and both generated modules together. Keep the declared duration and wet value unless the audio engine and test contract are deliberately revised too.

For a measured or hand-built replacement, place a mono little-endian uncompressed integer PCM WAV at `src/audio/source/ir/<zone>.wav` using the exact filename and duration in the table. It must include the listed amount of leading digital silence. The generator detects it, validates its frame count, embeds it instead of synthetic noise, and records `generated: false`. Remove that source file to return to seeded generation.

After either path, run:

```text
node scripts/generate-audio-assets.mjs
node scripts/generate-audio-assets.mjs --check
node --import tsx --test tests/audio-assets.test.ts
```

The IR test requires a nonzero bounded response and substantially lower final-quarter energy than first-quarter energy. Listen for clicks and metallic ringing separately; no browser or device is driven by the automated workflow.
