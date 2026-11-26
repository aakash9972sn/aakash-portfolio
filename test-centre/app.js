/* ============================================================================
   AAKASH Test Centre — engine
   Data-driven: reads window.EXAM_DATA / window.QUESTION_BANKS from data.js.
   Handles browsing, the test runner (timer, palette, marking, resume),
   scoring and the solutions review. No dependencies, no build step.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (s) => pad(Math.floor(s / 60)) + ':' + pad(s % 60);

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full or blocked */ } },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };
  const PKEY = (id) => 'tclab.progress.' + id;
  const BKEY = (id) => 'tclab.best.' + id;
  const RKEY = (id) => 'tclab.result.' + id;
  const HISTORY_KEY = 'tclab.analysis.history.v1';
  function recordDailyAttempt(result, questions) {
    if (!result || !result.testId || !Number.isFinite(result.at)) return;
    const history = store.get(HISTORY_KEY, []);
    const rows = Array.isArray(history) ? history : [];
    if (rows.some(x => x.testId === result.testId && x.at === result.at)) return;
    const breakdown = Array.isArray(questions) && window.TestCentreAI?.summarize
      ? window.TestCentreAI.summarize(result, questions) : null;
    rows.push({
      unitStats: breakdown?.units || {}, topicStats: breakdown?.topics || result.topics,
      ownerUid: window.AakashAccount?.getState?.()?.uid || null,
      testId: result.testId, at: result.at, title: result.title,
      exam: result.exam, subject: result.subject, examId: result.examId,
      subjectId: result.subjectId, correct: result.correct, wrong: result.wrong,
      unattempted: result.unattempted, excluded: result.excluded || 0,
      accuracy: result.accuracy, topics: result.topics
    });
    store.set(HISTORY_KEY, rows);
  }


  /* ------------------------------------------------------------------ index */
  const Core = window.TestCentreCore;
  const EXAMS = window.EXAM_DATA || [];
  const BANKS = window.QUESTION_BANKS || {};
  const TESTS = [];
  EXAMS.forEach((exam) => exam.subjects.forEach((subject) => subject.tests.forEach((test) => {
    TESTS.push({ test: test, exam: exam, subject: subject });
  })));

  /* Register locally saved AI sets in the existing test engine. */
  const generator = window.TestCentreAIGenerator;
  function registerGenerated(item) {
    if (!item || !item.test || TESTS.some((x) => x.test.id === item.id)) return;
    const exam = EXAMS.find((e) => e.id === item.examId);
    const subject = exam && exam.subjects.find((s) => s.id === item.subjectId);
    if (!exam || !subject) return;
    TESTS.push({ test: item.test, exam: exam, subject: subject });
  }
  if (generator) generator.loadSaved().forEach(registerGenerated);

  const findEntry = (id) => TESTS.find((x) => x.test.id === id);
  const questionsOf = (test) => {
    if (test.questions) return test.questions;
    const bank = BANKS[test.bank] || [];
    const range = test.range || [0, bank.length];
    return bank.slice(range[0], range[1]);
  };
  const markingOf = (test) => test.marking || { correct: 1, wrong: 0 };
  const markLabel = (test) => {
    const m = markingOf(test);
    const neg = m.wrong ? '−' + (Math.round(m.wrong * 100) / 100) : '0';
    return '+' + m.correct + ' / ' + neg;
  };

  /* --------------------------------------------------------- runner state */
  let run = null;          // active attempt
  let timerId = null;
  let lastResult = null;   // in-memory mirror of the just-submitted result

  /* ------------------------------------------------------------- navigation */
  function go(hash) {
    if (location.hash === hash) { route(); return; }
    location.hash = hash;
  }

  function route() {
    closeModal(false);
    if (run) { saveProgress(true); run = null; stopTimer(); }
    const hash = location.hash || '#/';
    const workspace = hash.match(/^#\/workspace\/([a-z-]+)\/(all|tests|pyp|ai)$/);
    const archives = {'#/gate-papers': 'gate', '#/gate-cs-papers': 'gate-cs', '#/gate-ee-papers': 'gate-ee'};
    const track = archives[hash] || (workspace && TRACK_IDS.includes(workspace[1]) && workspace[1]);
    if (track) {
      if (track !== filterExam) resetFilters();
      filterExam = track;
      if (isGateTrack(track)) {
        lastGateBranch = track;
        store.set(GATE_BRANCH_KEY, track);
      }
      store.set(EXAM_STORE_KEY, track);
      workspaceView = archives[hash] ? 'pyp' : workspace[2];
      showHome();
      return;
    }
    const tMatch = hash.match(/^#\/t\/(.+)$/);
    const rMatch = hash.match(/^#\/r\/(.+)$/);
    const pdfMatch = hash.match(/^#\/pdf\/(.+)$/);
    if (pdfMatch && findEntry(pdfMatch[1])?.test.pdfOnly) {
      workspaceView = 'pyp';
      filterExam = 'cuet-pg';
      store.set(EXAM_STORE_KEY, filterExam);
      showHome();
      window.PYPSource?.open(pdfMatch[1], 1);
      return;
    }
    if (tMatch && findEntry(tMatch[1])) { openTest(findEntry(tMatch[1])); return; }
    if (rMatch && findEntry(rMatch[1])) { showResult(findEntry(rMatch[1])); return; }
    workspaceView = 'all';
    showHome();
  }

  function setScreen(name) {
    closePalette(false);
    if (name !== 'result') document.querySelector('aakash-assistant')?.removeAttribute('data-review-active');
    ['home', 'test', 'result'].forEach((s) => {
      const el = $('#screen-' + s);
      if (el) el.hidden = (s !== name);
    });
    stopTimer();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------- home */
  const EXAM_STORE_KEY = 'tclab.activeExam';
  const TRACK_IDS = ['gate', 'gate-ee', 'gate-cs', 'neet', 'cuet-pg'];
  const GATE_BRANCH_KEY = 'tclab.activeGateBranch';
  const isGateTrack = t => ['gate','gate-ee','gate-cs'].includes(t);
  const isPaperOnly = t => ['gate-ee','gate-cs'].includes(t);
  let lastGateBranch = store.get(GATE_BRANCH_KEY,'gate');
  if (!isGateTrack(lastGateBranch)) lastGateBranch='gate';
  const TRACK_META = {
    gate: { title: 'GATE EC', description: 'Electronics & Communication Engineering' },
    'gate-ee': { title: 'GATE EE', description: 'Electrical Engineering' },
    'gate-cs': { title: 'GATE CS', description: 'Computer Science & Information Technology' },
    neet: { title: 'NEET UG', description: 'Biology, Physics & Chemistry' },
    'cuet-pg': { title: 'CUET PG', description: 'Life Sciences & Zoology' }
  };
  const savedExam = store.get(EXAM_STORE_KEY, 'gate');
  let filterExam = TRACK_IDS.includes(savedExam) ? savedExam : 'gate';
  if (isGateTrack(filterExam)) lastGateBranch=filterExam;
  let filterSubject = 'all';
  let searchTerm = '';

  const trackForExamId = (examId) => (examId === 'cucet' ? 'cuet-pg' : examId);
  const matchesActiveTrack = (examId) => trackForExamId(examId) === filterExam;
  const activeTrackTests = () => TESTS.filter((x) => matchesActiveTrack(x.exam.id));

  function progressOf(id) {
    const entry = findEntry(id);
    return entry && !entry.test.pdfOnly
      ? Core.progress(store.get(PKEY(id), null), questionsOf(entry.test), entry.test.duration * 60) : null;
  }

  function renderExamPicker() {
    const gate=isGateTrack(filterExam);
    $$('#exam-track-bar [data-track]').forEach(btn=>{
      const on=btn.dataset.track===(gate?'gate':filterExam);
      btn.classList.toggle('is-active',on);btn.setAttribute('aria-pressed',String(on));
    });
    $('#gate-branch-picker').hidden=!gate;
    $$('#gate-branch-bar [data-branch]').forEach(btn=>{
      const on=btn.dataset.branch===filterExam;
      btn.hidden=false;
      btn.classList.toggle('is-active',on);btn.setAttribute('aria-pressed',String(on));
    });
  }
  function pickTrack(track) {
    if(!TRACK_IDS.includes(track))return;
    workspaceView='all';
    selectExamTrack(track,false);
  }

  function setPicker(open) {
    $('#track-picker').hidden = !open;
    $('#change-track').setAttribute('aria-expanded', String(open));
    if (!open && $('#track-picker').contains(document.activeElement)) $('#change-track').focus();
  }

  function renderOverview() {
    const meta = TRACK_META[filterExam];
    const gate = isGateTrack(filterExam);
    const neet = filterExam === 'neet';
    $('#track-title').textContent = meta.title;
    $('#track-description').textContent = meta.description;
    $('#feature-heading').innerHTML = neet ? 'Subject<br><em>practice</em>' : 'Previous-year<br><em>papers</em>';
    $('#feature-description').textContent = neet ? 'Choose a subject and start a timed test.' :
      filterExam === 'gate' ? 'Take a full paper or practise by topic.' :
      gate ? 'Work through a timed paper from the archive.' : 'Practise with CUET PG and CUCET papers.';
    $('#feature-action').firstChild.textContent = neet ? 'Browse tests ' : 'Browse papers ';
    $('#sample-title').textContent = meta.title;
    const sample = $('#sample-content');
    sample.replaceChildren();
    if (filterExam === 'gate') {
      const img = document.createElement('img');
      img.src = 'gate-digitized/ink/EC2026-Q3-stem.webp';
      img.alt = '';
      sample.append(img);
    } else {
      for (let row = 0; row < 4; row++) {
        const line = document.createElement('div');
        line.className = 'bubble-row';
        for (const letter of 'ABCD') {
          const bubble = document.createElement('i');
          bubble.textContent = letter;
          line.append(bubble);
        }
        sample.append(line);
      }
    }
    $('#quick-title').textContent = gate ? 'Latest papers' : 'Practice by subject';
    if (!gate) {
      const available = activeTrackTests();
      const subjects = subjectsForFilter().map(subject => ({
        ...subject, count: available.filter(x => x.subject.id === subject.id).length
      })).filter(subject => subject.count);
      $('#quick-list').replaceChildren(...subjects.slice(0, 3).map(subject => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quick-link';
        button.innerHTML = '<span><strong>' + esc(subject.name) + '</strong><small>' +
          subject.count + (subject.count === 1 ? ' test' : ' tests') + '</small></span><span aria-hidden="true">→</span>';
        button.addEventListener('click', () => {
          openWorkspaceView('tests');
          filterSubject = subject.id;
          $('#subject-filter').value = subject.id;
          renderCards();
          $('#catalog-heading').focus();
        });
        return button;
      }));
    }
  }

  function renderHome() {
    $('#screen-home').dataset.activeTrack = filterExam;
    renderExamPicker();
    renderOverview();
    renderSubjectFilter();
    renderResume();
    renderHomeStats();
    window.TestCentreAI?.mountHistory?.();
    setWorkspaceView(workspaceView);
    window.dispatchEvent(new CustomEvent('tclab:gate-track', {detail: {track: filterExam}}));
  }

  function selectExamTrack(trackId, fromGenerator) {
    if (!TRACK_IDS.includes(trackId)) return;
    filterExam = trackId;
    if (isGateTrack(trackId)) {
      lastGateBranch = trackId;
      store.set(GATE_BRANCH_KEY, trackId);
    }
    resetFilters();
    recordWorkspace(workspaceView);
    store.set(EXAM_STORE_KEY, filterExam);
    renderHome();
    if (!isPaperOnly(filterExam) && !fromGenerator) mountGenerator();
  }

  function showHome() {
    run = null;
    setScreen('home');
    renderHome();
    if (!isPaperOnly(filterExam)) mountGenerator();
  }

  function mountGenerator() {
    if (!generator) return;
    generator.mount(EXAMS, registerGenerated, () => {
      renderOverview();
      renderResume();
      renderCards();
      renderHomeStats();
    }, {activeExam: filterExam, onExamChange: id => selectExamTrack(id, true)});
    generator.setExam?.(filterExam);
  }

  function renderHomeStats() {
    $('#activity-scope').textContent = isGateTrack(filterExam) ? 'Full papers' : 'Practice tests';
    if (isGateTrack(filterExam)) return; // The archive owns paper attempts and their account scope.
    const tests = activeTrackTests();
    const stats = [[tests.length, 'Available'], [tests.filter(x => progressOf(x.test.id)).length, 'In progress'],
      [tests.filter(x => store.get(BKEY(x.test.id), null)).length, 'Completed']];
    $('#home-stats').innerHTML = stats.map(([n, label]) =>
      '<div class="stat"><b>' + n + '</b><span>' + label + '</span></div>').join('');
  }

  function subjectsForFilter() {
    return EXAMS.filter(e => matchesActiveTrack(e.id)).flatMap(exam =>
      exam.subjects.map(subject => ({ id: subject.id, name: subject.name, exam })));
  }

  function renderSubjectFilter() {
    const subjects = subjectsForFilter();
    $('#subject-filter').replaceChildren(new Option('All subjects', 'all'), ...subjects.map(subject => {
      const duplicate = subjects.some(other => other.id !== subject.id && other.name === subject.name);
      return new Option(duplicate ? subject.name + ' · ' + subject.exam.name : subject.name, subject.id);
    }));
    $('#subject-filter').value = filterSubject;
  }

  function renderResume() {
    const items = activeTrackTests().map((x) => ({ x: x, p: progressOf(x.test.id) })).filter((o) => o.p && o.p.responses);
    const banner = $('#resume-banner');
    if (!items.length) { banner.hidden = true; banner.innerHTML = ''; return; }
    banner.hidden = false;
    banner.innerHTML =
      '<div class="resume-list">' + items.map((o) => {
        const total = questionsOf(o.x.test).length;
        const done = o.p.responses.filter((r) => r !== null && r !== undefined).length;
        return '<a class="resume-item" href="#/t/' + esc(o.x.test.id) + '">' +
          '<span class="resume-title">' + esc(o.x.test.title) + '</span>' +
          '<span class="resume-meta">' + esc(o.x.subject.name) + ' · ' + done + '/' + total + ' answered</span>' +
          '<span class="resume-go">Resume</span></a>';
      }).join('') + '</div>';
  }

  function visibleTests() {
    const term = searchTerm.trim().toLowerCase();
    return TESTS.filter((x) => {
      if (!matchesActiveTrack(x.exam.id)) return false;
      if (workspaceView === 'pyp' && !x.test.pyp) return false;
      if (filterSubject !== 'all' && x.subject.id !== filterSubject) return false;
      if (!term) return true;
      const hay = (x.test.title + ' ' + x.subject.name + ' ' + x.exam.name + ' ' + (x.test.level || '')).toLowerCase();
      return hay.indexOf(term) !== -1;
    });
  }

  function renderCards() {
    const list = visibleTests();
    const grid = $('#test-grid');
    const empty = $('#home-empty');
    empty.hidden = list.length > 0;
    grid.innerHTML = list.map((x) => cardHTML(x)).join('');
    $$('.card', grid).forEach((card) => {
      const id = card.dataset.id;
      $$('a, button', card).forEach((el) => el.addEventListener('click', (ev) => {
        if (el.tagName === 'A') return; // let the anchor navigate
        ev.preventDefault();
        if (el.hasAttribute('data-delete-ai')) {
          ev.stopPropagation();
          modal({
            title: 'Delete saved AI test?',
            body: '<p>This removes the AI-generated test and any saved result from this browser.</p>',
            confirm: 'Delete test',
            cancel: 'Keep',
            onConfirm: () => {
              if (!generator || !generator.removeSaved(id)) return;
              const index = TESTS.findIndex((entry) => entry.test.id === id);
              if (index >= 0) TESTS.splice(index, 1);
              store.del(PKEY(id));
              store.del(BKEY(id));
              store.del(RKEY(id));
              renderCards();
              renderResume();
              renderHomeStats();
            }
          });
          return;
        }
        go('#/' + (store.get(RKEY(id), null) ? 'r/' : 't/') + id);
      }));
    });
  }

  function cardHTML(x) {
    const test = x.test;
    const pdf = Boolean(test.pdfOnly);
    const qs = pdf ? Number(test.questionCount) : questionsOf(test).length;
    const best = pdf ? null : store.get(BKEY(test.id), null);
    const prog = pdf ? null : progressOf(test.id);
    const pdfProgress = pdf ? (window.PYPSource?.getProgress?.(test.id) || 0) : 0;
    let status = '<span class="card-status">Not started</span>';
    if (pdf && pdfProgress) {
      status = '<span class="card-status is-progress">In progress · ' + pdfProgress + '/' + qs + '</span>';
    } else if (prog) {
      const done = prog.responses.filter((r) => r !== null && r !== undefined).length;
      status = '<span class="card-status is-progress">In progress · ' + done + '/' + qs + '</span>';
    } else if (!pdf && store.get(RKEY(test.id), null)) {
      status = '<span class="card-status is-done">Submitted · review available</span>';
    } else if (best) {
      status = '<span class="card-status is-done">Best ' + best.score + '/' + best.total + '</span>';
    }
    const submitted = !pdf && store.get(RKEY(test.id), null);
    const cta = pdf ? (pdfProgress ? 'Resume practice' : 'Start practice') :
      submitted && !prog ? 'Review result' : prog ? 'Resume' : 'Start test';
    const href = pdf ? '#/pdf/' + test.id : '#/' + (submitted && !prog ? 'r/' : 't/') + test.id;
    const note = pdf
      ? 'Original scan · No verified key · Ungraded practice'
      : (test.reviewOnlyCount != null
        ? 'Full paper · ' + test.reviewOnlyCount + ' source-flagged review-only questions'
        : 'Full paper · 1 source-flagged review-only question');
    return '<article class="card" data-id="' + esc(test.id) + '" style="--card-accent:' + x.exam.accent + ';--card-accent2:' + x.exam.accent2 + '">' +
      '<div class="card-tags"><span class="tag tag-exam">' + esc(x.exam.name) + '</span><span class="tag">' + esc(x.subject.name) + '</span>' +
      (test.level ? '<span class="tag tag-level">' + esc(test.level) + '</span>' : '') + '</div>' +
      '<h3 class="card-title">' + esc(test.title) + '</h3>' +
      (test.pyp ? '<p class="paper-date">' + esc(test.date) + '</p><p class="paper-note">' + esc(note) + '</p>' : '') +
      '<dl class="card-meta">' +
      '<div><dt>Questions</dt><dd>' + qs + '</dd></div>' +
      '<div><dt>Time</dt><dd>' + test.duration + ' min</dd></div>' +
      '<div><dt>Marking</dt><dd>' + (pdf ? 'Ungraded' : esc(markLabel(test))) + '</dd></div>' +
      '</dl>' +
      '<div class="card-foot">' + status +
      '<a class="card-cta" href="' + esc(href) + '">' + cta + '<span aria-hidden="true">→</span></a>' +
      '</div>' + (test.generated ? '<button type="button" class="ai-test-delete" data-delete-ai>Delete saved AI test</button>' : '') + '</article>';
  }

  /* ------------------------------------------------------------ test runner */
  function openTest(entry) {
    // After submission, keep the review accessible until an explicit reset.
    if (store.get(RKEY(entry.test.id), null)) {
      go('#/r/' + entry.test.id);
      return;
    }
    const mappedTrack = trackForExamId(entry.exam.id);
    if (TRACK_IDS.includes(mappedTrack) && mappedTrack !== filterExam) {
      filterExam = mappedTrack;
      filterSubject = 'all';
      store.set(EXAM_STORE_KEY, filterExam);
    }
    const test = entry.test;
    const questions = questionsOf(test);
    let prog = progressOf(test.id);
    if (!prog || !prog.responses || prog.responses.length !== questions.length) {
      prog = newAttempt(questions);
    }
    run = {
      entry: entry,
      test: test,
      questions: questions,
      responses: prog.responses.slice(),
      marked: (prog.marked || []).slice(),
      visited: (prog.visited || []).slice(),
      current: clamp(prog.current || 0, 0, questions.length - 1),
      timeLeft: typeof prog.timeLeft === 'number' ? prog.timeLeft : test.duration * 60,
      total: test.duration * 60
    };
    if (run.marked.length !== questions.length) run.marked = questions.map(() => false);
    if (run.visited.length !== questions.length) run.visited = questions.map(() => false);
    setScreen('test');
    buildRunnerChrome();
    goToQuestion(run.current);
    startTimer();
  }

  function newAttempt(questions) {
    return {
      responses: questions.map(() => null),
      marked: questions.map(() => false),
      visited: questions.map(() => false),
      current: 0,
      timeLeft: undefined
    };
  }

  function saveProgress(paused = false) {
    if (!run) return;
    if (Number.isFinite(run.deadline)) run.timeLeft = Core.remaining(run.deadline);
    store.set(PKEY(run.test.id), {
      responses: run.responses,
      marked: run.marked,
      visited: run.visited,
      current: run.current,
      timeLeft: run.timeLeft,
      deadline: paused ? null : run.deadline,
      updated: Date.now()
    });
  }

  function buildRunnerChrome() {
    $('#runner-title').textContent = run.test.title;
    $('#runner-sub').textContent = run.entry.exam.name + ' · ' + run.entry.subject.name;
    $('#runner-count').textContent = String(run.questions.length);
    $('#runner-marking').textContent = 'Marking ' + markLabel(run.test);
    $('#runner-note').textContent = run.test.pyp ? run.test.sourceNote + ' Save & exit pauses the timer.' : 'Save & exit pauses the timer. The timer continues while this attempt is open.';
    renderPalette();
    updateProgressBar();
    updateTimerText();
  }

  function startTimer() {
    stopTimer();
    run.deadline = Date.now() + run.timeLeft * 1000;
    saveProgress();
    const tick = () => {
      if (!run) return;
      run.timeLeft = Core.remaining(run.deadline);
      updateTimerText();
      if (run.timeLeft <= 0) { submit(true); return; }
      saveProgress();
    };
    tick();
    if (run) timerId = setInterval(tick, 1000);
  }
  function expired() {
    if (!run) return true;
    if (Number.isFinite(run.deadline) && Core.remaining(run.deadline) <= 0) { submit(true); return true; }
    return false;
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function updateTimerText() {
    const el = $('#timer-text');
    if (!el || !run) return;
    el.textContent = fmtTime(Math.max(0, run.timeLeft));
    const box = $('#runner-timer');
    box.classList.toggle('is-low', run.timeLeft <= 300);
    box.classList.toggle('is-critical', run.timeLeft <= 60);
  }

  function statusOf(i) {
    const answered = run.responses[i] !== null && run.responses[i] !== undefined;
    const marked = run.marked[i];
    if (marked && answered) return 'answered-marked';
    if (marked) return 'marked';
    if (answered) return 'answered';
    if (run.visited[i]) return 'seen';
    return 'not-visited';
  }

  function renderPalette() {
    const grid = $('#palette-grid');
    grid.innerHTML = run.questions.map((q, i) => {
      const st = statusOf(i);
      const cur = i === run.current ? ' is-current' : '';
      return '<button type="button" class="pcell is-' + st + cur + '" data-i="' + i + '" aria-label="Question ' + (i + 1) + '">' + (i + 1) + '</button>';
    }).join('');
    $$('#palette-grid .pcell').forEach((b) => b.addEventListener('click', () => {
      goToQuestion(Number(b.dataset.i));
      closePaletteOnMobile();
    }));
    const counts = { answered: 0, 'answered-marked': 0, marked: 0, seen: 0, 'not-visited': 0 };
    run.questions.forEach((q, i) => { counts[statusOf(i)]++; });
    $('#pal-answered').textContent = counts.answered + counts['answered-marked'];
    $('#pal-marked').textContent = counts.marked + counts['answered-marked'];
    $('#pal-unseen').textContent = counts['not-visited'] + counts.seen;
  }

  function updateProgressBar() {
    const answered = run.responses.filter((r) => r !== null && r !== undefined).length;
    const pct = Math.round((answered / run.questions.length) * 100);
    $('#runner-progress-bar').style.width = pct + '%';
    $('#runner-progress-text').textContent = answered + ' / ' + run.questions.length + ' answered';
  }

  function goToQuestion(i) {
    if (expired()) return;
    run.current = clamp(i, 0, run.questions.length - 1);
    run.visited[run.current] = true;
    renderQuestion();
    renderPalette();
    updateProgressBar();
    saveProgress();
  }

  function renderQuestion() {
    const i = run.current;
    const q = run.questions[i];
    $('#q-index').textContent = 'Question ' + (i + 1) + ' of ' + run.questions.length;
    $('#q-topic').textContent = q.t || '';
    $('#q-source-note').hidden = !q.unscored;
    $('#q-source-note').textContent = q.unscored ? 'Review-only: the source flags a disputed answer key. This question does not affect your score.' : '';
    $('#q-text').textContent = q.q;
    let figure = $('#q-figure');
    if (!figure) {
      figure = document.createElement('figure');
      figure.id = 'q-figure';
      figure.className = 'pyp-question-figure';
      $('#q-text').insertAdjacentElement('afterend', figure);
    }
    const hasFigure = typeof q.image === 'string' && /^media\/[\w/-]+\.svg$/.test(q.image);
    figure.hidden = !hasFigure;
    if (hasFigure) {
      figure.replaceChildren();
      const img = document.createElement('img');
      img.src = q.image;
      img.alt = q.imageAlt || 'Figure for this question';
      img.loading = 'lazy';
      figure.appendChild(img);
    } else {
      figure.replaceChildren();
    }
    window.PYPSource?.syncQuestion(run.test.id, i + 1);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    $('#q-options').innerHTML = q.o.map((opt, oi) => {
      const selected = run.responses[i] === oi;
      return '<button type="button" class="opt' + (selected ? ' is-selected' : '') + '" aria-pressed="' + selected + '" data-oi="' + oi + '">' +
        '<span class="opt-key">' + letters[oi] + '</span><span class="opt-text">' + esc(opt) + '</span></button>';
    }).join('');
    $$('#q-options .opt').forEach((btn) => btn.addEventListener('click', () => selectOption(Number(btn.dataset.oi))));
    $('#btn-mark').classList.toggle('is-on', !!run.marked[i]);
    $('#btn-mark').setAttribute('aria-pressed', String(!!run.marked[i]));
    $('#btn-prev').disabled = i === 0;
    $('#btn-next').textContent = i === run.questions.length - 1 ? 'Review' : 'Save & Next';
    $('#q-explanation').hidden = true;
  }

  function selectOption(oi) {
    if (expired()) return;
    run.responses[run.current] = oi;
    $$('#q-options .opt').forEach((btn) => { const selected = Number(btn.dataset.oi) === oi; btn.classList.toggle('is-selected', selected); btn.setAttribute('aria-pressed', String(selected)); });
    renderPalette();
    updateProgressBar();
    saveProgress();
  }

  function clearResponse() {
    if (expired()) return;
    run.responses[run.current] = null;
    $$('#q-options .opt').forEach((btn) => { btn.classList.remove('is-selected'); btn.setAttribute('aria-pressed', 'false'); });
    renderPalette();
    updateProgressBar();
    saveProgress();
  }

  function toggleMark() {
    if (expired()) return;
    run.marked[run.current] = !run.marked[run.current];
    $('#btn-mark').classList.toggle('is-on', run.marked[run.current]);
    $('#btn-mark').setAttribute('aria-pressed', String(run.marked[run.current]));
    renderPalette();
    saveProgress();
  }

  function nextQuestion() {
    if (expired()) return;
    if (run.current < run.questions.length - 1) goToQuestion(run.current + 1);
    else askSubmit();
  }
  function prevQuestion() { if (expired()) return; if (run.current > 0) goToQuestion(run.current - 1); }

  function paletteIsMobile() { return window.matchMedia('(max-width: 900px)').matches; }
  function openPalette() {
    if (!paletteIsMobile()) return;
    const palette = $('#palette');
    palette.inert = false;
    palette.classList.add('is-open');
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    $('#palette-open').setAttribute('aria-expanded', 'true');
    $('#palette-scrim').hidden = false;
    document.body.classList.add('palette-open');
    $('#palette-close').focus({ preventScroll: true });
  }
  function closePalette(restoreFocus = true) {
    const palette = $('#palette');
    const wasOpen = palette.classList.contains('is-open');
    palette.classList.remove('is-open');
    palette.removeAttribute('role');
    palette.removeAttribute('aria-modal');
    palette.inert = paletteIsMobile();
    $('#palette-open').setAttribute('aria-expanded', 'false');
    $('#palette-scrim').hidden = true;
    document.body.classList.remove('palette-open');
    if (wasOpen && restoreFocus !== false && !$('#screen-test').hidden && paletteIsMobile()) $('#palette-open').focus({ preventScroll: true });
  }
  function closePaletteOnMobile() { if (paletteIsMobile()) closePalette(); }

  /* ------------------------------------------------------------- submit flow */
  function askSubmit() {
    if (!run) return;
    closePalette(false);
    const answered = run.responses.filter((r) => r !== null && r !== undefined).length;
    const marked = run.marked.filter(Boolean).length;
    const total = run.questions.length;
    modal({
      title: 'Submit this test?',
      body: '<p>You have answered <b>' + answered + '</b> of <b>' + total + '</b> questions.</p>' +
        '<ul class="modal-stats">' +
        '<li><span>Answered</span><b>' + answered + '</b></li>' +
        '<li><span>Not answered</span><b>' + (total - answered) + '</b></li>' +
        '<li><span>Marked for review</span><b>' + marked + '</b></li>' +
        '</ul><p class="muted">Once submitted you cannot change your answers.</p>',
      confirm: 'Yes, submit',
      cancel: 'Keep working',
      onConfirm: () => submit(false)
    });
  }

  function submit(auto) {
    if (!run) return;
    closeModal(false);
    stopTimer();
    if (Number.isFinite(run.deadline)) run.timeLeft = Core.remaining(run.deadline);
    const scored = Core.score(run.questions, run.responses, markingOf(run.test));
    const { correct, wrong, unattempted, accuracy, score, excluded } = scored;
    const topicStats = scored.topics;
    const totalMarks = scored.total;
    const timeUsed = run.total - Math.max(0, run.timeLeft);
    const result = {
      testId: run.test.id,
      title: run.test.title,
      exam: run.entry.exam.name,
      subject: run.entry.subject.name,
      examId: run.entry.exam.id,
      subjectId: run.entry.subject.id,
      score: score,
      total: totalMarks,
      correct: correct,
      excluded: excluded,
      wrong: wrong,
      unattempted: unattempted,
      accuracy: accuracy,
      timeUsed: timeUsed,
      totalTime: run.total,
      auto: !!auto,
      responses: run.responses.slice(),
      marked: run.marked.slice(),
      topics: topicStats,
      at: Date.now()
    };
    store.set(RKEY(run.test.id), result);
    recordDailyAttempt(result, run.questions);
    const dailyRows = store.get(HISTORY_KEY, []);
    const detailedRecord = Array.isArray(dailyRows) ? dailyRows.find(x => x.testId === result.testId && x.at === result.at) : null;
    window.AakashAccount?.save('testAttempts', result.testId+'-'+result.at, { ...result, ...detailedRecord });
    store.del(PKEY(run.test.id));
    const prevBest = store.get(BKEY(run.test.id), null);
    if (!prevBest || score > prevBest.score) store.set(BKEY(run.test.id), { score: score, total: totalMarks, at: Date.now() });
    lastResult = result;
    stopTimer();
    run = null;
    closePalette();
    go('#/r/' + result.testId);
  }

  function exitTest() {
    if (!run) { go('#/'); return; }
    const answered = run.responses.filter((r) => r !== null && r !== undefined).length;
    modal({
      title: 'Leave the test?',
      body: '<p>Save & exit pauses the timer and saves your progress so you can resume later. You have answered <b>' + answered + '</b> of <b>' + run.questions.length + '</b>.</p>',
      confirm: 'Save & exit',
      cancel: 'Stay',
      onConfirm: () => { if (expired()) return; saveProgress(true); run = null; go('#/'); }
    });
  }

  /* ---------------------------------------------------------------- results */
  function showResult(entry) {
    stopTimer();
    setScreen('result');
    const result = lastResult && lastResult.testId === entry.test.id ? lastResult : store.get(RKEY(entry.test.id), null);
    if (!result || !Array.isArray(result.responses) || !result.topics) { go('#/'); return; }
    recordDailyAttempt(result, questionsOf(entry.test)); // Backfill older saved result.
    solutionFilter = 'all';
    const questions = questionsOf(entry.test);
    const pct = result.total ? Math.round((Math.max(0, result.score) / result.total) * 100) : 0;
    $('#result-body').innerHTML =
      '<div class="result-head">' +
      '<span class="result-exam" style="--card-accent:' + entry.exam.accent + '">' + esc(result.exam) + ' · ' + esc(result.subject) + '</span>' +
      '<h2>' + esc(result.title) + '</h2>' +
      (result.auto ? '<p class="result-auto">Time ran out — the test was submitted automatically.</p>' : '') +
      '</div>' +
      '<div class="result-score">' +
      '<div class="score-ring" style="--pct:' + clamp(pct, 0, 100) + '"><span class="score-num">' + result.score + '</span><span class="score-of">/ ' + result.total + '</span></div>' +
      '<div class="score-side">' +
      scoreRow('Correct', result.correct, 'good') +
      scoreRow('Wrong', result.wrong, 'bad') +
      scoreRow('Unattempted', result.unattempted, 'neutral') +
      (result.excluded ? scoreRow('Review-only (not scored)', result.excluded, 'neutral') : '') +
      scoreRow('Accuracy', result.accuracy + '%', 'accent') +
      scoreRow('Time used', fmtTime(result.timeUsed) + ' / ' + fmtTime(result.totalTime), 'neutral') +
      '</div></div>' +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-ghost" id="res-home">Back to tests</button>' +
      '<button type="button" class="btn btn-ghost" id="res-retake">Reset &amp; retake</button>' +
      '<button type="button" class="btn btn-primary" id="res-review">Review solutions</button>' +
      '</div>' +
      (Object.keys(result.topics).length > 1 ? topicBreakdown(result.topics) : '');
    $('#res-home').addEventListener('click', () => go('#/'));
    $('#res-retake').addEventListener('click', () => {
      modal({
        title: 'Reset submitted test?',
        body: '<p>This unlocks a new attempt and replaces the current review result after your next submission. Your date-wise performance history will be retained.</p>',
        confirm: 'Reset and retake', cancel: 'Keep review',
        onConfirm: () => {
          store.del(RKEY(result.testId));
          store.del(PKEY(result.testId));
          lastResult = null;
          go('#/t/' + result.testId);
        }
      });
    });
    if (window.TestCentreAI) window.TestCentreAI.mount(result, questions);
    // Start the familiar single-question review directly from the result CTA.
    // Keep the original accordion list as an optional, separately controlled view.
    const solutionArea = $('#solutions');
    solutionArea.hidden = true;
    $('#res-review').addEventListener('click', () => {
      if (typeof window.TestCentreAI?.openReview === 'function') {
        solutionArea.hidden = true;
        window.TestCentreAI.openReview('focus');
      } else {
        renderSolutions(entry, result, questions);
        solutionArea.hidden = false;
        solutionArea.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  function scoreRow(label, value, tone) {
    return '<div class="score-row is-' + tone + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }

  function topicBreakdown(topics) {
    const rows = Object.keys(topics).map((name) => {
      const t = topics[name];
      const attempted = t.correct + t.wrong;
      const acc = attempted ? Math.round((t.correct / attempted) * 100) : 0;
      return '<div class="topic-row"><span class="topic-name">' + esc(name) + '</span>' +
        '<span class="topic-bar"><i style="width:' + acc + '%"></i></span>' +
        '<span class="topic-val">' + t.correct + '/' + t.total + '</span></div>';
    }).join('');
    return '<div class="topic-breakdown"><h3>Topic performance</h3>' + rows + '</div>';
  }

  let solutionFilter = 'all';
  function renderSolutions(entry, result, questions) {
    const wrap = $('#solutions');
    wrap.hidden = false;
    const filters = [
      { id: 'all', label: 'All (' + questions.length + ')' },
      { id: 'wrong', label: 'Wrong (' + result.wrong + ')' },
      { id: 'correct', label: 'Correct (' + result.correct + ')' },
      { id: 'skipped', label: 'Skipped (' + result.unattempted + ')' },
      ...(result.excluded ? [{ id: 'excluded', label: 'Review-only (' + result.excluded + ')' }] : [])
    ];
    wrap.innerHTML =
      '<div class="solutions-head"><h2>Solutions &amp; explanations</h2>' +
      '<div class="solution-filters">' + filters.map((f) => '<button type="button" class="chip' + (f.id === solutionFilter ? ' is-active' : '') + '" data-filter="' + f.id + '">' + esc(f.label) + '</button>').join('') + '</div></div>' +
      '<div class="solution-list" id="solution-list"></div>';
    $$('.solution-filters .chip').forEach((b) => b.addEventListener('click', () => {
      solutionFilter = b.dataset.filter;
      renderSolutions(entry, result, questions);
    }));
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const list = $('#solution-list');
    questions.forEach((q, i) => {
      const r = result.responses[i];
      const state = Core.state(q, r);
      if (solutionFilter !== 'all' && solutionFilter !== state) return;
      const badge = { correct: 'Correct', wrong: 'Wrong', skipped: 'Skipped', excluded: 'Review-only' }[state];
      const opts = q.o.map((opt, oi) => {
        let cls = 'opt-static';
        if (!q.unscored && oi === q.a) cls += ' is-correct';
        else if (!q.unscored && oi === r) cls += ' is-wrong';
        else if (q.unscored && oi === r) cls += ' is-selected';
        return '<div class="' + cls + '"><span class="opt-key">' + letters[oi] + '</span><span class="opt-text">' + esc(opt) + '</span></div>';
      }).join('');
      list.insertAdjacentHTML('beforeend',
        '<details data-ai-qindex="' + i + '" class="solution is-' + state + '"' + (solutionFilter !== 'all' ? ' open' : '') + '>' +
        '<summary><span class="sol-num">' + (i + 1) + '</span><span class="sol-q">' + esc(q.q) + '</span><span class="sol-badge">' + badge + '</span></summary>' +
        '<div class="sol-body"><div class="sol-opts">' + opts + '</div>' +
        '<div class="sol-explain"><b>' + (q.sourceAnswer ? 'Source answer note.' : 'Explanation.') + '</b> ' + esc(q.e || '—') + '</div></div></details>');
    });
    if (!list.children.length) list.innerHTML = '<p class="muted">Nothing to show for this filter.</p>';
    if (window.TestCentreAI) window.TestCentreAI.mountSolutions(result, questions);
  }

  /* ----------------------------------------------------------------- modal */
  let modalFocus = null;
  function closeModal(restoreFocus = true) {
    const m = $('#modal');
    m.hidden = true;
    m.innerHTML = '';
    m.onclick = null;
    m.onkeydown = null;
    if (restoreFocus && modalFocus && modalFocus.isConnected) modalFocus.focus({ preventScroll: true });
    modalFocus = null;
  }
  function modal(opts) {
    closeModal(false);
    modalFocus = document.activeElement;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<h3 id="modal-title">' + esc(opts.title) + '</h3><div class="modal-body">' + opts.body + '</div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-ghost" id="modal-cancel">' + esc(opts.cancel || 'Cancel') + '</button>' +
      '<button type="button" class="btn btn-primary" id="modal-confirm">' + esc(opts.confirm || 'Confirm') + '</button>' +
      '</div></div>';
    $('#modal-cancel').addEventListener('click', () => closeModal());
    $('#modal-confirm').addEventListener('click', () => { closeModal(); if (opts.onConfirm) opts.onConfirm(); });
    m.onclick = (e) => { if (e.target === m) closeModal(); };
    m.onkeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      if (e.key === 'Tab') {
        const first = $('#modal-cancel'), last = $('#modal-confirm');
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    $('#modal-cancel').focus();
  }

  /* ------------------------------------------------------------------- workspace & theme */
  let workspaceView = 'all';
  function resetFilters() {
    filterSubject = 'all';
    searchTerm = '';
    $('#search').value = '';
    $('#subject-filter').value = 'all';
  }

  function recordWorkspace(view) {
    const hash = '#/workspace/' + filterExam + '/' + view;
    if (location.hash !== hash) history.pushState(null, '', location.pathname + hash);
  }

  function openWorkspaceView(view) {
    if (view !== workspaceView) resetFilters();
    recordWorkspace(view);
    setWorkspaceView(view);
  }

  function setWorkspaceView(view) {
    workspaceView = ['all', 'tests', 'pyp', 'ai'].includes(view) ? view : 'all';
    $$('[data-view]').forEach((btn) => {
      const on = btn.dataset.view === workspaceView;
      btn.classList.toggle('is-active', on);
      if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on));
    });
    $('#overview').hidden = workspaceView !== 'all';
    const paperOnly = isPaperOnly(filterExam);
    const gate = isGateTrack(filterExam);
    const past = workspaceView === 'pyp';
    const tests = workspaceView === 'tests';
    $('#gate-pyp').hidden = !(gate && (past || (paperOnly && tests)));
    $('#ai-generator').hidden = workspaceView !== 'ai' || paperOnly;
    $('#branch-ai-notice').hidden = workspaceView !== 'ai' || !paperOnly;
    $('#branch-ai-label').textContent = TRACK_META[filterExam].title;
    const noPapers = filterExam === 'neet' && past && !activeTrackTests().some(x => x.test.pyp);
    $('#neet-pyp-notice').hidden = !noPapers;
    $('#tests-catalog').hidden = !((!paperOnly && tests) || (!gate && past && !noPapers));
    $('#catalog-heading').textContent = past ? 'Previous-year papers' : 'Practice tests';
    if (!$('#tests-catalog').hidden) renderCards();
  }

  /* ------------------------------------------------------------------- wire */
  function wire() {
    $('#change-track').addEventListener('click', () => setPicker($('#track-picker').hidden));
    $('#track-picker').addEventListener('keydown', e => {
      if (e.key === 'Escape') setPicker(false);
    });
    $('#feature-action').addEventListener('click', () => {
      openWorkspaceView(filterExam === 'neet' ? 'tests' : 'pyp');
      $('.ws-tab.is-active').focus();
    });
    $$('#exam-track-bar [data-track]').forEach(btn=>btn.addEventListener('click',()=>{
      pickTrack(btn.dataset.track==='gate'?lastGateBranch:btn.dataset.track);
      if (btn.dataset.track !== 'gate') setPicker(false);
    }));
    $$('#gate-branch-bar [data-branch]').forEach(btn=>btn.addEventListener('click',()=>{
      pickTrack(btn.dataset.branch);
      setPicker(false);
    }));
    $$('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
      if ($('#screen-home').hidden) go('#/');
      openWorkspaceView(btn.dataset.view);
    }));
    $('#neet-pyp-practice')?.addEventListener('click', () => {
      openWorkspaceView('tests');
      $('#tests-catalog')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $('#branch-ai-practice')?.addEventListener('click', () => {
      openWorkspaceView('tests');
      $('#gate-pyp')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $('#search').addEventListener('input', e => {
      searchTerm = e.target.value;
      renderCards();
    });
    $('#subject-filter').addEventListener('change', e => {
      filterSubject = e.target.value;
      renderCards();
    });
    $('#btn-prev').addEventListener('click', prevQuestion);
    $('#btn-next').addEventListener('click', () => { saveProgress(); nextQuestion(); });
    $('#btn-clear').addEventListener('click', clearResponse);
    $('#btn-mark').addEventListener('click', toggleMark);
    $('#btn-submit').addEventListener('click', askSubmit);
    $('#exit-test').addEventListener('click', exitTest);
    $('#palette-open').addEventListener('click', openPalette);
    $('#palette-close').addEventListener('click', closePalette);
    $('#palette-scrim').addEventListener('click', closePalette);

    document.addEventListener('keydown', (e) => {
      if ($('#screen-test').hidden || !$('#modal').hidden) return;
      if (paletteIsMobile() && $('#palette').classList.contains('is-open')) {
        if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        if (e.key === 'Tab') {
          const controls = [...$('#palette').querySelectorAll('button:not(:disabled)')];
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      const key = e.key;
      if (/^[1-9]$/.test(key)) { const n = Number(key) - 1; if (run && n < run.questions[run.current].o.length) selectOption(n); }
      else if (key === 'ArrowRight') { saveProgress(); nextQuestion(); }
      else if (key === 'ArrowLeft') prevQuestion();
      else if (key === 'm' || key === 'M') toggleMark();
      else if (key === 'c' || key === 'C') clearResponse();
    });

    window.matchMedia('(max-width: 900px)').addEventListener('change', () => closePalette(false));
    closePalette(false);
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', () => { if (run) saveProgress(); });
  }

  // Import cloud AI sets into the same on-device quiz engine after sign-in.
  let lastCloudUid=null;
  window.addEventListener('aakash:account-state',async event=>{
    const uid=window.AakashAccount?.getState?.()?.uid;
    if(!event.detail?.signedIn||!uid||lastCloudUid===uid)return;
    lastCloudUid=uid;
    try{
      const restored=await generator?.restoreFromCloud?.();
      if(restored){
        generator.loadSaved().forEach(registerGenerated);
        if($('#screen-home')&&!$('#screen-home').hidden){
          renderCards();renderResume();renderHomeStats();
        }
      }
    }catch(error){console.warn('Optional AI set restore unavailable',error)}
  });

  /* ------------------------------------------------------------------- boot */
  wire();
  route();
})();
