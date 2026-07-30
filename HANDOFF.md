# HANDOFF: THE KEEPER'S FOUR LOCKS (current state, 2026-07-30 night)

Read this first in any new session. It is the complete state of the project.

## What the product is

passage-33 now runs THE KEEPER'S FOUR LOCKS: a full application (title
screen, header, bottom tabs Map / Items / Letter, RE-style surface, 3D
benches, Keeper voice, effects, operator panel) with a simple warm-dark
story. Thirty-three years ago, the night Melissa was born, the building's
Keeper sealed a birthday letter behind four locks and left four gifts in
trust. Four stages, one per gift. Each stage: Keeper voice line, a rotating
3D WITNESS on a lit bench (a bespoke bronze artifact the Keeper cast for
that lock; it carries TRUE engravings that help the riddle but NEVER gates;
full orbit incl. underside), ONE riddle with a typed answer, three free
on-demand hints (third practically answers), letter fragment + where the
real gift hides, then a collect step.
A held-dark heartbeat beat guards the last lock. Finale: the whole letter
read aloud in the Keeper's voice over the music box + 33 CSS candles +
"Happy birthday, Melissa."

Deployed: pushed to main -> Vercel auto-deploys. Latest deployed commit:
64f6d74. SERVICE WORKER IS REMOVED and boot code evicts any old worker and
caches, so a plain refresh always shows the newest build.

## Answers and flow (for the operator, i.e. Miha)

- Stage 1 THE FIELD (mouse mat): riddle answer mat / mouse mat / mousepad /
  pad / podloga. Witness: a bronze woven field with the runner asleep on it.
- Stage 2 THE RUNNER (mouse): mouse / miska / computer mouse. Witness: the
  mouse itself in bronze, scroll wheel and beaded tail.
- Stage 3 THE WAGER (EuroMillions slips): number lock 1993 + 31 + 4 = 2028.
  Witness: a three-sided obelisk engraved 1993 / 31 / IIII, a "+" above
  each: she can literally read the operands off the artifact.
- Stage 4 THE SPARKLE (carbonator): carbonator / aarke / sodastream /
  sparkling water / gazirana voda / soda. Witness: the carbonator in bronze,
  lever down the side, breathing out a rising trail of star-beads. Preceded
  by pin 7 "The Dark" (lights out, 14 s hold, heartbeat, 25 damage).
- Every witness stands on the same engraved catalogue base (front: LOCK
  numeral + stage name; back: THE KEEPER · MCMXCIII; sides: HELD IN TRUST /
  THIRTY THREE YEARS) and its underside carries 33 rim ticks + one tally
  notch per lock. In Items, examining a witness and genuinely rolling it
  over (close + dwell, the existing non-gating reveal) pays off with a
  reveal line. Bench notes per lock live in riddleConfigByPin.benchNote.
- Wrong answers: rotating in-character refusals, shake, small health cost,
  never a lockout. Third wrong plays the Keeper's refusal voice line.
- Reset the game from /dev (dev-only) or the operator panel: hold top-left
  corner 3 s then two taps top-right (resolve/skip pins, set health, reset).

## Where everything lives

- src/pins.ts: THE SETUP BLOCK at the top: HIDING (four hiding-place
  sentences: EDIT THESE FOR THE REAL FLAT), NUMBER_LOCK {1993, 31, 4},
  FRAGMENTS (the four letter quarters), riddleConfigByPin (riddles,
  accepted answers, hints), REFUSAL_LINES, KEEPER_VOICE_BY_PIN.
  Graph: 9 pins (1..9), acts 1-4, win = pin 9.
- src/components/RiddleLock.tsx: the lock screen (bench + input + hints).
- src/components/ActionBeat.tsx: collect steps + the dark beat (threshold).
- src/audio/keeper.ts: Keeper voice player (plain HTMLAudio, unlocked by
  the Begin tap). Clips: public/audio/keeper/keeper-{intro,lock1,lock2,
  lock3,lock4,dark,refuse}.mp3 (Callum, ElevenLabs).
- Finale: src/components/TrophyScreen.tsx (letter + candles + lock4 clip +
  /audio/music/ending.mp3 loop).
- Engine/store/persistence: src/game/* (untouched core; win heals to 100).
- Map: native-scroll viewport src/map/SurveyScroller.tsx wrapping the pure
  SVG art in src/map/SurveyMap.tsx (SurveyMapArt). Zoom +/- / fit / close
  buttons. NEVER reintroduce the old gesture-math viewport.
- 3D: vendored public/vendor/model-viewer.min.js (loaded in index.html).
  THE FOUR BENCH MODELS are bespoke: public/models/witness{Field,Runner,
  Wager,Sparkle}.glb, all built deterministically by
  scripts/build-witnesses.mjs (node script, canvas + @gltf-transform/core;
  rerun it after editing, output is committed). Old stock GLBs (sealcube,
  jar, reliquary, candleLit...) remain on disk but nothing references them.
  tests/witness-models.test.ts locks the contract: bench model === granted
  item model, benchNote required, underside secrets required, bench never
  reads camera angles.
- Tests: npm test (162 green). New test files must be added to
  the explicit list in package.json "test".
- Build: npm run build (tsc -b + vite; tsconfig lib ES2023). No PWA.

## UNCOMMITTED WORK IN THE TREE RIGHT NOW

None. The 2026-07-30 seal-cube relabel edit was reverted: the witnesses
replaced the seal cube on the bench, so the cube is no longer shown
anywhere and the pending relabel became moot.

## Sharp edges learned this week (do not relearn them)

- No service workers ever again; stale caches masked fixes for days.
- No camera/QR, no custom gesture math, no camera-orbit puzzle detection.
- Explicit rgba colours for 3D bench lighting; token blacks are invisible.
- NEVER use em dashes anywhere (Miha's global rule).
- Repo needs core.autocrlf false (byte-exact generated assets).
- Subagents can inherit a stuck plan mode; do downloads inline.
- ElevenLabs: key in ~/.elevenlabs_key (TTS+SFX+music scopes), voice
  Callum N2lVS1w4EtoT3dr4eOWO; edge-tts + ffmpeg exist as local fallback.
- Vercel auto-deploys on push to main.

## Sibling project

C:\Users\mihas\Documents\four-locks: the standalone single-page version
(live at https://mihajlo1993.github.io/four-locks/, repo
mihajlo1993/four-locks). Rejected as too thin; keep as emergency fallback.
Same story, same voice clips, same answers.

## Still on Miha before the night

1. Edit HIDING in src/pins.ts to the real hiding spots (or dictate them).
2. Commit-push (auto-deploy), refresh phone once, play stage 1.
3. Decide on the seal cube relabel (finish or revert the pending edit).
4. Stage the four gifts; lights low; reset from /dev; hand over the phone.
