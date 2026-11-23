(function () {
  'use strict';

  const archive = document.getElementById('gate-pyp');
  if (!archive) return;
  const group = document.getElementById('gate-group');
  const year = document.getElementById('gate-year');
  const results = document.getElementById('gate-results');
  const summary = document.getElementById('gate-summary');
  const more = document.getElementById('gate-more');
  const modes = archive.querySelectorAll('[data-gate-mode]');
  const sectionNames = [
    'Engineering Mathematics', 'Networks, Signals and Systems', 'Electronic Devices',
    'Analog Circuits', 'Digital Circuits', 'Control Systems', 'Communications',
    'Electromagnetics'
  ];
  const units = new Map(Object.values(window.TEST_CENTRE_SYLLABI.gate.subjects)
    .flatMap(subject => subject.units)
    .map(unit => [unit.id, unit.title]));
  const pageSize = 24;
  let mode = 'topic';
  let visibleCount = pageSize;
  let index;

  const pdfLink = (file, page) => '../assets/gate-ec/' + file + '.pdf' +
    (page ? '#page=' + page : '');
  const paperTitle = (file) => {
    const [name, set] = file.split('_');
    return 'GATE EC ' + name.slice(2) + (set ? ' · Set ' + set : '');
  };

  function row(title, note, href) {
    const item = document.createElement('li');
    item.className = 'gate-pyp-row';
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = title;
    const metadata = document.createElement('small');
    metadata.textContent = note;
    item.append(link, metadata);
    return item;
  }

  function render() {
    const papers = index.filter(paper => !year.value || paper.file.slice(2, 6) === year.value);
    const list = document.createElement('ul');
    list.className = 'gate-pyp-rows';
    more.hidden = true;
    if (mode === 'paper') {
      for (const paper of papers) {
        list.append(row(paperTitle(paper.file) + ' ↗', paper.pages + ' PDF pages', pdfLink(paper.file)));
      }
      summary.textContent = papers.length + ' original PDFs';
    } else {
      const questions = papers.flatMap(paper => paper.questions
        .filter(question => !group.value || question[mode === 'topic' ? 3 : 2] === group.value)
        .map(question => [paper.file, question]));
      summary.textContent = questions.length
        ? questions.length + ' indexed questions'
        : 'No indexed questions match these filters.';
      for (const [file, [number, page, unit, topic, session]] of questions.slice(0, visibleCount)) {
        const title = paperTitle(file) + (session ? ' · ' + session : '') + ' · ' + number + ' ↗';
        const metadata = [topic, units.get(unit), 'PDF page ' + page];
        const note = metadata.filter(Boolean).join(' · ');
        list.append(row(title, note, pdfLink(file, page)));
      }
      more.hidden = questions.length <= visibleCount;
    }
    results.replaceChildren(list);
  }

  function resetAndRender() {
    visibleCount = pageSize;
    if (index) render();
  }

  function selectMode(nextMode) {
    mode = nextMode;
    modes.forEach(button => {
      const active = button.dataset.gateMode === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
    document.getElementById('gate-group-field').hidden = mode === 'paper';
    document.getElementById('gate-group-label').textContent = mode === 'topic' ? 'Topic' : 'Syllabus unit';
    if (!index) return;
    const questions = index.flatMap(paper => paper.questions);
    const values = [...new Set(questions.map(question => question[mode === 'topic' ? 3 : 2]))];
    group.replaceChildren(new Option(mode === 'topic' ? 'All topics' : 'All units', ''));
    if (mode === 'topic') {
      values.sort((a, b) => a.localeCompare(b));
      values.forEach(topic => group.add(new Option(topic, topic)));
    } else if (mode === 'unit') {
      const groups = new Map();
      for (const [id, title] of units) {
        if (!values.includes(id)) continue;
        const section = sectionNames[Number(title[0]) - 1] || 'General Aptitude';
        if (!groups.has(section)) {
          const optionGroup = document.createElement('optgroup');
          optionGroup.label = section;
          group.append(optionGroup);
          groups.set(section, optionGroup);
        }
        groups.get(section).append(new Option(title, id));
      }
      if (values.includes('unclassified')) group.add(new Option('Unclassified', 'unclassified'));
    }
    resetAndRender();
  }

  modes.forEach(button => button.addEventListener('click', () => selectMode(button.dataset.gateMode)));
  group.addEventListener('change', resetAndRender);
  year.addEventListener('change', resetAndRender);
  more.addEventListener('click', () => {
    const firstNewRow = visibleCount;
    visibleCount += pageSize;
    render();
    results.querySelectorAll('a')[firstNewRow]?.focus();
  });

  summary.textContent = 'Loading the question archive…';
  fetch('gate-pyp-index.json')
    .then(response => {
      if (!response.ok) throw new Error('Archive request failed');
      return response.json();
    })
    .then(papers => {
      index = papers;
      for (const value of new Set(index.map(paper => paper.file.slice(2, 6)))) {
        year.add(new Option(value, value));
      }
      selectMode(mode);
    })
    .catch(() => { summary.textContent = 'The question archive could not load. Reload this page to try again.'; });
})();
