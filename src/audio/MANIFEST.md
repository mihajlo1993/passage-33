# Audio curator handoff

Runtime playback is fully local and URL-free. Ten deterministic one-shots and six unchanged procedural impulse responses are written to `public/audio` and compiled as hexadecimal bytes under `src/audio/generated`. Five voice MP3s occupy the same public inventory; deterministic silent MP3 placeholders ship until a human replaces them. Ambient beds are live Web Audio graphs in `beds.ts` and have no files.

Run:

```text
node scripts/generate-audio-assets.mjs
node scripts/generate-audio-assets.mjs --check
node --import tsx --test tests/audio-assets.test.ts tests/audio-engine.test.ts tests/audio-static.test.ts
```

The generator uses only Node built-ins. One-shots are mono signed PCM16 at 44.1 kHz. Normal one-shots peak at -6 dBFS; stingers may peak at -3 dBFS. The seed and DSP path are fixed, so repeated runs are byte-identical. Voice MP3s must be mono 44.1 kHz and dry. Details and exact scripts are in `VOICE.md`.

## One-shots

| ID | Public file | Exact length | Peak | Direction |
|---|---|---:|---:|---|
| `found` | `audio/oneshot/found.wav` | 180 ms | -6 dBFS | Small dry mechanical click. |
| `refused` | `audio/oneshot/refused.wav` | 400 ms | -6 dBFS | Dull low refusal, deliberately unsatisfying. |
| `released` | `audio/oneshot/released.wav` | 700 ms | -6 dBFS | Heavy two-stage tumbler fall. |
| `dial-tick` | `audio/oneshot/dial-tick.wav` | 90 ms | -6 dBFS | Tiny dry position click. |
| `write` | `audio/oneshot/write.wav` | 1,600 ms | -6 dBFS | Reluctant tape motor and clunk. |
| `stinger-a` | `audio/oneshot/stinger-a.wav` | 2,200 ms | -3 dBFS | Sub drop and torn transient. |
| `stinger-b` | `audio/oneshot/stinger-b.wav` | 3,500 ms | -3 dBFS | Rising approach into a larger impact. |
| `stinger-c` | `audio/oneshot/stinger-c.wav` | 1,400 ms | -3 dBFS | Tight dry thump and mid crack. |
| `drag` | `audio/oneshot/drag.wav` | 2,800 ms | -6 dBFS | Wet, irregular, shifting friction. |
| `heartbeat` | `audio/oneshot/heartbeat.wav` | 1,400 ms | -6 dBFS | Seamless two-beat loop. |

## Voice

| ID | Public file | Placeholder | Pin |
|---|---|---:|---:|
| `cold-open` | `audio/voice/cold-open.mp3` | ~22 s | 1 |
| `tape` | `audio/voice/tape.mp3` | ~75 s | 12 |
| `draught` | `audio/voice/draught.mp3` | ~16 s | 23 |
| `trophy` | `audio/voice/trophy.mp3` | ~20 s | 26 |
| `present` | `audio/voice/present.mp3` | ~14 s | 28 |

## Ambient beds

The seven `AmbientId` values are `ambient-corridor`, `ambient-bathroom`, `ambient-kitchen`, `ambient-balcony`, `ambient-entry`, `ambient-living`, and the non-zone `dead`. Zone and convolution changes crossfade together over 600 ms. Health maps linearly from 100 → tension 0 to 20 → tension 1; oscillator pitch rises at most four percent, a quiet 2.2 kHz partial enters, and swell periods halve over a four-second ramp.

## Offline inventory

`audioPrecachePaths` from `manifest.ts` enumerates every file under `public/audio`. The asset test fails if the public tree and that inventory differ or if compiled bytes differ from the public file. The repository's current Workbox glob still requires an owner outside this worktree to add `wav` and `mp3`; see `NOTES-audio.md`.
