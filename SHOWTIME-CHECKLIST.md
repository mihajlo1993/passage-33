# SHOWTIME CHECKLIST (for Miha, before the night)

The branch is feat/showtime. Nothing is pushed; you review, test, merge.

## 1. Local smoke test on the PC

- [ ] `npm install` (one new dependency: @fontsource/im-fell-english, the
      self-hosted serif; jsqr/qrcode stay for the scanner routes)
- [ ] `npm test` (all suites green; 131 tests)
- [ ] `npm run build` then `npm run audit:build` (prints bucket subtotals;
      cinema subtotal must be under 60MB; it ships at ~17.8MB)
- [ ] `npm run preview`, open http://127.0.0.1:4173 on the PC
- [ ] Open DevTools console: zero errors on load and while playing

## 2. Get it onto the Flip 6

- [ ] Either test over the LAN first: `npm run dev` and open the PC's
      LAN address on the phone, or merge to main and deploy through v0
      as always (never touch Vercel from this repo)
- [ ] On the phone, open the site in Chrome, then Add to Home Screen so
      it launches full screen
- [ ] IMPORTANT (no service worker by design): after deploying, open the
      app once on the phone WITH network so Chrome caches everything,
      and keep that tab alive. True airplane-mode cold start of a fresh
      tab cannot be guaranteed without a service worker; test it once:
      airplane mode on, reopen the installed app, confirm it loads. If
      it does not, keep the phone online that night (the deploy is
      private; nothing else needs the network).

## 3. Full run, start to letter (reset from /dev first)

- [ ] Cold open reads THE KEEPER'S FOUR LOCKS; Begin plays the intro voice
- [ ] Chrome stays fixed: header (seals) and the four tabs never scroll
      away on any screen; no double scrollbars anywhere
- [ ] Lock I: one tap (Face the lock) opens the bench + typed riddle;
      wrong answers rotate refusals, third wrong plays the Keeper's
      refusal voice; brass input reads engraved
- [ ] Collect steps: ONE press-and-hold (1.2s) on the home screen, with
      the shimmer on the track and a haptic pulse at completion;
      releasing early resets silently
- [ ] Seal I cracks in the header the moment the lock resolves; then II,
      III, IV in order
- [ ] Map tab: whole flat visible at fit on the phone; pinch zooms around
      your fingers; double-tap toggles fit/2x; active room pulses
      crimson, released rooms slate, unreached rooms near-invisible;
      gift marks appear only after their lock opens; usable at 20%
      screen brightness in a dark room
- [ ] Lock II: L R R R W on the runner; correct taps flash softly
- [ ] Lock III: Turn the witness tweens the camera; operands stamp; the
      brass wheels step with weight and auto-repeat on a long press;
      1 9 9 9 opens it
- [ ] The Dark (pin 7): single tap arms it; 14s in the dark; the
      operator gesture (hold top-left 3s, two taps top-right) exposes
      SKIP CURRENT SCARE and it works mid-beat
- [ ] Lock IV, THE THREE VERBS: hold the mouth to POUR (gauge fills,
      2s), hold the lever to CHARGE (2.5s, pulsing haptics), one tap to
      RELEASE (33 stars rise); then type CARBONATOR; hint 3 names it;
      with the model broken (rename the .glb to test) plain HOLD/TAP
      buttons appear
- [ ] Pin 9: press-and-hold 'I have it. Read me the letter.', then OPEN
      THE LETTER

## 4. The finale film

- [ ] The film starts full-bleed and silent as the Keeper begins reading;
      the poster shows instantly before the video warms
- [ ] Words ride the lower-third band in sync with the voice; quarters in
      Courier, the coda switching to the serif with a drop cap as the
      mask comes off; your scroll takes over and stays yours
- [ ] The film ends on the candle shot and HOLDS (no loop, no black)
- [ ] As the last words land: candles row, 'Happy birthday, Melissa.'
      and 'Put the letter down' fade in over the held frame; music box
      keeps playing
- [ ] 'Put the letter down' quiets the house and stays quiet
- [ ] LETTER tab afterwards: the Chronicle card (The Letter, whole)
      replays film + narration from the start

## 5. Resilience

- [ ] Kill the app mid-game and reopen: it resumes at the same entry
- [ ] Rotate/notification interruptions during the letter: narration
      continues; if Chrome blocked audio, READ THE LETTER ALOUD appears
      and restarts both
- [ ] Reset from /dev (dev builds) or the operator panel before handing
      over the phone

## 6. Before she arrives

- [ ] HIDING texts in src/pins.ts still match the real flat (they were
      not touched); stage the four gifts per HIDING-MAP.html
- [ ] Lights low, sound on, phone charged, Do Not Disturb on
- [ ] Reset the run; leave the cold open on the screen
