window.AAKASH_AI = {
  endpoint: '/api/ai/chat/stream',
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
