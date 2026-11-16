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

For a project use `type: 'project'`, a playable/live website in `href`, and an action such as `Play game` or `Open website`. Date and organizer are optional. Never use a repository URL as the game’s play link. Hardware projects without a live site link to their own detail page instead. Add an optional `level` (for example `'Basic'` or `'Real-world use'`) to show a badge on the card; it is also searchable. Artwork options also include `rfid` and `attendance`.

## Files
- `index.html`: intro, education, collection structure and illustration templates.
- `portfolio-data.js`: the only file needed to add or edit collection entries.
- `script.js`: cards, search, filters and mobile navigation.
- `style.css` and `collection.css`: base styling and collection layout.
- `analog-circuit-analysis-design.html`, `pcb-designing-bootcamp.html`: detailed workshop pages.
- `rfid-card-detection.html` (basic) and `smart-id-attendance.html` (real-world use): hardware project pages, styled by `project-report.css`.
- `workshops/`: existing alternate routes retained.
- `assets/`: portrait and workshop material.

No build step or backend is needed. Serve this folder with a static HTTP server, or open `index.html` directly. Collection data uses a regular script so it works without fetching a JSON file. Workshop equations are saved as native MathML with textbook-style fractions, scripts and equation numbers. They work without a CDN or JavaScript; the source TeX is retained in each MathML annotation. Google Fonts is optional.

## Publish with GitHub Pages
Commit the changed files to this repository’s `main` branch. GitHub Pages deploys from `main` at the repository root. Wait for the Pages deployment to succeed.

## Content & accessibility
The two workshop entries are dated 13–14 February 2026 (PCB) and 3–4 June 2026 (analog). Existing detailed workshop material is retained. Project artwork is a CSS illustration, not a screenshot. Live project websites are linked directly.

The interface supports keyboard navigation, visible focus, reduced motion, category buttons with pressed state, announced search results and an empty-result reset. A no-JavaScript list provides direct links. Supplied school marksheets are not distributed.
