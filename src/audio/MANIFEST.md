# Audio curator handoff

All runtime sound is local. The checked-in TypeScript modules contain base64 WAV bytes; the app never fetches audio. Source masters belong under `src/audio/source/` at the exact relative paths below.

Run `node scripts/generate-audio-assets.mjs` from any directory after changing a source WAV. Run `node scripts/generate-audio-assets.mjs --check` in CI to prove that committed output is current. The generator has no package dependency and never reads outside this repository.

If a listed program WAV is absent, generation warns and ships a silent mono unsigned-8 PCM WAV at 8 kHz with the exact declared frame duration. This makes unfinished curation safe offline; it does not make it inaudible by accident. Supplied WAVs must be mono, little-endian RIFF, uncompressed integer PCM, and exactly the declared duration. The source bytes are copied rather than resampled. The combined generated TypeScript has an 8 MiB gate, leaving headroom below the offline cache's 10 MiB per-chunk ceiling.

## Direction

- The object language is heavy, mechanical, worn, and close. Avoid reward jingles, glossy impacts, bright UI chirps, comedy, and game-menu polish.
- Ambience must loop without a seam. Avoid a unique event near either boundary; audition at least three repetitions.
- Keep mono sources centered. Zone space comes from the separate convolution impulses.
- Record the Host dry and close. He is delighted, over-familiar, and proud of the birthday arrangement. Sentences are short. He never explains the puzzle, insults her personally, becomes crude, or states what happened to the previous guest.
- Preserve headroom. Aim for peaks at or below -3 dBFS and remove DC offset. Do not master ambience up to voice level.
- Maintain a local provenance/licence note with every replacement. Remote URLs, CDN assets, runtime speech synthesis, and runtime generation cannot ship.

## Ambient beds

| ID | Source filename | Exact length | Purpose |
|---|---|---:|---|
| `ambient-corridor` | `ambient/corridor-bed.wav` | 30,000 ms | Narrow hallway air; restrained wood and pipe movement. |
| `ambient-bathroom` | `ambient/bathroom-bed.wav` | 24,000 ms | Tiled room tone; sparse irregular drips. |
| `ambient-entry` | `ambient/entry-bed.wav` | 26,000 ms | Door settling; faint outside wind. |
| `ambient-living` | `ambient/living-bed.wav` | 32,000 ms | Soft room, tape, and tired mechanical tone. |
| `ambient-balcony` | `ambient/balcony-bed.wav` | 28,000 ms | Open air and a very distant city. |
| `ambient-kitchen` | `ambient/kitchen-bed.wav` | 30,000 ms | Refrigerator, pipes, and metal settling. |

## Host voice

| ID | Source filename | Exact length | Purpose |
|---|---|---:|---|
| `voice-host-intro` | `voice/host-intro.wav` | 12,000 ms | New-run Host greeting. |
| `voice-host-resume` | `voice/host-resume.wav` | 6,000 ms | Brief saved-run welcome. |
| `voice-pin-01` | `voice/host-pin-01.wav` | 9,000 ms | Host line after pin 1 resolves. |
| `voice-pin-02` | `voice/host-pin-02.wav` | 11,000 ms | Host line after pin 2 resolves. |
| `voice-pin-03` | `voice/host-pin-03.wav` | 10,000 ms | Host line after pin 3 resolves. |
| `voice-pin-04` | `voice/host-pin-04.wav` | 12,000 ms | Host line after pin 4 resolves. |
| `voice-pin-05` | `voice/host-pin-05.wav` | 10,000 ms | Host line after pin 5 resolves. |
| `voice-pin-06` | `voice/host-pin-06.wav` | 11,000 ms | Host line after pin 6 resolves. |
| `voice-pin-07` | `voice/host-pin-07.wav` | 9,000 ms | Host line after pin 7 resolves. |
| `voice-pin-08` | `voice/host-pin-08.wav` | 12,000 ms | Host line after pin 8 resolves. |
| `voice-pin-09` | `voice/host-pin-09.wav` | 9,000 ms | Host line after pin 9 resolves. |
| `voice-pin-10` | `voice/host-pin-10.wav` | 12,000 ms | Host line after pin 10 resolves. |
| `voice-pin-11` | `voice/host-pin-11.wav` | 10,000 ms | Host line after pin 11 resolves. |
| `voice-pin-12` | `voice/host-pin-12.wav` | 11,000 ms | Host line after pin 12 resolves. |
| `voice-pin-13` | `voice/host-pin-13.wav` | 10,000 ms | Host line after pin 13 resolves. |
| `voice-pin-14` | `voice/host-pin-14.wav` | 12,000 ms | Host line after pin 14 resolves. |
| `voice-pin-15` | `voice/host-pin-15.wav` | 9,000 ms | Host line after pin 15 resolves. |
| `voice-pin-16` | `voice/host-pin-16.wav` | 11,000 ms | Host line after pin 16 resolves. |
| `voice-pin-17` | `voice/host-pin-17.wav` | 10,000 ms | Host line after pin 17 resolves. |
| `voice-pin-18` | `voice/host-pin-18.wav` | 8,000 ms | Host line after pin 18 resolves. |
| `voice-pin-19` | `voice/host-pin-19.wav` | 9,000 ms | Host line after pin 19 resolves. |
| `voice-pin-20` | `voice/host-pin-20.wav` | 10,000 ms | Host line after pin 20 resolves. |
| `voice-pin-21` | `voice/host-pin-21.wav` | 9,000 ms | Host line after pin 21 resolves. |
| `voice-pin-22` | `voice/host-pin-22.wav` | 12,000 ms | Host line after pin 22 resolves. |
| `voice-pin-23` | `voice/host-pin-23.wav` | 9,000 ms | Host line after pin 23 resolves. |
| `voice-pin-24` | `voice/host-pin-24.wav` | 8,000 ms | Host line after pin 24 resolves. |
| `voice-pin-25` | `voice/host-pin-25.wav` | 10,000 ms | Host line after pin 25 resolves. |
| `voice-pin-26` | `voice/host-pin-26.wav` | 11,000 ms | Host line after pin 26 resolves. |
| `voice-pin-27` | `voice/host-pin-27.wav` | 12,000 ms | Host line after pin 27 resolves. |
| `voice-pin-28` | `voice/host-pin-28.wav` | 10,000 ms | Host line after pin 28 resolves. |

The spoken wording for each pin is its `bodyText` in `src/pins.ts`. Natural pauses count toward the declared length; pad the tail with digital silence rather than time-stretching the performance.

## One-shots

| ID | Source filename | Exact length | Purpose |
|---|---|---:|---|
| `ui-contact` | `oneshot/ui-contact.wav` | 180 ms | Scanner contact. |
| `ui-found` | `oneshot/ui-found.wav` | 650 ms | Accepted find. |
| `ui-refused` | `oneshot/ui-refused.wav` | 900 ms | Mechanical refusal. |
| `torch-kill` | `oneshot/torch-kill.wav` | 1,800 ms | Torch outage. |
| `room-monster-arrival` | `oneshot/room-monster-arrival.wav` | 3,500 ms | Room-scale arrival. |
| `close-quarters` | `oneshot/close-quarters.wav` | 1,500 ms | Near scare impact. |
| `candle-light` | `oneshot/candle-light.wav` | 700 ms | Ignition. |
| `candle-out` | `oneshot/candle-out.wav` | 500 ms | Extinguish. |
| `fan-stop` | `oneshot/fan-stop.wav` | 2,200 ms | Fan winding down. |
| `pistol-fire` | `oneshot/pistol-fire.wav` | 450 ms | Enclosed pistol shot. |
| `monster-hit` | `oneshot/monster-hit.wav` | 800 ms | Creature impact. |
| `monster-collapse` | `oneshot/monster-collapse.wav` | 2,400 ms | Heavy collapse. |
| `save-deck` | `oneshot/save-deck.wav` | 2,000 ms | Cassette save theatre. |
| `trophy-resolve` | `oneshot/trophy-resolve.wav` | 3,500 ms | Uneasy ending award. |
| `heartbeat` | `oneshot/heartbeat-loop.wav` | 1,200 ms | Seamless critical-health loop. |

## Acceptance pass

Run `node --import tsx --test tests/audio-assets.test.ts`. It checks inventory uniqueness and completeness, exact sample-frame duration, mono PCM structure, silent fallback integrity, generated-file freshness, byte budget, and impulse decay. Browser/device listening remains a manual curator step and is intentionally not performed by this repository workflow.
