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

On `aakash9972sn.github.io`, `backend-config.js` connects both the portfolio and Test Centre to the previously supplied hosted service at `https://ais-pre-wdyrf6yb4psuwizvqpn4hw-374223411049.asia-northeast1.run.app`. On a Node deployment or localhost, they use relative `/api/...` routes. The hosted service must support the documented streaming chat, MCQ and doubt routes; this source update does not redeploy that service. The server also accepts the existing GitHub Pages origin `https://aakash9972sn.github.io`. Other approved browser origins can be added via comma-separated `ALLOWED_ORIGINS`. CORS is not authentication or quota protection; configure host-level limits before large public use.

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
