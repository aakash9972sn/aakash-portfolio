# Run the exported AI Studio app

This repository now contains the uploaded AI Studio source, including the portfolio, integrated `/test-centre/`, Gemini server routes, account/profile UI and the matching named Firestore database configuration.

## Local checks

Use Node 22 or later:

```sh
npm ci
npm run build
npm run lint
npm start
```

`npm start` serves the site on port 3000 (or `PORT`). Without a server-side `GEMINI_API_KEY`, pages and practice tests work but AI correctly reports missing configuration. For a local key stored in an ignored `.env`, run `node --env-file=.env server.js`. Never put the Gemini key in browser files or GitHub.

## Hosting

Deploy **this complete repository as a Node service**, using `npm ci` and `npm start`, or the included Dockerfile. Keep `GEMINI_API_KEY` in the host's secret settings. The default model from the export is `gemini-3.1-flash-lite`; `GEMINI_MODEL` can override it for a model your project supports.

GitHub Pages serves the frontend and cannot execute this Node server. Its frontend can call the separately hosted API configured in `backend-config.js`. Pushing source to GitHub does not automatically update an AI Studio/Cloud Run deployment unless a deployment connection has been configured. The running app's public URL must be obtained from its hosting/Publish screen; the GitHub repository URL is not that URL.

On `aakash9972sn.github.io`, `backend-config.js` no longer hardcodes the old AI Studio preview URL. That URL returned HTML instead of the required Gemini API JSON/SSE responses when checked on 21 November 2026. The static GitHub Pages site needs **a real, separately deployed Node server**. Until its public HTTPS origin is set in `window.AAKASH_BACKEND_ORIGIN`, Ask Gemini and Test Centre AI display setup/errors instead of falsely claiming to work. The portfolio content and curated practice tests remain accessible.

To enable Gemini, deploy this repository's `server.js` as a Node 22+ service with private `GEMINI_API_KEY` (eligible free-tier project; do not enable billing merely for this task). Then in the public `backend-config.js` replace the empty `AAKASH_BACKEND_ORIGIN` value with the **origin only**, e.g. `https://your-real-node-server.example`. Never put the key in a browser file, GitHub Actions log or a commit. The server accepts `https://aakash9972sn.github.io` via `ALLOWED_ORIGINS` and serves the existing `/api/health`, `/api/ai/chat/stream`, `/api/ai/study-mcq` and `/api/ai/study-doubt` routes.

A genuine production check needs `/api/health` to return JSON with `configured:true`, **and** a real, successful Gemini chat and question-generation response. A 200 HTML page from a preview URL is not a functional API. No new hosting service, billing account or private credential was provisioned here. The server also accepts the existing GitHub Pages origin `https://aakash9972sn.github.io`. Other approved browser origins can be added via comma-separated `ALLOWED_ORIGINS`. CORS is not authentication or quota protection; configure host-level limits before large public use.

## Firebase

The ZIP specifies a different web app and database from the earlier integration:

- Project: `gen-lang-client-0580718541`
- Web app: `1:714373498331:web:e70b4d1b5059b37f9553fe`
- Database: `ai-studio-aakashportfolio-297b730c-ac6e-46a6-ab26-9a99d1551840`

`firebase-applet-config.json` is public web configuration, not a Gemini secret. `firebase.json` selects the named database for the supplied `firestore.rules`. Check the project/database before publishing rules. Existing remote rules and authorized domains cannot be verified from this workspace. Enable Google sign-in and authorize the actual deployed hostname; include the GitHub Pages hostname only if serving the frontend there.

The account implementation validates fields and document IDs against these rules, supports the Google profile photo and custom avatars, and separates sign-in from cloud-sync failures. No user-data migration or remote Firebase configuration was performed by this source update.

## Acceptance on the deployed host

1. `/api/health` returns JSON with `configured: true` and `provider: "google-gemini"`.
2. Ask the portfolio guide a question and verify a real answer.
3. Generate a short test, complete it and request a solution explanation.
4. Sign in with Google; confirm your profile appears and a bookmark persists after reload.
5. Check the account dialog and test submit controls on a phone.

Local tests exercise real Express routes with injected provider replies where inference is required. They verify CORS, routing, output handling and missing-key behavior. They do not prove live Gemini access or completed Google sign-in.


## Strict ₹0 option: Render Free (manual opt-in, no billing activation)

The repository includes `render.yaml` with a **Render Free** Node web service.
This file does not deploy, register, charge, or connect anything automatically.
Render's published free web-service documentation currently allows a no-card
deployment, subject to free-tier limits, inactivity sleeps, and provider policies.

1. Create/sign into a Render account and connect the GitHub repository
   `aakash9972sn/aakash-portfolio` under **New → Blueprint**.
2. Review `render.yaml`: it explicitly sets `plan: free` and uses
   `npm ci` / `npm start`. Do not select a paid tier or add a payment
   method. Stop if the provider asks for billing to create this service.
3. During the Blueprint creation flow, set **GEMINI_API_KEY** as a private
   secret in Render, using an eligible Google AI Studio free-tier API key.
   Never paste the secret into GitHub, browser JavaScript or this chat.
   `ALLOWED_ORIGINS` already includes `https://aakash9972sn.github.io`.
4. Once Render actually deploys the Express server, take the **real** HTTPS
   `onrender.com` service origin shown by Render (not the GitHub Pages URL,
   not a preview login URL).
5. Visit `https://<actual-render-origin>/api/health`. It must return
   `application/json`, `ok:true`, and `configured:true`.
   This verifies routing/configuration, not whether your API key has valid
   model access.
6. Set `window.AAKASH_BACKEND_ORIGIN` in public `backend-config.js` to
   the real HTTPS origin shown by Render. Do not change other page content.
   Reload the published portfolio with Ctrl+Shift+R.
7. Verify **one real chat answer**, **one generated MCQ set** and
   **one doubt explanation** on the GitHub Pages website. Verify Google login
   separately in Firebase; it is not fixed by hosting the AI server.

This is not a promise of 24/7 availability. Render Free may sleep after
inactivity and may suspend resources under its limits. Gemini's API free-tier
eligibility and quotas are also separate from Render's hosting allowance.
The application should show a useful error when either limit is reached.
