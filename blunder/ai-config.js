(() => {
  'use strict';

  const origin = String(window.BLUNDER_AI_API_ORIGIN || window.BLUNDER_API_ORIGIN || (/(^|\.)github\.io$/i.test(location.hostname) ? 'https://aakash-portfolio-g3fb.onrender.com' : '')).replace(/\/+$/, '');

  window.AAKASH_AI = {
    endpoint: `${origin}/api/ai/shop-assistant`,
    app: 'blunder',
    title: 'Blunder Shop Assistant',
    intro: 'Ask about fresh produce, pack sizes, cooking pairings, or delivery around DTU Delhi.',
    suggestions: [
      'Suggest ₹10 picks for a hostel breakfast',
      'What pairs well with bananas and milk?',
      'How does delivery availability work?',
    ],
    privacy: 'Only public catalogue items and your current basket are shared with Gemini for suggestions.',
    context: () => ({
      ...(typeof window.BlunderAIContext === 'function' ? window.BlunderAIContext() : {}),
      cart: typeof window.BlunderAICart === 'function' ? window.BlunderAICart() : [],
    }),
  };
})();
