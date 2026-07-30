# IMAGE GENERATION PACK: "The House Keeps The Count"

START THESE NOW. Drop every finished PNG into `assets-incoming\` with the
EXACT filename given (case-sensitive, .png). I wire everything else. Do the
tiers in order; if you run out of night, Tier 1 and 2 alone carry the look.

## Shared style scaffold

Append this to EVERY prompt below:

> photoreal, cinematic, single warm tungsten practical light source from
> upper left, deep near-black shadows, heavy natural vignette, shallow depth
> of field, dust particles in the air, grimy water-damaged surfaces,
> desaturated warm palette, subtle film grain, 1990s rural decay,
> no people, no text, no logos, no watermark

Negative prompt (if the tool takes one):

> bright, evenly lit, clean, modern, saturated, neon, blue tint, HDR,
> cartoon, illustration, text, watermark

## TIER 1: screen plates (portrait 1080x1920 or taller; will be cover-cropped)

1. `plate-title.png` : A battered 1980s cassette tape recorder on a filthy
   wooden desk, stained coffee mug, scattered cassettes and curling papers,
   one warm desk lamp, everything falling to black at the edges. Keep the
   LOWER THIRD of the frame mostly dark and empty for a wordmark.
2. `plate-corridor.png` : A long narrow domestic corridor at night, bare
   walls with peeling paint, one weak ceiling bulb far away, a door ajar at
   the end with darkness behind it.
3. `plate-bathroom.png` : A small dim bathroom, cracked tiles, a mirror
   fogged at the edges catching a sliver of warm light, dripping tap,
   mould in the corners.
4. `plate-entry.png` : A flat entryway at night, coats hanging like figures,
   a sealed front door with heavy shadows, keys on a hook catching light.
5. `plate-living.png` : A living room lit only by a single table lamp, a
   sofa in half shadow, a tall shelving unit of square compartments almost
   swallowed by darkness.
6. `plate-balcony.png` : A small balcony at night seen from inside through
   a door, a dead potted plant on the ledge, city glow far below, wind-blown
   curtain edge.
7. `plate-kitchen.png` : A dark kitchen, one warm under-cabinet light, an
   old extractor fan casting long blade shadows on the wall, a kettle
   catching a glint.
8. `plate-save.png` : A warm-lit corner with a small table, an old tape
   recorder on it, a green metal footlocker beside it, one hanging bulb,
   dust motes, the rest of the room black.
9. `plate-document.png` : An extremely dark room interior, almost abstract,
   one faint silhouette of a desk and lamp at 10 percent visibility. Must be
   dark enough to read cream text over the whole frame.
10. `plate-credits.png` : A birthday cake with exactly 33 lit candles on a
    dark wooden table, warm candlelight the only light source, genuinely
    beautiful but shot like an old photograph, faint grain.

## TIER 2: item renders (square 1024x1024, object centered on PURE BLACK
background; my pipeline keys the black to transparency; object fills ~70%)

Style line to append for ALL items INSTEAD of the scaffold above:

> studio photograph of a single object on a pure black background, single
> soft key light from upper left at 40 degrees, weak fill, three-quarter
> view rotated about 30 degrees, tilted slightly down, muted desaturated
> colors, worn and aged surfaces, photoreal, no text, no watermark

11. `item-sealcube.png` : A small tarnished bronze cube covered in engraved
    surveyor glyphs, one face blank with a circular depression, corners
    worn bright.
12. `item-jar.png` : A sealed glass specimen jar with a yellowed label,
    containing a bent black wire armature with three arms of different
    lengths, murky preserving fluid.
13. `item-reliquary.png` : A palm-sized dark wooden reliquary box with five
    empty numbered brass slots on its lid and a ring of twelve notches
    around the rim.
14. `item-keycard.png` : An aged laminated clearance card, cream and grey,
    with an embossed edge you can only see at an angle, worn corners.
15. `item-tile.png` : A thick printed cadastral tile card, aged paper on
    board, a room glyph inside a square frame, a small letter in one corner.
16. `item-crest.png` : A circular family crest card ringed by twelve
    segments each bearing a small symbol, one notch cut at the edge, aged
    brass and paper.
17. `item-census.png` : A clipped stack of survey census forms, numbered
    entries, stamped headers, one corner dog-eared.
18. `item-film.png` : A short strip of 35mm film, three frames visible,
    slightly curled, catching the light.
19. `item-tag.png` : A manila luggage tag with a string, aged, one edge
    torn, faint stamped number.
20. `item-recording.png` : A microcassette lying on its case, handwritten
    label peeling at one corner.
21. `item-slips.png` : Two lottery play slips, one marked red and one blue,
    crisp and new, fanned slightly. The ONLY new-looking objects in the set.
22. `item-mat.png` : A rolled desk mat tied with rough string, dark fabric,
    photographed like an artifact.
23. `item-mouse.png` : A modern computer mouse in a sealed evidence bag with
    a paper tag, photographed like a catalogued specimen.
24. `item-carbonator.png` : A tall elegant sparkling water carbonator
    machine, brushed steel, photographed reverently like a museum piece,
    slightly warmer light than the rest.

## TIER 3: paper props (portrait, aged paper photographed on a dark surface;
keep edges inside frame; PURE BLACK background around the paper)

25. `paper-note.png` : A torn lined notebook page, water-stained, creased,
    empty of writing, photographed at a slight angle. 1200x1600.
26. `paper-memo.png` : A blank typed-memo letterhead on aged cream paper,
    stamped header block, one corner folded, coffee ring. 1200x1600.
27. `paper-photo.png` : An aged photo print with a white border, bent
    corner, the image area almost black and indistinct. 1000x1000.

## Delivery

- Filenames EXACT, PNG, into `C:\Users\mihas\Documents\passage-33\assets-incoming\`
- Do not resize or crop; my pipeline does that.
- Ping me as tiers land; I wire them in the order they arrive.
- If a render comes out with text or a watermark, regenerate; I cannot strip it.
