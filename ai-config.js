/* Public deployment config, shared by ALL pages.
 * Set window.API_BASE_URL before this script (or change STATIC_API_ORIGIN).
 * An API URL is public; Gemini/Maps SERVER keys stay in backend .env only.
 * Empty string = same-origin npm start. No vendor-specific SDK required.
 */
(() => {
  const STATIC_API_ORIGIN = 'https://aakash-portfolio-g3fb.onrender.com';
  const staticHost = /(^|\.)github\.io$|\.pages\.dev$/i.test(location.hostname);
  const configured = window.API_BASE_URL ?? document.querySelector('meta[name="api-base-url"]')?.content;
  const choice = String(configured == null ? (staticHost ? STATIC_API_ORIGIN : '') : configured).trim().replace(/\/+$/,'').replace(/\/api$/,'');
  if (choice && (!/^https:\/\//i.test(choice) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(choice))) {
    console.error('API_BASE_URL must be HTTPS, or local HTTP on localhost.');
    window.API_BASE_URL = '';
  } else {
    window.API_BASE_URL = choice;
  }
})();
window.AAKASH_AI = {
  endpoint: `${window.API_BASE_URL}/api/ai/chat/stream`,
  app: 'portfolio',
  title: 'Aakash AI Guide',
  intro: 'Ask about my DTU ECE projects, circuit notes, or where to start.',
  suggestions: [
    'Which project should I explore first?',
    'Explain the two RFID projects',
    'What skills are demonstrated here?',
  ],
  context: () => ({
    page: document.title,
    summary: document.querySelector('meta[name="description"]')?.content || '',
    introduction:
      document
        .querySelector('.hero-description, .lead-paragraph, .hero-description-prose, .report-lede')
        ?.textContent.trim()
        .slice(0, 600) || '',
    projects: (window.portfolioEntries || []).map(({ id, title, category, description, tags, href }) => ({
      id,
      title,
      category,
      description: String(description || '').slice(0, 140),
      tags,
      href,
    })),
    technicalNotes: [...document.querySelectorAll('.code-walkthrough p, .guide-steps p, #architecture p, .about-prose p')]
      .slice(0, 5)
      .map((p) => p.textContent.trim().slice(0, 260)),
  }),
};
