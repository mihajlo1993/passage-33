# Generated assets

Runtime assets under `public/audio`, `public/media`, and `public/ar` are generated locally and committed to Git. The production build only type-checks the app and runs Vite; it does not regenerate assets.

When an asset source changes, run:

```sh
npm run generate:assets
```

The generators require `ffmpeg` on the developer machine for WebP encoding. The production build and Vercel do not need `ffmpeg` because they consume the committed outputs.

After `npm run build`, run `npm run audit:build`. This read-only gate checks the main-chunk and unique-precache budgets and confirms that every required offline runtime asset is in the service-worker manifest.

Generated binaries are protected against accidental replacement. A generator writes a missing file or replaces a file it can positively identify as its own placeholder; it refuses to overwrite other existing assets. To intentionally regenerate a real binary after changing its source, first move the old generated binary somewhere safe or remove that exact output, then run the command and review the resulting Git diff before committing it.

The AR generator exclusively owns `public/ar/textures/creature.webp`; the media generator retains only the keyed `creature.png` provenance output. Missing decorative prop sheets emit warnings and render a labelled print placeholder instead of requesting a missing file.
