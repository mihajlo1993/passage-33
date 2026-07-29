# Optional AR sprite sources

Pins 3 and 17 use screen-space tap placement. They do not compile or load an
image-tracking database. The QR route already supplies the selected sheet.

The normal final-art path is `assets-incoming/sheet01.png` and
`assets-incoming/sheet02.png`. The generator accepts any valid portrait PNG,
fits the full page inside a 512 by 724 transparent sprite canvas, and embeds it
for offline use.

For a hand-isolated sprite, place one exact source/mask pair here:

```text
sheet01.png       1754 x 2480 opaque source
sheet01-mask.png  1754 x 2480 white subject on black
sheet02.png       1754 x 2480 opaque source
sheet02-mask.png  1754 x 2480 white subject on black
```

A pair in this folder takes priority over the matching incoming full-page art.
Supplying only one half of a pair is an error. With neither source available,
the generator emits a deterministic placeholder so the offline interaction
still completes.

`assets-incoming/creature.png` remains the preferred room-WebXR billboard
source. `monster-source.png` is the optional 1024 by 2048 legacy override in
this folder. Creature black-to-alpha keying remains build-time only.

Run `npm run generate:ar` to update the embedded module or
`npm run generate:ar -- --check` to verify it. No runtime image processing,
network call, target acquisition, or tracking library is used.
