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
      '<span>Inline question-by-question review</span></div>' +
      '<p>Review every question, your selected option, the stored answer key and the explanation here on this page. ' +
      'Option-by-option Gemini explanations are requested only when you press their buttons. ' +
      'AI can make mistakes; disputed source keys are not treated as verified.</p>' +
      '<button type="button" class="btn btn-primary" id="ai-analyze">Open AI analysis</button>' +
      '<div class="ai-coach-output" id="ai-analysis-output" hidden aria-live="polite"></div>' +
      '<div id="ai-inline-questions" class="ai-inline-questions" hidden></div>';
    host.appendChild(panel);

    const button = panel.querySelector('#ai-analyze');
    const output = panel.querySelector('#ai-analysis-output');
    const review = panel.querySelector('#ai-inline-questions');
    let opened = false;
    button.addEventListener('click', async () => {
      if (opened) {
        review.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      opened = true;
      button.textContent = 'View question analysis';
      review.hidden = false;
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
          if (!q.unscored && q.a === j) tags.push('<strong>Stored key</strong>');
          return '<li class="' + (selected === j ? 'is-selected ' : '') +
            (!q.unscored && q.a === j ? 'is-answer' : '') + '">' +
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
          '<button type="button" class="btn-ai-doubt">Explain all four options with Gemini</button>' +
          '<div class="ai-coach-output" hidden aria-live="polite"></div>';
        const explainButton = article.querySelector('button');
        const explanation = article.querySelector('.ai-coach-output');
        explainButton.addEventListener('click', () =>
          explainQuestion(q, selected, result, explainButton, explanation));
        fragment.appendChild(article);
      });
      review.appendChild(fragment);
      output.hidden = false;
      output.textContent = 'Preparing your topic-wise AI review on this page…';
      try {
        const data = await window.HostedAI.request({
          question: makeReviewPrompt(result, questions), history: [],
          context: { page: 'completed test result', exam: result.exam, subject: result.subject },
          action: 'chat'
        }, AbortSignal.timeout(60000));
        output.textContent = data?.answer || 'Review the question explanations below.';
      } catch (error) {
        output.textContent = 'Topic-wise AI summary unavailable: ' + (error.message || 'Please retry.') +
          '\nYour questions, selected answers and saved explanations remain available below.';
      }
    });
  }

  async function explainQuestion(q, selected, result, button, status) {
    if (!window.HostedAI?.request) {
      status.hidden = false;
      status.textContent = 'AI service is unavailable. Please refresh this page.';
      return;
    }
    button.disabled = true;
    status.hidden = false;
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
      button.textContent = 'Regenerate option analysis';
    } catch (error) {
      status.textContent = 'Could not load AI explanation: ' + (error.message || 'Unknown error') +
        '. Your saved answer key and explanation remain visible.';
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
      button.textContent = 'Explain all options with Gemini';
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

  window.TestCentreAI = { mount, mountSolutions };
})();
