# AAKASH — portfolio
A static portfolio for a DTU Electronics & Communication Engineering student (2024–2028).
Live: https://aakash9972sn.github.io/aakash-portfolio/

## Add future work
Edit `portfolio-data.js`. Each object becomes a card automatically; category filters, search and counts update from the same data. Projects retain their listed order. Workshops sort newest first by `date`.

For a workshop, add:
```js
{
  id: 'unique-workshop-slug',
  type: 'workshop',
  title: 'Workshop title',
  category: 'Topic area',
  date: 'YYYY-MM-DD',
  dateLabel: 'Dates as shown to visitors',
  organization: 'Workshop organizer',
  description: 'A short, accurate account of what I learned.',
  tags: ['Tool', 'Topic'],
  href: 'workshops/my-workshop/index.html',
  action: 'Explore my learning'
}
```
Create the linked detail page before adding the entry. Use a unique `id` and ISO start date. Omit `artwork` for an automatic initial illustration, or use `guess`, `quiz`, `shop`, `analog`, or `pcb`.

For a project use `type: 'project'`, a playable/live website in `href`, and an action such as `Play game` or `Open website`. Date and organizer are optional. Never use a repository URL as the game’s play link. Hardware projects link to their case-study page. Add an optional `level` (for example `'Foundation project'` or `'System design'`) to show a searchable badge. Artwork options also include `rfid` and `attendance`. The two engineering case studies lead the project collection; the three web projects follow.

## Files
- `index.html`: intro, education, collection structure and illustration templates.
- `portfolio-data.js`: the only file needed to add or edit collection entries.
- `script.js`: cards, search, filters and mobile navigation.
- `style.css` and `collection.css`: base styling and collection layout.
- `site-polish.css`: shared typography, responsive layouts, navigation and visual refinements.
- `site-motion.css` and `site-motion.js`: staggered entrance/reveal effects, hover lighting, desktop depth, reading progress and progressive browser page transitions. Animations respect reduced motion and keep content visible without JavaScript.
- `site-interactions.js`: keyboard-accessible workshop document viewers using native modal dialogs.
- `analog-circuit-analysis-design.html`, `pcb-designing-bootcamp.html`: detailed workshop pages.
- `rfid-card-detection.html` and `smart-id-attendance.html`: engineering case studies, styled by `project-report.css` and `case-study.css`.
- `case-study.js`: section navigation and the sample-data attendance demonstration.
- `tests/attendance.test.cjs`: dependency-free tests for session calculation and reporting boundaries.
- `workshops/`: existing alternate routes retained.
- `assets/`: portrait and workshop material.

Use npm start for the complete Express site plus optional APIs. A basic static HTTP server previews HTML only; it cannot run the AI backend. Collection data uses a regular script so it works without fetching a JSON file. Workshop equations are native MathML; the source TeX is retained in each annotation. Fonts are served locally, so the presentation does not depend on Google Fonts or a CDN.

Run the attendance calculation tests with `node --test tests/attendance.test.cjs`. They cover multiple visits, month boundaries, timezone offsets, missing scans, repeated entries, rejected credentials, independent people and custom reporting windows. Browser verification should also cover search/filter/reset, the mobile menu, all four attendance examples, workshop calculators, note galleries and modal focus restoration.

## Project documentation

The RFID case study is based on the supplied **Professional RFID Report** (21 pages). The Smart ID case study is based on **RFID Project Report Writing**, version 2.0 (25 pages, dated 16 November 2026). Their existing cleaned PDFs remain at `assets/reports/rfid-card-detection-report.pdf` and `assets/reports/smart-id-attendance-report.pdf`.

The pages distinguish circuit and software design from physical validation. No measured read range, latency, scan-success percentage or completed device deployment is claimed. The Smart ID examples use illustrative records and run entirely in the browser; they are not connected to NFC hardware, a real attendance database or a device dashboard. Only completed, unambiguous accepted sessions contribute to confirmed duration. The reports' budget figures are dated planning estimates.

Local fonts use the SIL Open Font License. License files are in `assets/fonts/`. DM Sans and JetBrains Mono are sourced from Fontsource variable packages version 5.3.0; Manrope is included as a Latin variable font. Conceptual project diagrams are inline SVG illustrations, not hardware photographs.

## Publish with GitHub Pages
Commit the changed files to this repository’s `main` branch. GitHub Pages deploys from `main` at the repository root. Wait for the Pages deployment to succeed.

## Content & accessibility
The two workshop entries are dated 13–14 February 2026 (PCB) and 3–4 June 2026 (analog). Existing detailed workshop material is retained. Project artwork is a CSS illustration, not a screenshot. Live project websites are linked directly.

The interface supports keyboard navigation, visible focus, reduced motion, category buttons with pressed state, announced search results and an empty-result reset. Workshop document viewers support Escape, keep focus within the dialog and restore focus to their trigger. Long equations and tables remain scrollable with the keyboard. A no-JavaScript list provides direct links, and the Smart ID page retains a static worked example. Supplied school marksheets are not distributed.

## Project image galleries
Each engineering case study has its own image gallery and full-report reader. `project-gallery.css` and `project-gallery.js` provide responsive photographs, an accessible image dialog, lazy PDF loading and the illustrative RFID decision demo. Source photographs extracted from the supplied PDFs live under `assets/projects/`; captions identify the report and page. They are reference images, not evidence of a personally assembled prototype. The two wiring SVGs are redrawn from the reports and labelled as functional/proposed connections. Generic ESP32 photographs in the report are not presented as ESP32-S3 hardware. The original 21-page and 25-page cleaned reports are preserved.

### Project source downloads

The RFID and Smart ID pages show source code directly with Copy and Download controls. Files live in assets/code/. The UNO sketch is a reference implementation; the ESP32-S3 file is initialization only, with hardware integration pending. The Python file runs with the standard library; the JavaScript file exports the same analytics function used by the interactive case study. Keep the displayed code and downloaded files in sync.

## Portable app architecture

The static pages (Portfolio, Test Centre, Perfect Guess, Blunder, engineering reports and Figure Studio) work on any static host. One shared **public API_BASE_URL** in ai-config.js points them to the Express API or a compatible serverless adapter. Secrets are stored only in backend environment variables.

- server.js plus src/routes/portable-api.js: Gemini multi-turn chat, grounding, image generation/editing, transcription, maps, optional database and user-authenticated writes.
- src/db/index.js + src/db/schema.sql: standard PostgreSQL (Neon, Supabase, Cloud SQL, self-hosted) with parameterized SQL, not a platform-only connector. Schema includes leaderboards, test analytics, future merchant orders and opt-in transcripts.
- src/security/firebase-token.js: verifies Firebase bearer IDs with Google public keys. UID comes from the token, not a user-supplied form field.
- firebase-account.js + firestore.rules: owner-only users/{uid}/testAttempts, generatedSets, preferences, savedAddresses, orders, bookmarks and profile. Firestore is optional and cannot replace the local fallback.
- ai-assistant.js + ai-tools.js: page-role chatbot, history, fast/deep preset, Search Grounding citations, mic Live audio, browser speech and upload transcription.
- figure-studio.html: image creation and reference-image editing; PNG export; labelled offline placeholder diagram when Gemini image access is unavailable.
- src/3d/workbench.js: pinned ESM Three.js conceptual RFID/ESP32-S3 board on engineering pages with copper antenna, real mesh groups, lights, controls, responsive sizing and GPU cleanup. No remote HDR required.
- blunder/location.js: Google Maps JS with restricted **public** browser key or free Leaflet + OpenStreetMap tiles and server-throttled Nominatim. Manual address entry always works.
- **Real Blunder orders remain disabled.** SQL tables and a demo order timeline are not a merchant inventory, payment or delivery system. The backend returns a clear 503 for real checkout.

### 1. Run locally (Node 22+)

~~~bash
git clone https://github.com/aakash9972sn/aakash-portfolio.git
cd aakash-portfolio
npm ci
cp .env.example .env
# Windows: copy .env.example .env
# Put secrets only in .env, not browser code
npm start
~~~

Visit http://localhost:3000/ or /test-centre/, /blunder/, /perfect-guess/, /figure-studio.html. Node reads an optional local .env file using process.loadEnvFile(). Host-supplied environment values take precedence.

~~~bash
npm run build
npm test
npm run lint
node --check workers/api-worker.mjs
~~~

The workflow .github/workflows/portable-ci.yml checks npm ci, build, tests, Worker syntax and secret-file tracking on every push. A syntax check is **not** a substitute for real browser, billing and API-entitlement verification.

### 2. PostgreSQL (optional, portable)

1. Provision any PostgreSQL 14+ URL; put it in DATABASE_URL in the Node host's environment (not in the frontend). Use DATABASE_SSL=require for cloud TLS or DATABASE_SSL=disable for trusted local-only databases.
2. Run npm run db:migrate. src/db/schema.sql uses portable PostgreSQL and ordinary indexes/constraints.
3. GET /api/leaderboard/perfect-guess supports optional public rankings. Without DATABASE_URL it returns available:false; personal best still persists in the browser and Firebase.
4. POST /api/analytics/attempt and /api/transcripts require a signed Firebase token. The transcript endpoint additionally requires explicit consent:true. Chat history is not written to the database automatically.
5. Public leaderboard and submitted analytics are currently **client-reported and not anti-cheat verified**. Do not use for official competition or prizes until scores are verified server-side.

### 3. Firebase Google Sign-In & Firestore Spark

1. firebase-applet-config.json is a public Firebase web config. Firebase Admin service-account keys and private ID tokens must never be committed.
2. Firebase Console → Authentication → Sign-in method → enable Google. Authentication → Settings → Authorized domains → add localhost, **aakash9972sn.github.io**, and any custom hostname. Add only hostnames, never https:// or /aakash-portfolio/.
3. Firestore → Rules → publish the checked-in firestore.rules to the exact database selected in firebase-applet-config.json. **Committing rules to GitHub does NOT deploy them to Firebase.** Firebase CLI deployment also requires checking the selected project and database.
4. Test Google login/profile, Best Guess, Test Centre attempts/sets, preferences/default, and optionally savedAddresses/home on a second device. Generated sets restore via the signed-in account when permissions allow.
5. Blunder saves addresses in cloud only when the user explicitly opts in. Demo orders can store non-sensitive demo summaries. If Firestore is unavailable or Spark quotas are reached, local results and baskets remain usable.
6. Set backend FIREBASE_PROJECT_ID to the project in the public config; signed ID tokens are checked for signature, issuer, audience and expiration.

### 4. Render deployment — full Node experience

1. Push to GitHub and connect this repo as a Render Node 22+ Web Service.
2. Build command: npm ci && npm run build && npm test. Start command: npm start.
3. Configure GEMINI_API_KEY privately and optional DATABASE_URL, FIREBASE_PROJECT_ID, GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_BROWSER_KEY, ENABLE_LIVE_AUDIO and ENABLE_MAPS_GROUNDING.
4. CORS_ORIGIN must be exact origins separated by commas, e.g. https://aakash9972sn.github.io,https://your-domain.example,http://localhost:3000. No wildcard and no repo path.
5. Check HTTPS /api/health and /api/public-config. GOOGLE_MAPS_BROWSER_KEY, if enabled, is returned to the browser **only** when restricted by Google Cloud HTTP referrers and allowed APIs. Keep GOOGLE_MAPS_API_KEY server-only.
6. Enable Live mic only when Gemini Live access is allowed for your key/model and you accept its rate limits and costs.
7. Render free-tier availability, sleeping and pricing may change; verify current terms before relying on 24/7 service.

### 5. Vercel or Cloudflare Workers

**Vercel Node:** api/index.js and vercel.json export/rewrite the same Express application. Set Node 22+ and the same env vars. The persistent /ws/live relay needs a long-running Node host; Vercel function limits may restrict audio or image tasks.

**Cloudflare Workers (reduced adapter):** workers/api-worker.mjs + wrangler.toml implement Gemini REST chat, search grounding, study MCQs/doubts, image generation, transcription and public config without Node. Deploy after setting CORS_ORIGIN and the GEMINI_API_KEY secret:

~~~bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
~~~

The Cloudflare Worker does **not** provide the native Node WebSocket relay, persistent PostgreSQL TCP, authenticated Postgres user data or real checkout. Those routes return clear unavailable errors; use a Node host for full features.

### 6. GitHub Pages frontend

1. Settings → Pages → deploy from main branch/root.
2. Configure the **public** backend address using STATIC_API_ORIGIN in ai-config.js, a window.API_BASE_URL override before shared config loads, or a meta tag with name=api-base-url. On localhost its default is same-origin; on GitHub Pages it defaults to the example Render host.
3. Update Firebase authorized domains, CORS_ORIGIN and Google Maps browser-key referrer restrictions for each actual custom/Pages hostname.
4. Test Test Centre quizzes/reviews and cloud restore, Blunder with and without Google key, Figure Studio PNG, browser voice fallback, grounded citations, 3D scene and Perfect Guess leaderboard on desktop and mobile.
5. Original scanned CUET PDF files uploaded to ChatGPT are **not automatically publicly hosted**. The current PDF viewer stores attached originals in each user's browser.
6. CI verification and a Render LIVE deploy are useful, but neither verifies cloud quotas, Firebase rule publication or visual UI behavior by itself.

### 7. API endpoints and free-tier fallbacks

| Feature | API route | No-key / no-DB behavior |
|---|---|---|
| Multi-turn Gemini chat | /api/ai/chat, /api/ai/chat/stream | Normal pages stay usable |
| Google Search grounding | /api/ai/chat + verifyWithWebSearch:true | Toggle off; never invent citations |
| Figure generation / editing | /api/ai/image | Clearly labelled offline block diagram |
| Audio transcription | /api/ai/transcribe | Browser speech recognition where supported |
| Live WebSocket relay | /ws/live (long-running Node only) | Browser speech / SpeechSynthesis |
| Maps grounding | /api/ai/maps-assist | OSM/Leaflet/manual address |
| Google Maps browser key | /api/maps/config | Leaflet/OSM/Nominatim |
| Community scoreboard | /api/leaderboard/perfect-guess | Local/Firebase private best |
| Exam analytics | /api/analytics/attempt | Existing Firestore/local results |
| Consented transcripts | /api/transcripts | In-memory chat only |
| Real merchant orders | /api/store/orders | Explicitly disabled/demo-only |

The word "free" refers to fallback software, **not** an unlimited guaranteed free vendor API entitlement. Do not make unsupported claims about purchase fulfilment or verified rankings.
