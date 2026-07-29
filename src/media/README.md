# Local media build

`npm run generate:media` reads the thirteen known PNG sources from
`assets-incoming/`. Missing or undecodable optional files are reported and
recorded as unavailable without stopping the build.

The processor decodes and redraws every supplied image with the existing
`canvas` runtime, which strips source metadata. It emits local PNG and WebP
files under `public/media/` (the keyed creature lives under
`public/ar/textures/`). Tape stills are always 640 x 360. The app icon source
also regenerates the 192 px and 512 px manifest PNGs.

The `sheet01.png` and `sheet02.png` sources are placed without cropping on
white 1754 x 2480 A4 portrait canvases and emitted as
`public/media/sheet01.{png,webp}` and `sheet02.{png,webp}`. `sheet02.png` is a
required production source: the default repository generate/check run stops
before changing generated output if it is missing, and also rejects a source
that cannot produce the exact 1754 x 2480 PNG/WebP pair. Programmatic calls that use
temporary source directories remain permissive for pipeline fixture tests;
they can opt into the same gate with `requireSheet02: true`.

The installed canvas binary cannot encode WebP directly. The build script
therefore invokes the existing local FFmpeg executable with deterministic
flags. FFmpeg is build-time tooling only: it is never imported or invoked by
the browser, and no media is fetched at runtime. If FFmpeg is unavailable or
cannot encode a source, the processed PNG remains usable, the optional WebP is
omitted, and the generated media record reports the encoder error.
