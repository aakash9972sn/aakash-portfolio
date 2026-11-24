/* Post-test bridge to the existing Aakash Assistant.
   Reuses the working shared AI chat: no second model call or duplicate backend.
   The result/answer prompts are prepared after submission only. */
(function () {
  'use strict';

  const truncate = (value, max) => String(value == null ? '' : value).slice(0, max);
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function analysisPrompt(result) {
    const topics = Object.entries(result.topics || {})
      .map(([name, t]) => ({ name, wrong: Number(t.wrong) || 0, skipped: Number(t.unattempted) || 0,
        correct: Number(t.correct) || 0 }))
      .sort((a, b) => (b.wrong * 2 + b.skipped) - (a.wrong * 2 + a.skipped));
    const weak = topics.slice(0, 6).map((t) =>
      truncate(t.name, 35) + ' (' + t.correct + ' right, ' + t.wrong +
      ' wrong, ' + t.skipped + ' skipped)').join('; ');
    return [
      'Analyze my COMPLETED ' + truncate(result.exam, 24) + ' ' +
        truncate(result.subject, 40) + ' test. Use only the numbers below.',
      'Score: ' + result.score + '/' + result.total + '.',
      'Accuracy: ' + result.accuracy + '%.',
      'Correct ' + result.correct + ', wrong ' + result.wrong +
        ', skipped ' + result.unattempted + '.',
      'Weak topics: ' + (weak || 'not available') + '.',
      'Give my top 3 priorities and a short, practical revision plan.',
      'Do not invent timing data.'
    ].join(' ').slice(0, 700);
  }

  function getQuestionDetails(q, selected) {
    const optionLetters = ['A', 'B', 'C', 'D'];
    return {
      chosen: Number.isInteger(selected) && q.o[selected] ? optionLetters[selected] + '. ' + q.o[selected] : 'Not attempted',
      correct: q.unscored ? 'Disputed / review-only' : optionLetters[q.a] + '. ' + q.o[q.a],
    };
  }

  function makeReviewPrompt(result, questions) {
    const topics = Object.entries(result.topics || {}).map(([name, item]) =>
      name + ': ' + Number(item.correct || 0) + ' right, ' +
      Number(item.wrong || 0) + ' wrong, ' + Number(item.unattempted || 0) + ' skipped');
    return [
      'Analyze this completed ' + truncate(result.exam, 35) + ' ' + truncate(result.subject, 50) + ' test.',
      'Score ' + result.score + '/' + result.total + ', accuracy ' + result.accuracy +
        '%, correct ' + result.correct + ', wrong ' + result.wrong + ', skipped ' + result.unattempted + '.',
      'Topic performance: ' + topics.join('; ').slice(0, 1000),
      'Wrong/skipped question topics: ' + questions.filter((q, i) => q.unscored !== true &&
        result.responses[i] !== q.a).map((q) => q.t || 'General').slice(0, 25).join(', '),
      'Give a practical revision plan, weak concepts, and priorities. Do not invent timing, missing answers, or question details.'
    ].join('\n');
  }

  function getUnit(q, subjectId, examId) {
    if (q.unit && typeof q.unit === 'string' && !/^Full /i.test(q.unit)) return q.unit;
    const registry = window.TEST_CENTRE_SYLLABI || {};
    const item = registry[examId]?.subjects?.[subjectId];
    const topic = String(q.t || '').trim().toLowerCase();
    if (!topic || !item?.units) return 'Unit not tagged';
    // Only assign when the question topic is an unambiguous title/topic match.
    const hits = item.units.filter(u => {
      const title = u.title.toLowerCase().replace(/^unit \d+:\s*/, '').trim();
      return topic === title || u.topics.toLowerCase().split(/[,;]/).some(v => v.trim() === topic);
    });
    return hits.length === 1 ? hits[0].title : 'Unit not tagged';
  }

  function groupsFor(result, questions) {
    const units = new Map(), topics = new Map();
    questions.forEach((q, i) => {
      const status = q.unscored ? 'excluded' : !Number.isInteger(result.responses[i])
        ? 'skipped' : result.responses[i] === q.a ? 'correct' : 'wrong';
      const unit = getUnit(q, result.subjectId, result.examId);
      const topic = String(q.t || 'Topic not tagged');
      [[units, unit], [topics, topic]].forEach(([map, label]) => {
        if (!map.has(label)) map.set(label, { correct:0, wrong:0, skipped:0, excluded:0, total:0 });
        const obj = map.get(label);
        obj[status]++; obj.total++;
      });
    });
    return {units, topics};
  }

  function statTable(title, map) {
    const sorted = [...map].sort((a,b) => (b[1].wrong+b[1].skipped)-(a[1].wrong+a[1].skipped));
    return '<div class="ai-report-table-wrap"><h4>' + esc(title) + '</h4><table class="ai-report-table">' +
      '<thead><tr><th>Unit / topic</th><th>Total</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Review only</th></tr></thead><tbody>' +
      sorted.map(([name,v]) => '<tr><th>' + esc(name) + '</th><td>' + v.total + '</td><td>' + v.correct +
        '</td><td>' + v.wrong + '</td><td>' + v.skipped + '</td><td>' + v.excluded + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  function summarize(result, questions) {
    const groups = groupsFor(result, questions);
    return {
      units: Object.fromEntries(groups.units),
      topics: Object.fromEntries(groups.topics)
    };
  }

  function compactStats(label, rows) {
    if (!rows || typeof rows !== 'object') return '';
    return '<details class="ai-history-stats"><summary>' + esc(label) + '</summary>' +
      statTable(label, new Map(Object.entries(rows))) + '</details>';
  }

  function dailyHistory() {
    try {
      const rows = JSON.parse(localStorage.getItem('tclab.analysis.history.v1') || '[]');
      const uid = window.AakashAccount?.getState()?.uid || null;
      return Array.isArray(rows) ? rows.filter(row => row && (row.ownerUid || null) === uid) : [];
    } catch { return []; }
  }

  function reviewLink(item) {
    if (item.gate) {
      const {mode, set, year, attempt} = item.gate;
      const query = new URLSearchParams({mode, set, year, attempt});
      return '<a href="gate-test.html?' + esc(query) + '">Review this attempt</a>';
    }
    return item.testId ? '<a href="#/r/' + encodeURIComponent(item.testId) + '">Review latest result</a>' : '';
  }

  function dailyHTML() {
    const entries = dailyHistory().slice().sort((a,b)=>b.at-a.at);
    if (!entries.length) return '<p>No saved daily attempts yet.</p>';
    const grouped = new Map();
    entries.forEach(entry => {
      const date = new Date(entry.at).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'});
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(entry);
    });
    return [...grouped].map(([date, items]) =>
      '<h4>' + esc(date) + ' · ' + items.length + ' attempt(s)</h4>' +
      '<div class="ai-daily-attempts">' + items.map(item =>
        '<div><b>' + esc(item.title || item.testId) + '</b><span>' +
        esc(item.subject || '') + ' · ' + item.correct + ' correct, ' + item.wrong +
        ' wrong, ' + item.unattempted + ' skipped · ' + item.accuracy + '%</span>' +
        reviewLink(item) +
        compactStats('Unit-wise scores',item.unitStats) + compactStats('Topic-wise scores',item.topicStats) +
        '</div>').join('') + '</div>').join('');
  }

  function askAssistantAboutQuestion(q, selected, result) {
    const assistant = window.AakashAssistant;
    if (!assistant || typeof assistant.open !== 'function') {
      alert('AI Assistant is still loading. Refresh and retry.');
      return;
    }
    const letters = ['A', 'B', 'C', 'D'];
    const selectedText = Number.isInteger(selected) && q.o[selected]
      ? letters[selected] + '. ' + q.o[selected] : 'Not attempted';
    const keyText = q.unscored ? 'Disputed; do not assume a correct key'
      : letters[q.a] + '. ' + q.o[q.a];
    const prompt = [
      'Help me understand this completed ' + String(result.exam || '') + ' ' +
        String(result.subject || '') + ' MCQ. Check the stored key and explain the concept.',
      'Question: ' + String(q.q || '').slice(0, 240),
      ...q.o.map((o, i) => letters[i] + ': ' + String(o).slice(0, 65)),
      'My selected answer: ' + selectedText.slice(0, 85),
      'Stored answer: ' + keyText.slice(0, 85),
      'Explain clearly and answer any follow-up.'
    ].join('\n').slice(0, 700);
    assistant.open(prompt);
  }

  function mount(result, questions = []) {
    const host = document.querySelector('#result-body');
    if (!host) return;
    const previous = host.querySelector('#ai-study-coach');
    if (previous) previous.remove();
    const panel = document.createElement('section');
    panel.className = 'ai-study-coach';
    panel.id = 'ai-study-coach';
    panel.innerHTML =
      '<div class="ai-coach-title"><h3>AI Result Review</h3>' +
      '<span>Daily performance dashboard</span></div>' +
      '<p>Review every question, your selected option, the stored answer key and the explanation here on this page. ' +
      'Option-by-option Gemini explanations are requested only when you press their buttons. ' +
      'AI can make mistakes; disputed source keys are not treated as verified.</p>' +
      '<button type="button" class="btn btn-primary" id="ai-analyze">Open AI analysis</button>' +
      '<div class="ai-coach-output" id="ai-analysis-output" hidden aria-live="polite"></div>' +
      '<div id="ai-review-workspace" hidden>' +
      '<div class="ai-review-modebar" role="group" aria-label="Review display mode">' +
      '<button type="button" class="ai-review-mode is-active" data-mode="list" aria-pressed="true">Vertical review</button>' +
      '<button type="button" class="ai-review-mode" data-mode="focus" aria-pressed="false">Test-style review</button></div>' +
      '<div id="ai-review-navigation" class="ai-review-navigation" hidden>' +
      '<button type="button" id="ai-review-prev">← Previous</button>' +
      '<button type="button" id="ai-review-palette-toggle" aria-expanded="false" aria-controls="ai-review-palette">Question Palette</button>' +
      '<button type="button" id="ai-review-next">Next →</button></div>' +
      '<div id="ai-review-palette" class="ai-review-palette" hidden>' +
      '<div class="ai-review-palette-head"><b>Jump to question</b><button type="button" id="ai-review-palette-close" aria-label="Close question palette">×</button></div>' +
      '<div class="ai-review-palette-grid" id="ai-review-palette-grid"></div></div>' +
      '<div id="ai-inline-questions" class="ai-inline-questions"></div></div>' +
      '<details class="ai-daily-history"><summary>Daily attempt history</summary><div id="ai-daily-history-list"></div></details>';
    host.appendChild(panel);

    const button = panel.querySelector('#ai-analyze');
    const output = panel.querySelector('#ai-analysis-output');
    const workspace = panel.querySelector('#ai-review-workspace');
    const review = panel.querySelector('#ai-inline-questions');
    const navigation = panel.querySelector('#ai-review-navigation');
    const palette = panel.querySelector('#ai-review-palette');
    const paletteGrid = panel.querySelector('#ai-review-palette-grid');
    const paletteToggle = panel.querySelector('#ai-review-palette-toggle');
    const paletteClose = panel.querySelector('#ai-review-palette-close');
    const closePalette = () => {
      palette.hidden = true;
      paletteToggle.setAttribute('aria-expanded', 'false');
    };
    paletteToggle.addEventListener('click', () => {
      palette.hidden = !palette.hidden;
      paletteToggle.setAttribute('aria-expanded', String(!palette.hidden));
    });
    paletteClose.addEventListener('click', closePalette);
    const prev = panel.querySelector('#ai-review-prev');
    const next = panel.querySelector('#ai-review-next');
    let mode = 'list';
    let activeQuestion = 0;
    function updateMode() {
      const cards = [...review.querySelectorAll('.ai-inline-question')];
      const focus = mode === 'focus';
      review.classList.toggle('is-focus', focus);
      navigation.hidden = !focus;
      panel.classList.toggle('is-test-review', focus);
      document.querySelector('aakash-assistant')?.toggleAttribute('data-review-active', focus);
      if (!focus) closePalette();
      cards.forEach((card, index) => { card.hidden = focus && index !== activeQuestion; });
      paletteGrid.querySelectorAll('button').forEach((btn, index) => {
        btn.classList.toggle('is-current', index === activeQuestion);
        btn.setAttribute('aria-current', index === activeQuestion ? 'step' : 'false');
      });
      prev.disabled = activeQuestion === 0;
      next.disabled = activeQuestion >= cards.length - 1;
      panel.querySelectorAll('[data-mode]').forEach(btn => {
        const selected = btn.dataset.mode === mode;
        btn.classList.toggle('is-active', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
    }
    panel.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      updateMode();
      review.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    prev.addEventListener('click', () => { activeQuestion = Math.max(0, activeQuestion - 1); updateMode(); });
    next.addEventListener('click', () => {
      activeQuestion = Math.min(review.querySelectorAll('.ai-inline-question').length - 1, activeQuestion + 1);
      updateMode();
    });
    panel.querySelector('#ai-daily-history-list').innerHTML = dailyHTML();
    let opened = false;
    function revealReview() {
      if (opened) {
        review.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      opened = true;
      button.textContent = 'View question analysis';
      workspace.hidden = false;
      const letters = ['A', 'B', 'C', 'D'];
      const fragment = document.createDocumentFragment();
      questions.forEach((q, i) => {
        if (!q || !Array.isArray(q.o) || q.o.length !== 4) return;
        const selected = result.responses[i];
        const details = getQuestionDetails(q, selected);
        const article = document.createElement('article');
        article.className = 'ai-inline-question';
        const options = q.o.map((option, j) => {
          const tags = [];
          if (selected === j) tags.push('<strong>Your choice</strong>');
          if (!q.unscored && q.a === j) tags.push('<strong>Correct answer</strong>');
          const correct = !q.unscored && q.a === j;
          const incorrectChoice = !q.unscored && selected === j && q.a !== j;
          return '<li class="' + (correct ? 'is-answer ' : '') +
            (incorrectChoice ? 'is-incorrect-choice ' : '') +
            (q.unscored && selected === j ? 'is-selected ' : '') + '">' +
            '<span class="ai-option-letter">' + letters[j] + '</span><span>' + esc(option) + '</span>' +
            (tags.length ? '<small>' + tags.join(' · ') + '</small>' : '') + '</li>';
        }).join('');
        article.innerHTML =
          '<h4>Q' + (i + 1) + '. ' + esc(q.q) + '</h4>' +
          '<ul class="ai-inline-options">' + options + '</ul>' +
          '<p><b>Your answer:</b> ' + esc(details.chosen) + '</p>' +
          '<p><b>' + (q.unscored ? 'Answer key status:' : 'Stored correct answer:') + '</b> ' + esc(details.correct) + '</p>' +
          '<p><b>Existing explanation:</b> ' + esc(q.e || 'No saved explanation.') + '</p>' +
          (q.unscored ? '<p><b>Source warning:</b> Disputed answer key; excluded from scoring. ' +
            esc(q.sourceAnswer || '') + '</p>' : '') +
          '<div class="ai-review-actions">' +
          '<button type="button" class="ai-short-explanation-btn" aria-expanded="false">Explanation</button>' +
          '<button type="button" class="ai-ask-bot-btn">Ask AI</button>' +
          '</div>' +
          '<div class="ai-review-short-explanation" hidden></div>' +
          '<div class="ai-review-detailed">' +
          '<button type="button" class="btn-ai-doubt">Explain all four options with Gemini</button>' +
          '<div class="ai-coach-output" hidden aria-live="polite"></div></div>';
        if (typeof q.image === 'string' && /^media\/[\w/-]+\.svg$/.test(q.image)) {
          const figure = document.createElement('figure');
          figure.className = 'pyp-question-figure';
          const img = document.createElement('img');
          img.src = q.image;
          img.alt = q.imageAlt || 'Original question diagram';
          img.loading = 'lazy';
          figure.appendChild(img);
          article.querySelector('h4')?.insertAdjacentElement('afterend', figure);
        }
        if (window.PYPSource?.exists(result.testId)) {
          const original = document.createElement('button');
          original.type = 'button';
          original.className = 'pyp-review-original-btn';
          original.textContent = 'View original PDF · Q' + (i + 1);
          original.addEventListener('click', () => window.PYPSource.open(result.testId, i + 1));
          article.querySelector('.ai-review-actions')?.appendChild(original);
        }
        const shortButton = article.querySelector('.ai-short-explanation-btn');
        const shortPanel = article.querySelector('.ai-review-short-explanation');
        shortPanel.textContent = q.unscored
          ? 'Source answer key is disputed. ' + (q.sourceAnswer || q.e || 'Review independently before relying on this answer.')
          : (q.e || 'No saved explanation for this question. Use Ask AI for a walkthrough.');
        shortButton.addEventListener('click', () => {
          shortPanel.hidden = !shortPanel.hidden;
          shortButton.setAttribute('aria-expanded', String(!shortPanel.hidden));
        });
        article.querySelector('.ai-ask-bot-btn').addEventListener('click', () =>
          askAssistantAboutQuestion(q, selected, result));
        const explainButton = article.querySelector('.btn-ai-doubt');
        explainButton.setAttribute('aria-expanded', 'false');
        const explanation = article.querySelector('.ai-review-detailed .ai-coach-output');
        explainButton.addEventListener('click', () =>
          explainQuestion(q, selected, result, explainButton, explanation));
        fragment.appendChild(article);
      });
      review.appendChild(fragment);
      paletteGrid.replaceChildren();
      review.querySelectorAll('.ai-inline-question').forEach((card, index) => {
        const q = questions[index];
        const selected = result.responses[index];
        const state = q.unscored ? 'excluded' : !Number.isInteger(selected) ? 'skipped'
          : selected === q.a ? 'correct' : 'wrong';
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.className = 'ai-review-jump is-' + state;
        jump.textContent = String(index + 1);
        jump.title = 'Question ' + (index + 1) + ': ' + state;
        jump.setAttribute('aria-label', jump.title);
        jump.addEventListener('click', () => {
          activeQuestion = index;
          updateMode();
          closePalette();
          review.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        paletteGrid.appendChild(jump);
      });
      updateMode();
      output.hidden = false;
      const groups = groupsFor(result, questions);
      const weak = [...groups.topics].filter(([k,v]) => v.wrong+v.skipped>0)
        .sort((a,b)=>b[1].wrong+b[1].skipped-a[1].wrong-a[1].skipped).slice(0,5);
      output.innerHTML = '<div class="ai-analysis-metrics">' +
        '<strong>Correct: ' + result.correct + '</strong><strong>Wrong: ' + result.wrong +
        '</strong><strong>Skipped: ' + result.unattempted + '</strong><strong>Accuracy: ' + result.accuracy +
        '%</strong></div>' +
        statTable('Unit-wise performance', groups.units) +
        statTable('Topic-wise performance', groups.topics) +
        '<p><b>Revision priorities:</b> ' + (weak.length
          ? weak.map(([name, v]) => esc(name) + ' (' + (v.wrong+v.skipped) + ' needs review)').join(' · ')
          : 'No wrong or skipped questions in this attempt.') + '</p>' +
        '<p class="muted">Figures are calculated from your actual submitted answers. Untagged units are shown separately, not guessed. Detailed Gemini option explanations are available under each question.</p>';
    }
    button.addEventListener('click', () => {
      revealReview();
      mode = 'list';
      updateMode();
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // Public action for the result-page Review solutions button: no additional click
    // on Open AI analysis and no old accordion list.
    window.TestCentreAI.openReview = (requestedMode = 'focus') => {
      if (!opened) revealReview();
      mode = requestedMode === 'list' ? 'list' : 'focus';
      updateMode();
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  async function explainQuestion(q, selected, result, button, status) {
    // A successful Gemini response belongs to this question. Toggle it locally
    // instead of making duplicate API requests on repeated button clicks.
    if (status.dataset.aiLoaded === 'true') {
      status.hidden = !status.hidden;
      button.textContent = status.hidden ? 'Show option analysis' : 'Hide option analysis';
      button.setAttribute('aria-expanded', String(!status.hidden));
      return;
    }
    if (!window.HostedAI?.request) {
      status.hidden = false;
      status.textContent = 'AI service is unavailable. Please refresh this page.';
      button.textContent = 'Retry option analysis';
      button.setAttribute('aria-expanded', 'true');
      return;
    }
    button.disabled = true;
    status.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    status.textContent = 'Gemini is checking every option…';
    const doubt = q.unscored
      ? 'This question has a disputed source key and is excluded from scoring. Do not treat correctIndex as authoritative. Assess A, B, C and D individually, explain the ambiguity, and identify any error. Source note: ' + (q.sourceAnswer || '')
      : 'Evaluate options A, B, C and D separately. Say why the correct option is correct and why each of the other three is incorrect. Check whether the supplied answer key is valid. Mention the student-selected answer and explain their mistake if any. Do not invent facts.';
    try {
      const data = await window.HostedAI.request({
        action: 'doubt',
        question: {
          exam: result.exam, subject: result.subject,
          question: q.q, options: q.o,
          correctIndex: q.unscored ? null : q.a,
          selectedIndex: Number.isInteger(selected) ? selected : null,
          userDoubt: doubt
        }
      }, AbortSignal.timeout(75000));
      if (typeof data?.answer !== 'string' || !data.answer.trim())
        throw new Error('Gemini returned an empty explanation.');
      status.textContent = data.answer;
      status.dataset.aiLoaded = 'true';
      button.textContent = 'Hide option analysis';
    } catch (error) {
      status.textContent = 'Could not load AI explanation: ' + (error.message || 'Unknown error') +
        '. Your saved answer key and explanation remain visible.';
      button.textContent = 'Retry option analysis';
    } finally {
      button.disabled = false;
    }
  }

  function mountSolutions(result, questions) {
    const cards = document.querySelectorAll('#solution-list details[data-ai-qindex]');
    cards.forEach((card) => {
      const i = Number(card.dataset.aiQindex);
      const q = questions[i];
      const body = card.querySelector('.sol-body');
      if (!q || !body || !Array.isArray(q.o) || q.o.length !== 4 ||
          card.querySelector('.ai-doubt-control')) return;

      const box = document.createElement('div');
      box.className = 'ai-doubt-control';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-ai-doubt';
      button.textContent = 'Generate option analysis';
      button.setAttribute('aria-expanded', 'false');
      const status = document.createElement('div');
      status.className = 'ai-coach-output';
      status.hidden = true;
      status.setAttribute('aria-live', 'polite');
      box.appendChild(button);
      box.appendChild(status);
      body.appendChild(box);

      button.addEventListener('click', () =>
        explainQuestion(q, result.responses[i], result, button, status));
    });
  }

  function mountHistory() {
    const target = document.querySelector('#daily-performance-history');
    if (target) target.innerHTML = dailyHTML();
  }

  window.addEventListener('aakash:account-state', () => {
    mountHistory();
    const list = document.querySelector('#ai-daily-history-list');
    if (list) list.innerHTML = dailyHTML();
  });
  window.TestCentreAI = { mount, mountSolutions, summarize, mountHistory };
})();
