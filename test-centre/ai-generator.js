/* AI Test Generator — uses the hosted Google Gemini API.
   Generated MCQ sets are stored locally on this device, separate from built-in tests. */
(function () {
  'use strict';

  const STORAGE_KEY = 'tclab.ai.generated.v1';
  const MAX_SAVED = 30;
  const asText = (v) => String(v == null ? '' : v);
  const normalize = (v) => asText(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokenSet = (v) => new Set(normalize(v).split(' ').filter((w) => w.length > 3));
  const similar = (a, b) => {
    if (normalize(a) === normalize(b)) return true;
    const x = tokenSet(a), y = tokenSet(b);
    if (x.size < 4 || y.size < 4) return false;
    let intersect = 0;
    x.forEach((s) => { if (y.has(s)) intersect++; });
    return intersect / Math.max(x.size, y.size) >= 0.84;
  };

  function validQuestion(q) {
    return q && typeof q.q === 'string' && q.q.trim().length >= 15 &&
      q.q.length <= 900 && Array.isArray(q.o) && q.o.length === 4 &&
      q.o.every((v) => typeof v === 'string' && v.trim().length && v.length <= 250) &&
      new Set(q.o.map(normalize)).size === 4 &&
      Number.isInteger(q.a) && q.a >= 0 && q.a <= 3 &&
      typeof q.e === 'string' && q.e.trim().length >= 10 && q.e.length <= 1300 &&
      typeof q.t === 'string' && q.t.trim().length >= 2 && q.t.length <= 100;
  }

  const ALLOWED_COUNTS = [10, 25, 50, 75, 100];

  function validTest(t) {
    return t && typeof t.id === 'string' && /^ai-[a-z0-9-]+$/.test(t.id) &&
      typeof t.examId === 'string' && typeof t.subjectId === 'string' &&
      t.test && typeof t.test.title === 'string' && t.test.title.length <= 160 &&
      Number.isFinite(t.test.duration) && t.test.duration > 0 && t.test.duration <= 240 &&
      Array.isArray(t.test.questions) && t.test.questions.length >= 1 &&
      t.test.questions.length <= 100 && t.test.questions.every(validQuestion);
  }

  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.filter(validTest).slice(0, MAX_SAVED) : [];
    } catch (_) { return []; }
  }

  function writeSaved(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
    catch (_) { return false; }
  }

  function removeSaved(id) {
    return writeSaved(loadSaved().filter((t) => t.id !== id));
  }

  function endpoint() {
    return typeof window.TEST_CENTRE_AI_ENDPOINT === 'string' ?
      window.TEST_CENTRE_AI_ENDPOINT.trim() : '';
  }

  function makeHistory(examId, subjectId, topic) {
    const recent = loadSaved().filter((item) => item.examId === examId &&
      item.subjectId === subjectId &&
      (!topic || normalize(item.topic) === normalize(topic)));
    const previous = recent.flatMap((item) => item.test.questions.map((q) => q.q));
    const other = loadSaved().filter((item) => item.examId === examId &&
      item.subjectId === subjectId && (!topic || normalize(item.topic) !== normalize(topic)))
      .flatMap((item) => item.test.questions.map((q) => q.q)).slice(-12);
    const fixed = ((window.QUESTION_BANKS || {})[subjectId] || [])
      .slice(0, 6).map((q) => q.q);
    return previous.concat(other, fixed).slice(-60);
  }

  function validateGenerated(raw, count, history) {
    if (!raw || !Array.isArray(raw.questions) || raw.questions.length !== count) {
      throw new Error('AI did not return a complete question set. Please try again.');
    }
    const accepted = [];
    for (const q of raw.questions) {
      if (!validQuestion(q)) throw new Error('AI produced an invalid MCQ. Please generate again.');
      if (history.concat(accepted.map((x) => x.q)).some((p) => similar(q.q, p))) {
        throw new Error('AI repeated a question. Please generate again for a fresh set.');
      }
      accepted.push({
        q: q.q.trim(), o: q.o.map((v) => v.trim()), a: q.a,
        e: q.e.trim(), t: q.t.trim()
      });
    }
    return accepted;
  }

  function extractUniqueQuestions(raw, history, maxNeeded) {
    if (!raw || !Array.isArray(raw.questions)) return [];
    const accepted = [];
    for (const q of raw.questions) {
      if (!validQuestion(q)) continue;
      if (history.concat(accepted.map((x) => x.q)).some((p) => similar(q.q, p))) continue;
      accepted.push({
        q: q.q.trim(), o: q.o.map((v) => v.trim()), a: q.a,
        e: q.e.trim(), t: q.t.trim()
      });
      if (accepted.length >= maxNeeded) break;
    }
    return accepted;
  }


  async function fetchWithDeadline(url, options, ms, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const relayAbort = () => controller.abort();
    if (externalSignal?.aborted) throw new Error('Generation cancelled.');
    externalSignal?.addEventListener('abort', relayAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
    try {
      const response = await window.HostedAI.transport(url, { ...options, signal: controller.signal });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((body && body.error) ||
          ('AI server returned HTTP ' + response.status + '. Check the AI service.'));
      }
      return body;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        if (externalSignal?.aborted && !timedOut) throw new Error('Generation cancelled.');
        throw new Error('AI did not respond within ' + Math.round(ms / 1000) +
          ' seconds. Try again or check your connection.');
      }
      if (error instanceof TypeError) {
        throw new Error('Cannot reach the AI service. Check your connection and retry.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', relayAbort);
    }
  }

  async function checkBackend(signal) {
    const workerUrl = endpoint();
    const healthUrl = workerUrl.replace(/\/$/, '') + '/health';
    const health = await fetchWithDeadline(healthUrl, {method:'GET'}, 10000, signal);
    if (!health?.ok || !health.configured) throw new Error('The hosted AI service is not configured yet.');
  }

  function mount(exams, register, refresh, options = {}) {
    exams = exams.filter((exam) => exam.aiSupported !== false);
    const host = document.querySelector('#ai-generator');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    const syllabi = window.TEST_CENTRE_SYLLABI || {};
    let currentTrack = exams.some((e) => e.id === options.activeExam)
      ? options.activeExam
      : (exams[0] && exams[0].id) || 'gate';

    host.innerHTML =
      '<div class="ai-gen-intro"><span class="ai-gen-kicker">✦ GOOGLE GEMINI · OFFICIAL SYLLABUS GENERATOR</span>' +
      '<h2 id="ai-gen-heading">Generate syllabus-aligned tests with AI</h2>' +
      '<p>Strictly constrained to official syllabus units for GATE 2027 ECE, NEET UG, and CUET PG (SCQP17 Life Sciences &amp; SCQP28 Zoology). Every set saves locally too.</p></div>' +
      '<form class="ai-gen-form" id="ai-gen-form">' +
      '<label>Exam stream<select id="ai-gen-exam" required></select></label>' +
      '<label>Subject<select id="ai-gen-subject" required></select></label>' +
      '<label>Official syllabus unit<select id="ai-gen-unit"></select></label>' +
      '<label>Extra subtopic focus (optional)<input id="ai-gen-topic" maxlength="80" placeholder="Narrow focus within unit (optional)"></label>' +
      '<label>Difficulty<select id="ai-gen-level"><option value="Mixed">Mixed</option>' +
      '<option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label>' +
      '<label>Questions per test<select id="ai-gen-count">' +
      '<option value="10" selected>10 questions</option>' +
      '<option value="25">25 questions</option>' +
      '<option value="50">50 questions</option>' +
      '<option value="75">75 questions</option>' +
      '<option value="100">100 questions</option>' +
      '</select></label>' +
      '<label>Number of tests<select id="ai-gen-batch"><option value="1">1 test</option>' +
      '<option value="2">2 different tests</option><option value="3">3 different tests</option></select></label>' +
      '<button type="submit" class="btn btn-primary" id="ai-gen-submit">Generate AI tests</button>' +
      '</form>' +
      '<div class="ai-gen-syllabus-box" id="ai-gen-syllabus-box">' +
      '<span class="ai-gen-syllabus-head" id="ai-gen-syllabus-head">OFFICIAL SYLLABUS SCOPE</span>' +
      '<span class="ai-gen-syllabus-text" id="ai-gen-syllabus-text"></span>' +
      '</div>' +
      '<div class="ai-gen-ready" id="ai-gen-ready" hidden></div>' +
      '<div class="ai-gen-job" id="ai-gen-job" hidden>' +
      '<div class="ai-gen-job-line"><span id="ai-gen-progress-label">Preparing…</span>' +
      '<button type="button" class="ai-gen-cancel" id="ai-gen-cancel">Cancel</button></div>' +
      '<progress id="ai-gen-progress" value="0" max="5"></progress></div>' +
      '<p class="ai-gen-status" id="ai-gen-status" role="status" aria-live="polite"></p>' +
      '<button type="button" class="ai-gen-diagnostic" id="ai-gen-diagnostic">Check Gemini connection (2 questions)</button>';

    const form = host.querySelector('#ai-gen-form');
    const examSelect = host.querySelector('#ai-gen-exam');
    const subjectSelect = host.querySelector('#ai-gen-subject');
    const unitSelect = host.querySelector('#ai-gen-unit');
    const topicInput = host.querySelector('#ai-gen-topic');
    const levelSelect = host.querySelector('#ai-gen-level');
    const countSelect = host.querySelector('#ai-gen-count');
    const batchSelect = host.querySelector('#ai-gen-batch');
    const button = host.querySelector('#ai-gen-submit');
    const status = host.querySelector('#ai-gen-status');
    const readyBox = host.querySelector('#ai-gen-ready');
    const sylHead = host.querySelector('#ai-gen-syllabus-head');
    const sylText = host.querySelector('#ai-gen-syllabus-text');
    const progressWrap = host.querySelector('#ai-gen-job');
    const progress = host.querySelector('#ai-gen-progress');
    const progressLabel = host.querySelector('#ai-gen-progress-label');
    const cancel = host.querySelector('#ai-gen-cancel');
    const controls = Array.from(form.querySelectorAll('input, select'));
    let activeController = null;
    const diagnostic = host.querySelector('#ai-gen-diagnostic');

    const getSubjectSyllabus = (examId, subjectId) =>
      (syllabi[examId] && syllabi[examId].subjects && syllabi[examId].subjects[subjectId]) || null;

    function buildSyllabusContext(examId, subjectId, unitId, waveIndex) {
      const entry = getSubjectSyllabus(examId, subjectId);
      if (!entry || !Array.isArray(entry.units) || !entry.units.length) {
        return { unitLabel: '', syllabusSpec: '' };
      }
      if (unitId && unitId !== 'all') {
        const chosen = entry.units.find((u) => u.id === unitId);
        if (chosen) {
          return {
            unitLabel: chosen.title,
            syllabusSpec: chosen.title + ': ' + chosen.topics,
          };
        }
      }
      // Full syllabus mode: spread parallel waves cleanly across different official units
      const unitCount = entry.units.length;
      if (typeof waveIndex === 'number' && unitCount > 2) {
        const start = (waveIndex * 2) % unitCount;
        const picked = [];
        for (let k = 0; k < Math.min(3, unitCount); k++) {
          picked.push(entry.units[(start + k) % unitCount]);
        }
        return {
          unitLabel: 'Full Official Syllabus (' + picked.map((u) => u.title).join(' + ') + ')',
          syllabusSpec: picked.map((u) => u.title + ': ' + u.topics).join('\n'),
        };
      }
      return {
        unitLabel: 'Full Syllabus (All ' + unitCount + ' Official Units)',
        syllabusSpec: entry.units.map((u) => u.title + ': ' + u.topics).join('\n').slice(0, 1380),
      };
    }

    function updateSyllabusPreview() {
      const examId = examSelect.value;
      const subjectId = subjectSelect.value;
      const unitId = unitSelect.value;
      const entry = getSubjectSyllabus(examId, subjectId);
      if (!entry) {
        sylHead.textContent = 'SYLLABUS SCOPE';
        sylText.textContent = 'Questions follow standard exam topics for the selected subject.';
        return;
      }
      if (unitId === 'all' || !unitId) {
        sylHead.textContent = entry.source + ' · FULL SYLLABUS MIX';
        sylText.textContent = 'Balanced mix across ' + entry.units.length + ' official units: ' +
          entry.units.map((u) => u.title.replace(/^Unit \d+:\s*|^GA \d+:\s*|^\d+\.\d+\s*/, '')).join(' · ');
      } else {
        const chosen = entry.units.find((u) => u.id === unitId);
        sylHead.textContent = entry.source + ' · ' + (chosen ? chosen.title : 'UNIT');
        sylText.textContent = chosen ? chosen.topics : '';
      }
    }

    function syncUnits() {
      unitSelect.replaceChildren();
      const entry = getSubjectSyllabus(examSelect.value, subjectSelect.value);
      const count = entry && Array.isArray(entry.units) ? entry.units.length : 0;
      unitSelect.add(new Option(count ? 'Full Syllabus (All ' + count + ' Units)' : 'Full Syllabus Mix', 'all'));
      if (entry && Array.isArray(entry.units)) {
        entry.units.forEach((u) => unitSelect.add(new Option(u.title, u.id)));
      }
      updateSyllabusPreview();
    }

    function syncSubjects() {
      subjectSelect.replaceChildren();
      const exam = exams.find((e) => e.id === examSelect.value);
      if (exam) exam.subjects.forEach((s) => subjectSelect.add(new Option(s.name, s.id)));
      syncUnits();
    }

    function renderReadyPanel(items) {
      if (!items || !items.length) {
        readyBox.hidden = true;
        readyBox.innerHTML = '';
        return;
      }
      const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      readyBox.hidden = false;
      readyBox.innerHTML =
        '<div class="ai-gen-ready-head">' +
        '<span class="ai-gen-ready-badge">✓ READY TO ATTEMPT NOW · ALSO SAVED BELOW IN RECENT SETS</span>' +
        '</div>' +
        '<div class="ai-gen-ready-list">' +
        items.map((item) => {
          const m = item.test.marking || { correct: 1, wrong: 0 };
          const mStr = '+' + m.correct + ' / ' + (m.wrong ? '−' + (Math.round(m.wrong * 100) / 100) : '0');
          return '<div class="ai-gen-ready-item">' +
            '<div class="ai-gen-ready-info">' +
            '<strong>' + escHtml(item.test.title) + '</strong>' +
            '<span>' + item.test.questions.length + ' Qs · ' + item.test.duration + ' min · ' + mStr + '</span>' +
            '</div>' +
            '<a class="ai-gen-start-btn" href="#/t/' + escHtml(item.id) + '">Start Test Now <span aria-hidden="true">→</span></a>' +
            '</div>';
        }).join('') +
        '</div>';
    }

    function applyExamSelection(examId, emit) {
      if (!exams.some((e) => e.id === examId)) return;
      currentTrack = examId;
      examSelect.value = examId;
      syncSubjects();
      renderReadyPanel([]);
      if (emit && typeof options.onExamChange === 'function') {
        options.onExamChange(examId);
      }
    }

    exams.forEach((exam) => examSelect.add(new Option(exam.name, exam.id)));
    examSelect.value = currentTrack;
    syncSubjects();

    examSelect.addEventListener('change', () => applyExamSelection(examSelect.value, true));
    subjectSelect.addEventListener('change', syncUnits);
    unitSelect.addEventListener('change', updateSyllabusPreview);

    diagnostic.addEventListener('click', async () => {
      if (activeController) return;
      diagnostic.disabled = true;
      status.dataset.state = 'progress';
      status.textContent = 'Testing live AI inference with 2 syllabus questions…';
      try {
        await checkBackend();
        const exam = exams.find((e) => e.id === examSelect.value);
        const subject = exam?.subjects.find((s) => s.id === subjectSelect.value);
        if (!subject) throw new Error('Choose a valid subject first.');
        const ctx = buildSyllabusContext(exam.id, subject.id, unitSelect.value, 0);
        const started = Date.now();
        const answer = await fetchWithDeadline(endpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate', exam: exam.id, subject: subject.id,
            unit: ctx.unitLabel, syllabusSpec: ctx.syllabusSpec,
            topic: topicInput.value.trim(), difficulty: levelSelect.value,
            count: 2, avoid: []
          })
        }, 75000);
        validateGenerated(answer, 2, []);
        status.dataset.state = 'success';
        status.textContent = 'Live AI generated 2 valid ' + exam.name + ' syllabus questions in ' +
          Math.round((Date.now() - started) / 1000) + 's. Now click Generate AI tests!';
      } catch (error) {
        status.dataset.state = 'error';
        status.textContent = 'AI diagnostic failed: ' + (error?.message || 'Unknown error');
      } finally {
        diagnostic.disabled = false;
      }
    });

    cancel.addEventListener('click', () => {
      if (!activeController) return;
      cancel.disabled = true;
      progressLabel.textContent = 'Cancelling…';
      activeController.abort();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!endpoint()) { status.textContent = 'AI endpoint is not configured.'; return; }
      const exam = exams.find((e) => e.id === examSelect.value);
      const subject = exam && exam.subjects.find((s) => s.id === subjectSelect.value);
      if (!subject) { status.textContent = 'Select a valid exam and subject.'; return; }
      const selectedUnitId = unitSelect.value;
      const customTopic = topicInput.value.trim();
      const baseCtx = buildSyllabusContext(exam.id, subject.id, selectedUnitId, null);
      const labelTopic = customTopic ||
        (selectedUnitId !== 'all' ? baseCtx.unitLabel.replace(/^\d+\.\d+\s*|^Unit \d+:\s*|^GA \d+:\s*/i, '') : '');
      const difficulty = levelSelect.value;
      const requestedCount = Number(countSelect.value);
      const count = ALLOWED_COUNTS.includes(requestedCount) ? requestedCount : 10;
      const batch = Number(batchSelect.value);
      const saved = loadSaved();
      if (saved.length + batch > MAX_SAVED) {
        status.dataset.state = 'error';
        status.textContent = 'You have reached the 30-test local storage limit. Delete an older AI test first.';
        return;
      }
      renderReadyPanel([]);
      status.dataset.state = 'progress';
      button.disabled = true;
      button.textContent = 'Generating…';
      controls.forEach((input) => { input.disabled = true; });
      const controller = new AbortController();
      activeController = controller;
      cancel.disabled = false;
      progressWrap.hidden = false;
      progress.max = batch * count;
      progress.value = 0;
      progressLabel.textContent = '0 / ' + (batch * count) + ' questions';
      let created = 0;
      const freshlyCreated = [];
      try {
        status.textContent = 'Checking Google Gemini connection…';
        await checkBackend(controller.signal);
        for (let n = 0; n < batch; n++) {
          const questions = [];
          const chunkSize = 4;
          const maxConcurrency = 2;
          const totalPlanned = Math.ceil(count / chunkSize);
          const maxWaves = totalPlanned + 8;
          let wavesDone = 0;
          let batchCursor = 0;
          let consecutiveEmptyWaves = 0;
          const allPrevious = loadSaved().filter((x) =>
            x.examId === exam.id && x.subjectId === subject.id
          ).flatMap((x) => x.test.questions.map((q) => q.q));
          const baseHistory = makeHistory(exam.id, subject.id, labelTopic);

          while (questions.length < count) {
            if (controller.signal.aborted) throw new Error('Generation cancelled.');
            if (wavesDone >= maxWaves) {
              throw new Error('Could not collect enough unique questions for this set. Please retry.');
            }
            const remaining = count - questions.length;
            const waveSizes = [];
            let planned = 0;
            const waveCap = consecutiveEmptyWaves > 0 ? 1 : maxConcurrency;
            while (planned < remaining && waveSizes.length < waveCap) {
              const size = Math.min(chunkSize, remaining - planned);
              waveSizes.push(size);
              planned += size;
            }

            status.textContent = 'Generating ' + exam.name + ' test ' + (n + 1) + ' of ' + batch +
              ' · syllabus wave (' + waveSizes.length + ' batch' + (waveSizes.length === 1 ? '' : 'es') +
              ') · ' + questions.length + '/' + count + ' ready…';

            const currentStems = questions.map((q) => q.q);
            const avoidHistory = baseHistory.concat(currentStems).slice(-30);

            let addedInWave = 0;
            let lastRecoverableError = null;
            let fatalError = null;
            let sawRateLimit = false;

            await Promise.all(
              waveSizes.map(async (askCount, idx) => {
                try {
                  const waveCtx = buildSyllabusContext(exam.id, subject.id, selectedUnitId, batchCursor + idx);
                  const data = await fetchWithDeadline(endpoint(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'generate', exam: exam.id, subject: subject.id,
                      unit: waveCtx.unitLabel, syllabusSpec: waveCtx.syllabusSpec,
                      topic: customTopic, difficulty: difficulty, count: askCount,
                      avoid: avoidHistory, batchIndex: n * 16 + batchCursor + idx
                    })
                  }, 75000, controller.signal);

                  const stillNeeded = count - questions.length;
                  if (stillNeeded > 0) {
                    const dedupeHistory = allPrevious.concat(baseHistory, questions.map((q) => q.q));
                    const fresh = extractUniqueQuestions(data, dedupeHistory, stillNeeded);
                    if (fresh.length > 0) {
                      questions.push(...fresh);
                      addedInWave += fresh.length;
                      progress.value = (n * count) + questions.length;
                      progressLabel.textContent = progress.value + ' / ' + (batch * count) + ' questions prepared';
                      status.textContent = 'Generating ' + exam.name + ' test ' + (n + 1) + ' of ' + batch +
                        ' · ' + questions.length + '/' + count + ' questions ready…';
                    }
                  }
                } catch (err) {
                  const msg = err?.message || '';
                  const rateLimited = /429|rate|limit|quota|high demand|overloaded|unavailable/i.test(msg);
                  const recoverable = rateLimited || /invalid|incomplete|repeated|JSON|question set|respond within|try again|502|503|504/i.test(msg);
                  if (rateLimited) sawRateLimit = true;
                  if (!recoverable) fatalError = err;
                  else lastRecoverableError = err;
                }
              })
            );
            wavesDone++;
            batchCursor += waveSizes.length;
            if (controller.signal.aborted) throw new Error('Generation cancelled.');

            if (fatalError) throw fatalError;

            if (addedInWave > 0) {
              consecutiveEmptyWaves = 0;
              progress.value = (n * count) + questions.length;
              progressLabel.textContent = progress.value + ' / ' + (batch * count) + ' questions prepared';
            } else {
              consecutiveEmptyWaves++;
              if (consecutiveEmptyWaves >= 4) {
                throw lastRecoverableError || new Error('Could not generate unique questions right now. Please retry.');
              }
              status.textContent = (sawRateLimit ? 'Temporary AI demand pause — retrying… ' : 'Fetching fresh syllabus questions… ') +
                '(' + questions.length + '/' + count + ' ready)';
              await new Promise((resolve) => setTimeout(resolve, sawRateLimit ? 3500 : 600));
            }
          }

          const durationMin = exam.id === 'cuet-pg'
            ? Math.ceil(count * 1.2)
            : exam.id === 'neet'
              ? Math.ceil(count * 1.5)
              : Math.ceil(count * 2);
          const markingScheme = (exam.id === 'neet' || exam.id === 'cuet-pg')
            ? { correct: 4, wrong: 1 }
            : { correct: 1, wrong: 1 / 3 };
          const title = 'AI · ' + (labelTopic || subject.name) + ' · ' + difficulty + ' · ' +
            new Date().toLocaleDateString() + ' #' + (loadSaved().length + 1);
          const id = 'ai-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
          const item = {
            id: id, examId: exam.id, subjectId: subject.id, topic: labelTopic,
            createdAt: Date.now(),
            test: {
              id: id, title: title, level: 'AI syllabus · check answers',
              duration: durationMin,
              marking: markingScheme,
              questions: questions, generated: true
            }
          };
          if (!writeSaved(loadSaved().concat(item))) {
            throw new Error('Could not save tests. Please free browser storage and retry.');
          }
          register(item);
          created++;
          freshlyCreated.push(item);
          renderReadyPanel(freshlyCreated);
          refresh();
        }
        status.dataset.state = 'success';
        status.textContent = '✓ ' + created + ' ' + exam.name + ' syllabus test' + (created === 1 ? '' : 's') +
          ' ready! Launch right above or find in saved sets below.';
      } catch (error) {
        const prefix = created ? created + ' completed test(s) saved. ' : '';
        status.textContent = prefix + (error?.message || 'Could not generate tests.');
        status.dataset.state = 'error';
      } finally {
        activeController = null;
        progressWrap.hidden = true;
        controls.forEach((input) => { input.disabled = false; });
        button.disabled = false;
        button.textContent = 'Generate AI tests';
      }
    });

    window.TestCentreAIGenerator._syncExam = (id) => applyExamSelection(id, false);
  }

  function setExam(examId) {
    if (typeof window.TestCentreAIGenerator?._syncExam === 'function') {
      window.TestCentreAIGenerator._syncExam(examId);
    }
  }

  window.TestCentreAIGenerator = { loadSaved, mount, removeSaved, setExam };
})();