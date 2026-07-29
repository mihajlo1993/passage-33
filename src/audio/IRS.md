# Zone impulse responses

The six convolution impulses retain the deterministic seeded algorithm in
`scripts/generate-audio-assets.mjs`: a one-pole filtered-noise field, fixed early
returns, polynomial decay, and a normalized 0.72 peak. Each file is mono signed
PCM16 at 12 kHz. Pre-delay is leading digital silence baked into the WAV; the
runtime adds no second pre-delay.

The WAV files live below `public/audio/ir`, are part of the static precache, and
load from root-relative local paths when a zone is first used. Decoded promises
are cached for the session. No impulse bytes are compiled into JavaScript and no
remote URL or runtime synthesis path exists.

| Zone / filename | Length | Pre-delay | Wet | Seed | Filter coefficient | Decay power | Character |
|---|---:|---:|---:|---:|---:|---:|---|
| Corridor / `ir/corridor.wav` | 1,800 ms | 18 ms | 0.34 | 731001 | 0.18 | 3 | Narrow, long, dark. |
| Bathroom / `ir/bathroom.wav` | 1,150 ms | 6 ms | 0.52 | 731002 | 0.58 | 4 | Tiled and bright. |
| Entry / `ir/entry.wav` | 900 ms | 10 ms | 0.28 | 731003 | 0.34 | 4 | Small and hard. |
| Living / `ir/living.wav` | 1,350 ms | 14 ms | 0.30 | 731004 | 0.15 | 3 | Soft mid-frequency tail. |
| Balcony / `ir/balcony.wav` | 2,600 ms | 110 ms | 0.10 | 731005 | 0.11 | 3 | Nearly dry, distant return. |
| Kitchen / `ir/kitchen.wav` | 1,050 ms | 8 ms | 0.38 | 731006 | 0.45 | 4 | Hard and reflective. |

Run the generator followed by `--check` and `tests/audio-assets.test.ts` after
changing any impulse parameter. Listening for metallic ringing remains a
human/device check; repository rules prohibit browser-driven verification.
