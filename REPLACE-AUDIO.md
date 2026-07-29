# Replace the five Host voice files

Put the five finished files directly in:

`public/audio/voice/`

Required format for every file:

- MP3
- mono
- 44.1 kHz sample rate

Required filenames:

- `cold-open.mp3`
- `tape.mp3`
- `draught.mp3`
- `trophy.mp3`
- `present.mp3`

Replace the placeholder with the matching filename; do not rename the files
or add numbered variants.

After copying all five files, refresh the deterministic manifest metadata and
then inspect the measured audio:

```text
npm run generate:audio
npm run report:audio
```

The report prints each file's measured duration and whether it still appears
to be the silent placeholder. Do not continue to the deployment build until
all five entries report real, non-silent audio. Then run:

```text
npm test
npm run build
```
