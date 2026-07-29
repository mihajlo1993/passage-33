# Human deployment checklist

Codex does not deploy this project. Deployment must be run interactively by
the project owner so the Vercel account scope can be checked by a human.

## Before opening Vercel

1. Open a terminal in the repository root.
2. Install the locked dependencies with `npm install`. Do not use
   `npm ci` for this repository.
3. Replace and verify the five Host voice files by following
   `REPLACE-AUDIO.md`.
4. Run `npm test`.
5. Run `npm run build`.
6. Confirm that both commands pass and that the static output is in `dist/`.

## Interactive Vercel deployment

1. In a browser, sign in to the Vercel account that owns this personal
   project.
2. Check the account switcher before creating or importing anything.
3. Select the **PERSONAL account**. Never select a work team or company
   scope.
4. Create a new project by importing this repository in the Vercel dashboard.
5. If Vercel asks for the account or team scope, choose the **PERSONAL
   account** again.
6. Keep the repository defaults. `vercel.json` supplies:
   - build command: `npm run build`
   - output directory: `dist`
   - SPA rewrite: every client route to `/index.html`
7. Review the final project owner/scope shown by Vercel before confirming the
   deployment.
8. Cancel immediately if any work team appears as the owner.

## After the human deployment

Install the PWA on the target Android phone while online. Then, before the
event, perform a cold start in airplane mode and hard-reload every route used
by the game. This device test cannot be replaced by the Node and build gates.
