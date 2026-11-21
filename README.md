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

No build step, package installation or backend is needed. To preview locally, run `python3 -m http.server 8000` from the repository root. Collection data uses a regular script so it works without fetching a JSON file. Workshop equations are native MathML; the source TeX is retained in each annotation. Fonts are served locally, so the presentation does not depend on Google Fonts or a CDN.

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

## AI portfolio guide

The Ask AI panel is available on the home page and project/workshop pages. It uses
the public project registry and selected published technical notes; it does not
read demo attendance records or browser storage. Questions and public context go
to the Cloudflare endpoint in `ai-config.js` only when the visitor asks. Responses
are displayed as plain text and chat history is kept in memory.

The shared Worker at `aakash9972sn/newTest/worker/src/index.js` requires deployment
of its version 2 `assistant` action. This workspace cannot deploy it without the
owner's Cloudflare login. The endpoint URL being configured does not prove live
service availability. See that repository's `AI-SETUP.md` for exact dashboard/CLI
steps. Core navigation continues to work when AI is unavailable.
