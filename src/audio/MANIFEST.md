# Audio asset handoff

All runtime audio is offline-first. File-backed assets live below `public/audio`,
use root-relative `/audio/...` paths from `manifest.json`, and are included in the
static Workbox precache. The runtime fetches those paths from the local origin,
decodes them with Web Audio, and caches the resulting promises. No audio bytes
are compiled into JavaScript and there is no remote URL, CDN, speech service, or
runtime generation path.

Run these commands after changing an asset or manifest entry:

```text
node scripts/generate-audio-assets.mjs
node scripts/generate-audio-assets.mjs --check
node scripts/report-voice-audio.mjs
node --import tsx --test tests/audio-assets.test.ts tests/audio-engine.test.ts tests/audio-static.test.ts
```

The generator uses Node built-ins only. It deterministically creates ten mono
PCM16 one-shots at 44.1 kHz and six mono PCM16 impulse responses at 12 kHz. It
also creates deterministic silent MP3 placeholders for missing Host recordings,
but never overwrites a production recording. It updates file metadata in
`manifest.json`; it does not create TypeScript payload modules.

## Runtime loading

The first successful audio unlock prepares the corridor impulse plus the Act I
set: `found`, `refused`, `released`, `dial-tick`, `write`, `stinger-a`, and
`heartbeat`. Other one-shots decode on first use. Zone impulse responses decode
when their zone is first selected. Host voice files decode only when their cue
starts. A failed or placeholder Host file returns no playback handle; gameplay
continues without synthesized or generated speech.

## One-shots

| ID | Public file | Length | Peak | Direction |
|---|---|---:|---:|---|
| `found` | `/audio/oneshot/found.wav` | 180 ms | -6 dBFS | Small dry mechanical click. |
| `refused` | `/audio/oneshot/refused.wav` | 400 ms | -6 dBFS | Dull low refusal, deliberately unsatisfying. |
| `released` | `/audio/oneshot/released.wav` | 700 ms | -6 dBFS | Heavy two-stage tumbler fall. |
| `dial-tick` | `/audio/oneshot/dial-tick.wav` | 90 ms | -6 dBFS | Tiny dry position click. |
| `write` | `/audio/oneshot/write.wav` | 1,600 ms | -6 dBFS | Reluctant tape motor and clunk. |
| `stinger-a` | `/audio/oneshot/stinger-a.wav` | 2,200 ms | -3 dBFS | Sub drop and torn transient. |
| `stinger-b` | `/audio/oneshot/stinger-b.wav` | 3,500 ms | -3 dBFS | Rising approach into a larger impact. |
| `stinger-c` | `/audio/oneshot/stinger-c.wav` | 1,400 ms | -3 dBFS | Tight dry thump and mid crack. |
| `drag` | `/audio/oneshot/drag.wav` | 2,800 ms | -6 dBFS | Wet, irregular, shifting friction. |
| `heartbeat` | `/audio/oneshot/heartbeat.wav` | 1,400 ms | -6 dBFS | Seamless two-beat loop. |

Normal one-shots peak at -6 dBFS; stingers may peak at -3 dBFS. The seeded DSP
path is fixed, so repeated runs are byte-identical.

## Host voice

| ID | Public file | Planned length | Pin |
|---|---|---:|---:|
| `cold-open` | `/audio/voice/cold-open.mp3` | about 22 s | 1 |
| `tape` | `/audio/voice/tape.mp3` | about 75 s | 12 |
| `draught` | `/audio/voice/draught.mp3` | about 16 s | 23 |
| `trophy` | `/audio/voice/trophy.mp3` | about 20 s | 26 |
| `present` | `/audio/voice/present.mp3` | about 14 s | 28 |

Voice MP3s must be mono 44.1 kHz and dry. If any file is missing, the generator
can supply a deterministic silent placeholder without overwriting production
audio. `VOICE.md` contains the full scripts and performance direction;
`report-voice-audio.mjs` reports measured duration and whether each current file
exactly matches its generated placeholder.

## Spatial sound and beds

`IRS.md` records the six deterministic zone impulses. Zone and convolution
changes crossfade together over 600 ms. The seven ambient IDs are
`ambient-corridor`, `ambient-bathroom`, `ambient-kitchen`, `ambient-balcony`,
`ambient-entry`, `ambient-living`, and the non-zone `dead`. Ambient beds are
small live Web Audio graphs in `beds.ts`, so they require no media files or
network access. Bed tension is an explicit control owned by gameplay rather
than inferred by `AudioDirector`.

## Direction

- Keep the object language heavy, mechanical, worn, and close. Avoid reward
  jingles, glossy impacts, bright UI chirps, comedy, and game-menu polish.
- Keep mono sources centered; zone space comes from the separate convolution
  impulses.
- Record the Host dry and close. He is delighted, over-familiar, and proud of
  the birthday arrangement. His sentences are short and never explain a puzzle.
- Preserve headroom, remove DC offset, and retain a local provenance/licence
  note for every replacement.
