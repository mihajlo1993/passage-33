# Zone impulse responses

The six convolution impulses retain the original deterministic algorithm and values. `scripts/generate-audio-assets.mjs` uses the existing seeded PRNG, one-pole filtered-noise field, fixed early returns, and polynomial decay, normalises to a 0.72 peak, and writes mono signed PCM16 at 12 kHz. The pre-delay remains leading digital silence baked into each WAV. The runtime adds no second pre-delay.

Each IR is written under `public/audio/ir` and compiled as hexadecimal bytes for network-free decoding. There is no base64 path and no runtime URL lookup.

| Zone / filename | Length | Pre-delay | Wet | Seed | Filter coefficient | Decay power | Character |
|---|---:|---:|---:|---:|---:|---:|---|
| Corridor / `ir/corridor.wav` | 1,800 ms | 18 ms | 0.34 | 731001 | 0.18 | 3 | Narrow, long, dark. |
| Bathroom / `ir/bathroom.wav` | 1,150 ms | 6 ms | 0.52 | 731002 | 0.58 | 4 | Tiled and bright. |
| Entry / `ir/entry.wav` | 900 ms | 10 ms | 0.28 | 731003 | 0.34 | 4 | Small and hard. |
| Living / `ir/living.wav` | 1,350 ms | 14 ms | 0.30 | 731004 | 0.15 | 3 | Soft mid-frequency tail. |
| Balcony / `ir/balcony.wav` | 2,600 ms | 110 ms | 0.10 | 731005 | 0.11 | 3 | Nearly dry, distant return. |
| Kitchen / `ir/kitchen.wav` | 1,050 ms | 8 ms | 0.38 | 731006 | 0.45 | 4 | Hard and reflective. |

Run the generator followed by its `--check` mode and `tests/audio-assets.test.ts` after changing any IR parameter. Listening for metallic ringing remains a human/device check; automated verification does not drive a browser.
