# Local media build

`npm run generate:media` reads the eleven known PNG sources from
`assets-incoming/`. Missing or undecodable files are reported and recorded as
unavailable without stopping the build; the UI uses its text-only fallback.

The processor decodes and redraws every supplied image with the existing
`canvas` runtime, which strips source metadata. It emits local PNG and WebP
files under `public/media/` (the keyed creature lives under
`public/ar/textures/`). Tape stills are always 640 x 360. The app icon source
also regenerates the 192 px and 512 px manifest PNGs.

The installed canvas binary cannot encode WebP directly. The build script
therefore invokes the existing local FFmpeg executable with deterministic
flags. FFmpeg is build-time tooling only: it is never imported or invoked by
the browser, and no media is fetched at runtime. If FFmpeg is unavailable or
cannot encode a source, the processed PNG remains usable, the optional WebP is
omitted, and the generated media record reports the encoder error.
