window.AAKASH_AI = {
  endpoint: 'https://aakash-test-ai.aakashinfinity72.workers.dev',
  app: 'portfolio', title: 'Aakash portfolio guide',
  intro: 'Explore the projects, understand the electronics or find a good place to start.',
  suggestions: ['Which project should I explore first?', 'Explain the two RFID projects', 'What skills are demonstrated here?'],
  context: () => ({
    page: document.title,
    summary: document.querySelector('meta[name="description"]')?.content || '',
    introduction: document.querySelector('.hero-description, .lead-paragraph')?.textContent.trim().slice(0,1500) || '',
    projects: (window.portfolioEntries || []).map(({id,title,category,description,tags,href}) => ({id,title,category,description,tags,href})),
    technicalNotes: [...document.querySelectorAll('.code-walkthrough p, .guide-steps p, #architecture p')].slice(0,10).map(p=>p.textContent.trim().slice(0,550))
  })
};
