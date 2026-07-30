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

GitHub main is the release source. Miha deploys through v0 from main. Do not
touch Vercel from this repository. SERVICE WORKER IS REMOVED and boot code
evicts any old worker and caches, so a plain refresh shows the newest build.

## Answers and flow (for the operator, i.e. Miha)

Lock 1 is a typed riddle; locks 2-4 are INTERACTIVE PUZZLES played on the
witness itself (2026-07-30 late rework, per Miha: "not only riddles").

- Stage 1 THE FIELD (mouse mat): typed riddle, answer mat / mouse mat /
  mousepad / pad / podloga. Witness: bronze woven field + sleeping runner.
- Stage 2 THE RUNNER (mouse): TAP PUZZLE on the witness: three hotspots on
  the bronze mouse (Left shoulder, Right shoulder, Wheel). Pattern:
  L, R, R, R, W (one left for the open lock, a right for each of the three
  waiting, the wheel last). Mistap resets the pattern gently.
- Stage 3 THE WAGER (EuroMillions slips): COMBINATION PUZZLE: "Turn the
  witness" button spins the obelisk face to face (1993 / 2 / IIII revealed
  as chips). The 2 is both her birthday date and the date of the game. Four
  brass dial wheels take the sum: 1993 + 2 + 4 = 1999, so set 1 9 9 9 and
  press "Turn the lock".
- Stage 4 THE SPARKLE (carbonator): TESTIMONY PUZZLE: turn the IN, GAS, and
  OUT shutters until the witness says STILL WATER / SILVER BREATH / STARS,
  press "Test the witness", then name it CARBONATOR from three plates. The
  seven cast stars remain visible evidence. Preceded by pin 7 "The Dark"
  (lights out, 14 s hold, heartbeat, 25 dmg).
- All puzzles: 3 free hints; the THIRD hint makes the next correct touch
  GLOW (no hard-stall possible); wrong actions rotate refusal lines and
  tick health; a witness model that fails to load degrades to plain
  buttons so the lock is always solvable. NO camera-angle detection
  anywhere; hotspots are explicit taps (src/components/WitnessPuzzles.tsx,
  anchors mirror scripts/build-witnesses.mjs geometry; change together).
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
  sentences: EDIT THESE FOR THE REAL FLAT), NUMBER_LOCK {1993, 2, 4},
  FRAGMENTS (the four letter quarters), riddleConfigByPin (riddles,
  accepted answers, hints), REFUSAL_LINES, KEEPER_VOICE_BY_PIN.
  Graph: 9 pins (1..9), acts 1-4, win = pin 9.
- src/components/RiddleLock.tsx: the lock screen (bench + input + hints).
- src/components/ActionBeat.tsx: collect steps + the dark beat (threshold).
- src/audio/keeper.ts: Keeper voice player (plain HTMLAudio, primed by the
  Begin tap). The tap that opens /trophy starts lock4 directly and reports
  refusal so the letter can show a visible retry. Clips:
  public/audio/keeper/keeper-{intro,lock1,lock2,lock3,lock4,dark,refuse}.mp3.
- Finale: src/components/TrophyScreen.tsx. The letter is read aloud WORD BY
  WORD (LetterReading component): FRAGMENTS as the formal quarters, then
  LETTER_CODA (src/pins.ts) where the mask comes off: proud of her, deep
  love, "the world should fear her", and THE REVEAL: the Keeper is Miha.
  The recorded reading public/audio/keeper/keeper-lock4.mp3 was REGENERATED
  (ElevenLabs Callum, 93.6 s) to speak fragments + coda; LETTER_READ_MS in
  TrophyScreen.tsx must equal its duration (TTS text says "Mee-ha" so the
  name lands right; display text says Miha). Words follow the voice, her
  scroll always wins, candles + "Happy birthday, Melissa." light after the
  last word, and the house goes quiet ONLY via the "Put the letter down"
  button (an auto-quiet timer once ate the letter after 2 s; never again).
  The letter is a full-screen document with app chrome hidden. If Chrome
  refuses playback, "READ THE LETTER ALOUD" retries from a visible control.
  The coda never leaks early: the Letter tab shows fragments only.
- Lock screens: the bench flex-grows; "Give the witness room" tucks the
  instruction + hints away so the 3D canvas dominates ("Show the words"
  brings them back).
- Map: named gifts appear as amber marks when their lock opens and settle
  with a check once collected (GIFT_MARKS in src/map/SurveyMap.tsx; keep in
  step with HIDING in src/pins.ts and with HIDING-MAP.html, the standalone
  operator sketch of all four hiding spots at the repo root).
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
- Tests: npm test (168 green). New test files must be added to
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
- Miha deploys through v0 from GitHub main. Do not touch Vercel here.

## Sibling project

C:\Users\mihas\Documents\four-locks: the standalone single-page version
(live at https://mihajlo1993.github.io/four-locks/, repo
mihajlo1993/four-locks). Rejected as too thin; keep as emergency fallback.
Same story, same voice clips, same answers.

## Still on Miha before the night

1. Edit HIDING in src/pins.ts to the real hiding spots (or dictate them),
   and keep GIFT_MARKS (SurveyMap.tsx) + HIDING-MAP.html in step.
2. Push to GitHub main; MIHA DEPLOYS VIA v0 (never touch Vercel from here);
   refresh phone once, play stage 1.
3. Stage the four gifts per HIDING-MAP.html; lights low; reset from /dev;
   hand over the phone.
