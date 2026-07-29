# Local media build

`npm run generate:media` reads the thirteen known PNG sources from
`assets-incoming/`. Missing or undecodable optional files are reported and
recorded as unavailable without stopping the build.

The processor decodes and redraws every supplied image with the existing
`canvas` runtime, which strips source metadata. It emits local PNG and WebP
files under `public/media/` (the keyed creature lives under
`public/ar/textures/`). Tape stills are always 640 x 360. The app icon source
also regenerates the 192 px and 512 px manifest PNGs.

The decorative `sheet01.png` and `sheet02.png` print sources are placed
without cropping on white 1754 x 2480 A4 portrait canvases and emitted as
`public/media/sheet01.{png,webp}` and `sheet02.{png,webp}`. A missing prop
sheet never blocks the production build: the repository generate/check run
emits an uppercase `WARNING` naming exactly which sheet IDs will use
placeholders, even in quiet mode, and exits zero unless a separate
runtime-breaking check fails. The AR generator supplies a local sprite
placeholder for each missing sheet. A present but malformed source is not a
placeholder and can still fail the runtime-asset generator. Programmatic calls
using temporary source directories can enable the same warning with
`warnPropSheetPlaceholders: true`.

The installed canvas binary cannot encode WebP directly. The build script
therefore invokes the existing local FFmpeg executable with deterministic
flags. FFmpeg is build-time tooling only: it is never imported or invoked by
the browser, and no media is fetched at runtime. If FFmpeg is unavailable or
cannot encode a source, the processed PNG remains usable, the optional WebP is
omitted, and the generated media record reports the encoder error.
