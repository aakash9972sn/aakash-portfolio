import {savedPracticeSets, inspectSavedAttempt, summarizeSet, loadPapers, makeSets, units} from './gate-library.js?v=workspace1';

const archive = document.getElementById('gate-pyp');
const year = archive.querySelector('#gate-year');
const group = archive.querySelector('#gate-group');
const modeButtons = archive.querySelectorAll('[data-gate-mode]');
const summary = archive.querySelector('#gate-summary');
const grid = archive.querySelector('#gate-results');
const template = archive.querySelector('#gate-card');
const pagination = archive.querySelector('#gate-pagination');
const prev = archive.querySelector('#gate-prev');
const next = archive.querySelector('#gate-next');
const pageSize = 9;
const statusFilter = document.createElement('select');
statusFilter.id = 'gate-status-filter';
for (const [name,value] of [['All statuses',''],['Not started','unstarted'],['In progress','in-progress'],['Submitted / elapsed','submitted']]) statusFilter.add(new Option(name,value));
const statusLabel = document.createElement('label');
statusLabel.append('Status', statusFilter);
const search = document.createElement('input');
search.type = 'search'; search.placeholder = 'Search GATE sets'; search.setAttribute('aria-label','Search GATE sets');
const searchLabel = document.createElement('label'); searchLabel.append('Search',search);
summary.before(statusLabel,searchLabel);
statusFilter.addEventListener('change',()=>{page=0;renderPage();});
search.addEventListener('input',()=>{page=0;renderPage();});
const params = new URLSearchParams(location.search);
const kinds = {paper:'paper set', unit:'unit', topic:'topic'};
let mode = Object.hasOwn(kinds, params.get('mode')) ? params.get('mode') : 'paper';
let papers = [], sets = [], page = 0;
let activeTrack = '', loadToken = 0, ecMode = mode, csPromise;
const isCS = () => activeTrack === 'gate-cs';
const isEE = () => activeTrack === 'gate-ee';
const paperOnly = () => isCS() || isEE();
let eePromise;
function loadEE(){if(!eePromise)eePromise=fetch('gate-ee-index.json?v=2').then(r=>{if(!r.ok)throw Error('EE index unavailable');return r.json();}).catch(e=>{eePromise=null;throw e;});return eePromise;}
function loadCS(){if(!csPromise)csPromise=fetch('gate-cs-index.json?v=3').then(r=>{if(!r.ok)throw Error('CS index unavailable');return r.json();}).then(async data=>{const checked=await Promise.all(data.map(async paper=>{if(!paper.sourceRequired)return paper;try{const res=await fetch(paper.sourcePdf,{method:'HEAD',cache:'no-store'});return res.ok&&/application\/pdf|application\/octet-stream/i.test(res.headers.get('content-type')||'')?paper:null;}catch{return null;}}));return checked.filter(Boolean);}).catch(e=>{csPromise=null;throw e;});return csPromise;}
function testUrl(set, mode, year) {
  const target = new URLSearchParams({mode, set: set.id});
  if (year) target.set('year', year);
  return 'gate-test.html?' + target;
}

function overviewLink({set, mode, year, state}, resume) {
  const link = document.createElement('a');
  link.href = testUrl(set, mode, year);
  link.className = 'quick-link';
  const copy = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = set.name + (mode !== 'paper' && year ? ' · ' + year : '');
  const meta = document.createElement('small');
  meta.textContent = resume ? state.answeredCount + '/' + set.questions.length + ' answered' :
    set.questions.length + ' questions · 180 min';
  const action = document.createElement('span');
  action.textContent = resume ? 'Resume →' : '→';
  if (!resume) action.setAttribute('aria-hidden', 'true');
  copy.append(title, meta);
  link.append(copy, action);
  return link;
}

function updateOverview() {
  if (document.getElementById('screen-home').dataset.activeTrack !== activeTrack) return;
  const all = makeSets(papers, 'paper', '').sort((a, b) =>
    b.questions[0].paper.year - a.questions[0].paper.year).map(set => ({
      set, mode: 'paper', year: '', state: inspectSavedAttempt(set, 'paper', '')
    }));
  const list = document.getElementById('quick-list');
  list.replaceChildren(...all.slice(0, 3).map(row => overviewLink(row, false)));
  if (!all.length) list.textContent = 'No interactive papers are available yet.';
  const stats = [[all.length, 'Available'],
    [all.filter(row => row.state && !row.state.review).length, 'In progress'],
    [all.filter(row => row.state?.review).length, 'Finished']];
  document.getElementById('home-stats').replaceChildren(...stats.map(([value, label]) => {
    const stat = document.createElement('div');
    stat.className = 'stat';
    const number = document.createElement('b');
    const caption = document.createElement('span');
    number.textContent = value;
    caption.textContent = label;
    stat.append(number, caption);
    return stat;
  }));
  const saved = [...all, ...(activeTrack === 'gate' ? savedPracticeSets(papers) : [])]
    .filter(row => row.state && !row.state.review);
  const resume = document.getElementById('gate-resume');
  resume.replaceChildren();
  resume.hidden = !saved.length;
  if (!saved.length) return;
  resume.append(overviewLink(saved[0], true));
  if (saved.length > 1) {
    const more = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Other saved attempts (' + (saved.length - 1) + ')';
    more.append(summary, ...saved.slice(1).map(row => overviewLink(row, true)));
    resume.append(more);
  }
}

function createCard(set) {
  const card = template.content.firstElementChild.cloneNode(true);
  const info = summarizeSet(set);
  const title = card.querySelector('h3');
  title.textContent = set.name;
  const sub = document.createElement('p');
  sub.className = 'gate-card-sub';
  sub.textContent = [info.yearsLabel, info.typesLabel].filter(Boolean).join(' · ');
  title.after(sub);
  card.querySelector('[data-questions]').textContent = set.questions.length;
  card.querySelector('[data-time]').textContent = mode === 'paper' ? '180 min' : 'Untimed';
  const marks = card.querySelector('[data-paper-marks]');
  if (mode === 'paper') {
    marks.querySelector('dd').textContent = set.questions.reduce((total, entry) => total + entry.question.marks, 0);
  } else {
    marks.remove();
  }

  const state = inspectSavedAttempt(set, mode, year.value);
  const saved = state?.saved;
  const review = state?.review;
  const status = card.querySelector('.card-status');
  status.textContent = review ? (state.expired && !saved.finished ? 'Time elapsed' : 'Submitted') :
    saved ? `In progress · ${state.answeredCount}/${info.total}` : 'Not started';
  if (saved) status.classList.add(review ? 'is-done' : 'is-progress');

  const link = card.querySelector('a');
  link.href = testUrl(set, mode, year.value);
  const action = review ? 'Review result' : saved ? 'Resume test' : 'Start test';
  link.querySelector('[data-action]').textContent = action;
  link.setAttribute('aria-label', action + ' · ' + set.name);
  return card;
}

function renderPage() {
  const query = search.value.trim().toLowerCase();
  const visible = sets.filter(set => {
    if (group.value && mode !== 'paper' && set.id !== group.value) return false;
    if (query && ![set.name,set.id,...set.questions.map(({paper,question})=>[paper.year,question.topic,units.get(question.unit)].join(' '))].join(' ').toLowerCase().includes(query)) return false;
    if (!statusFilter.value) return true;
    const state = inspectSavedAttempt(set,mode,year.value);
    return statusFilter.value === 'submitted' ? !!state?.review : statusFilter.value === 'in-progress' ? !!state && !state.review : !state;
  });
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  page = Math.max(0, Math.min(page, pages - 1));
  const start = page * pageSize;
  const batch = visible.slice(start, start + pageSize);
  grid.replaceChildren(...batch.map(createCard));
  if (!batch.length) {
    const empty = document.createElement('li');
    empty.className = 'gate-empty-state';
    empty.textContent = 'No GATE practice sets match the active filters.';
    grid.append(empty);
  }

  const count = visible.length;
  const label = kinds[mode] + (count === 1 ? '' : 's');
  const years = new Set(visible.flatMap(set => set.questions.map(entry => entry.paper.year)));
  const range = pages > 1 ? ' · Showing ' + (start + 1) + '–' + (start + batch.length) : '';
  summary.textContent = count + ' ' + label + ' (' + visible.reduce((sum,set) => sum + set.questions.length,0) + ' questions)' + (years.size > 1 ? ' across ' + years.size + ' exam years' : '') + range;
  pagination.hidden = pages <= 1;
  prev.disabled = page === 0;
  next.disabled = page + 1 >= pages;
  archive.querySelector('#gate-page').textContent = 'Page ' + (page + 1) + ' of ' + pages;
}

function selectMode(returnTo) {
  for (const button of modeButtons) {
    const selected = button.dataset.gateMode === mode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', selected);
  }
  archive.querySelector('#gate-group-field').hidden = mode === 'paper';
  archive.querySelector('#gate-group-label').textContent = mode === 'topic' ? 'Topic' : 'Syllabus unit';
  sets = makeSets(papers, mode, year.value);
  group.replaceChildren(new Option(mode === 'topic' ? 'All topics' : 'All units', ''));
  if (mode !== 'paper') {
    sets.forEach(set => group.add(new Option(set.name + ' (' + set.questions.length + ')', set.id)));
  }
  const index = returnTo ? sets.findIndex(set => set.id === returnTo) : -1;
  if (mode !== 'paper' && index >= 0) group.value = returnTo;
  page = mode === 'paper' && index >= 0 ? Math.floor(index / pageSize) : 0;
  renderPage();
}

function turnPage(delta) {
  page += delta;
  renderPage();
  summary.focus({preventScroll:true});
  summary.scrollIntoView({block:'start'});
}

prev.addEventListener('click', () => turnPage(-1));
next.addEventListener('click', () => turnPage(1));
modeButtons.forEach(button => button.addEventListener('click', () => {
  if (paperOnly() && button.dataset.gateMode !== 'paper') return;
  mode = button.dataset.gateMode;
  if (!paperOnly()) ecMode=mode;
  selectMode();
}));
year.addEventListener('change', () => selectMode());
group.addEventListener('change', () => { page = 0; renderPage(); });
function refreshAttempts() {
  if (papers.length) { renderPage(); updateOverview(); }
}
window.addEventListener('aakash:account-state', refreshAttempts);
window.addEventListener('pageshow', event => { if (event.persisted) refreshAttempts(); });

async function switchTrack(track, initial=false) {
  if (activeTrack === track && !initial && papers.length) { refreshAttempts(); return; }
  if (activeTrack==='gate') ecMode=mode;
  activeTrack=track;
  const token = ++loadToken;
  papers = [];
  const resume = document.getElementById('gate-resume');
  resume.hidden = true;
  resume.replaceChildren();
  if (!['gate','gate-cs','gate-ee'].includes(track)) return;
  const list = document.getElementById('quick-list');
  list.textContent = 'Loading papers…';
  document.getElementById('home-stats').replaceChildren();
  const cs=paperOnly();
  mode=cs?'paper':ecMode;
  archive.querySelector('#gate-archive-kicker').textContent=cs?(isEE()?'GATE EE · Previous-year papers':'GATE CS · Previous-year papers'):'GATE EC · 2007–2026';
  archive.querySelector('#gate-archive-syllabus').hidden=cs;
  archive.querySelector('#gate-ec-scoring').hidden=cs;
  archive.querySelector('#gate-cs-note').hidden=!cs;
  modeButtons.forEach(b=>b.hidden=cs&&b.dataset.gateMode!=='paper');
  search.value = '';
  statusFilter.value='';
  year.replaceChildren(new Option('All years',''));
  sets=[];grid.replaceChildren();pagination.hidden=true;
  summary.textContent='Loading practice tests…';
  try{
    const data=await (isEE()?loadEE():isCS()?loadCS():loadPapers());
    if(token!==loadToken)return;
    papers=data;
    const years=new Set(data.map(p=>String(p.year)));
    for(const v of years)year.add(new Option(v,v));
    if(initial&&years.has(params.get('year')))year.value=params.get('year');
    selectMode(initial?params.get('set'):undefined);
    updateOverview();
  } catch {
    if (token !== loadToken) return;
    summary.textContent = 'Unable to load the question bank. Reload to try again.';
    list.textContent = 'The paper list could not load. ';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => switchTrack(track, initial));
    list.append(retry);
  }
}
window.addEventListener('tclab:gate-track',e=>switchTrack(e.detail.track));
const initialTrack=document.getElementById('screen-home')?.dataset.activeTrack;
switchTrack(location.hash==='#/gate-ee-papers'?'gate-ee':location.hash==='#/gate-cs-papers'?'gate-cs':initialTrack||'gate',true);
