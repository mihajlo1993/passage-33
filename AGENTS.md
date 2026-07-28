# Baker House Seven repository rules

- The app must run in airplane mode. No runtime fetch, no CDN, no remote call.
  If a feature cannot work offline it does not ship.
- Chrome on Android only. Portrait, approximately 390x844, one hand. No iOS
  fallbacks, no desktop layout.
- src/tokens.ts is the only source of colour, type, spacing, and motion. Zero
  hex literals anywhere else.
- Pin TypeScript 5.9.3 and Three 0.160.x. Never use latest.
- Adding a dependency requires stating it and why.
- Budget: mid-range Android, 40 minutes, camera active. If a technique cannot
  hold 30fps sustained, do not ship it; say so.
- Never drive a browser or take over input to verify. Use builds, Node tests,
  and source scans only. Report unverified items.
- Design law: every surface is a physical object she is holding, not a game
  menu. No rounded floating cards, no drop shadows for depth, no pill buttons,
  no emoji, no bright accents, no spring or bounce easing. Heavy, mechanical,
  tired. If a screen would look at home in a casual mobile game, it is wrong.
- The Host voice is whoever set this up. He is delighted and over-familiar,
  treating a lethal trap as a party he went to great trouble to arrange. He
  never explains a puzzle directly. He congratulates her for things she has
  not done yet. He refers to a previous guest in the past tense without ever
  saying what happened. He knows it is her birthday and will not stop
  mentioning it. He is never cruel about her specifically and never crude.
  His sentences are short.

These rules apply to every later session and every file in this repository.
