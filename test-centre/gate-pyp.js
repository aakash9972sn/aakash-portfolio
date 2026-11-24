import {loadPapers, makeSets} from './gate-library.js';

const archive = document.querySelector('#gate-pyp');
const year = archive.querySelector('#gate-year');
const group = archive.querySelector('#gate-group');
const modeButtons = archive.querySelectorAll('[data-gate-mode]');
const summary = archive.querySelector('#gate-summary');
let mode = 'topic';
let papers = [];

function render(resetFilter) {
  const sets = makeSets(papers, mode, year.value);
  if (resetFilter) {
    group.replaceChildren(new Option(mode === 'topic' ? 'All topics' : 'All units', ''));
    if (mode !== 'paper') {
      sets.forEach(set => group.add(new Option(set.name, set.id)));
    }
  }
  const visible = sets.filter(set => !group.value || mode === 'paper' || set.id === group.value);
  const list = document.createElement('ul');
  list.className = 'gate-pyp-rows';
  for (const set of visible) {
    const row = document.createElement('li');
    row.className = 'gate-pyp-row';
    const link = document.createElement('a');
    const params = new URLSearchParams({mode, set:set.id});
    if (year.value) params.set('year', year.value);
    link.href = 'gate-test.html?' + params;
    link.textContent = 'Start test · ' + set.name;
    const metadata = document.createElement('small');
    metadata.textContent = set.questions.length + ' questions · ' +
      (mode === 'paper' ? '180 minutes' : 'Untimed practice');
    row.append(link, metadata);
    list.append(row);
  }
  archive.querySelector('#gate-results').replaceChildren(list);
  summary.textContent = visible.length + (visible.length === 1 ? ' test' : ' tests') + ' available';
}

modeButtons.forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.gateMode;
  for (const other of modeButtons) {
    other.classList.toggle('is-active', button === other);
    other.setAttribute('aria-pressed', String(button === other));
  }
  archive.querySelector('#gate-group-field').hidden = mode === 'paper';
  archive.querySelector('#gate-group-label').textContent = mode === 'topic' ? 'Topic' : 'Syllabus unit';
  render(true);
}));
group.addEventListener('change', () => render(false));
year.addEventListener('change', () => render(true));
summary.textContent = 'Loading practice tests…';
loadPapers().then(data => {
  papers = data;
  for (const value of new Set(data.map(paper => paper.year))) year.add(new Option(value, value));
  render(true);
}).catch(() => { summary.textContent = 'Unable to load the question bank. Reload to try again.'; });
