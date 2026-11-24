import {loadPapers, makeSets, units} from './gate-library.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get('mode');
const year = params.get('year') || '';
const setId = params.get('set');
const key = 'tclab.gate.attempt.v1.' + JSON.stringify([mode, setId, mode === 'paper' ? '' : year]);
const cachedImages = new Map();
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
let set, attempt, clock, renderId = 0;
let confirmAction;

function freshAttempt() {
  return {current:0, responses:{}, flags:{}, finished:false,
    deadline:mode === 'paper' ? Date.now() + 180 * 60 * 1000 : null};
}
function save() {
  try { localStorage.setItem(key, JSON.stringify(attempt)); }
  catch { $('status').textContent = 'This browser could not save progress. Keep this tab open to finish.'; }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isInteger(saved.current) && saved.current >= 0 && saved.current < set.questions.length &&
        saved.responses && saved.flags && (mode !== 'paper' || Number.isFinite(saved.deadline))) return saved;
  } catch { /* Start a new attempt when browser storage is unavailable. */ }
  return freshAttempt();
}
function responseId(entry) { return entry.paper.id + '.' + entry.index; }
function response(entry) { return attempt.responses[responseId(entry)] || ''; }
function valid(entry) {
  const value = response(entry);
  return Boolean(value) && (entry.question.type !== 'NAT' || (numeric.test(value) && Number.isFinite(Number(value))));
}
function outcome(entry) {
  const {type, answers} = entry.question;
  if (!answers.length) return 'ungraded';
  if (mode === 'paper' && entry.question.linkedPrevious && entry.paper.year >= 2008) {
    const previous = {paper:entry.paper, index:entry.index - 1, question:entry.paper.questions[entry.index - 1]};
    if (!previous.question.answers.length) return 'ungraded';
    if (outcome(previous) !== 'correct') return 'linked';
  }
  if (!valid(entry)) return 'skipped';
  const value = response(entry);
  const correct = type === 'NAT' ? answers.some(([lo, hi]) => Number(value) >= lo && Number(value) <= hi) :
    answers.includes(value);
  return correct ? 'correct' : 'incorrect';
}
function keyLabel(question) {
  return question.answers.map(answer => {
    if (typeof answer === 'string') return answer.split('').join(' + ');
    return answer[0] === answer[1] ? String(answer[0]) : answer.join(' to ');
  }).join(' or ');
}

async function questionImage(entry, index = entry.index) {
  const part = entry.paper.id + '-' + Math.floor(index / 8);
  if (!cachedImages.has(part)) {
    if (cachedImages.size >= 4) cachedImages.delete(cachedImages.keys().next().value);
    cachedImages.set(part, fetch('gate-papers/' + part + '.json').then(res => {
      if (!res.ok) throw new Error('Image request failed');
      return res.json();
    }).catch(error => { cachedImages.delete(part); throw error; }));
  }
  const batch = await cachedImages.get(part);
  const img = document.createElement('img');
  img.alt = 'Original question with its printed figures and answer choices, ' + entry.paper.name +
    ', ' + entry.paper.questions[index].number;
  img.src = 'data:image/webp;base64,' + batch[index % 8];
  return img;
}
async function showPrompt(entry) {
  const token = ++renderId;
  const prompt = $('prompt');
  prompt.replaceChildren();
  if (entry.question.native) {
    const p = document.createElement('p');
    p.textContent = entry.question.native[0];
    prompt.append(p);
  }
  const source = document.createElement(entry.question.native ? 'details' : 'div');
  if (entry.question.native) {
    const caption = document.createElement('summary');
    caption.textContent = 'View original question';
    source.append(caption);
  }
  const stage = document.createElement('div');
  stage.textContent = 'Loading question…';
  source.append(stage);
  prompt.append(source);
  try {
    const img = await questionImage(entry);
    if (token !== renderId) return;
    stage.replaceChildren(img);
    if (entry.question.linkedPrevious) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'View preceding linked question';
      details.append(summary, await questionImage(entry, entry.index - 1));
      if (token === renderId) prompt.prepend(details);
    }
  } catch {
    if (token !== renderId) return;
    const retry = document.createElement('button');
    retry.textContent = 'Retry loading question';
    retry.onclick = () => showPrompt(entry);
    stage.replaceChildren(retry);
  }
}
function updateProgress() {
  const count = set.questions.filter(valid).length;
  $('progress').textContent = count + ' of ' + set.questions.length + ' answered';
  const entry = set.questions[attempt.current];
  const button = $('palette').children[attempt.current];
  const flag = Boolean(attempt.flags[responseId(entry)]);
  button.classList.toggle('answered', valid(entry));
  button.classList.toggle('flagged', flag);
  button.setAttribute('aria-label', 'Question ' + (attempt.current + 1) + (valid(entry) ? ', answered' : ', unanswered') + (flag ? ', marked for review' : ''));
  $('flag').setAttribute('aria-pressed', String(flag));
}
function record(entry, value) {
  attempt.responses[responseId(entry)] = value;
  save();
  updateProgress();
}
function showControls(entry) {
  const q = entry.question, current = response(entry);
  const controls = $('controls');
  controls.replaceChildren();
  $('answers').disabled = attempt.finished;
  $('answers').querySelector('legend').textContent = q.type === 'NAT' ? 'Enter a numerical answer' :
    q.type === 'MSQ' ? 'Select all correct options' : 'Select one option';
  if (q.type === 'NAT') {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', 'Numerical answer');
    input.value = current;
    input.addEventListener('input', () => {
      const value = input.value.trim();
      record(entry, value);
      $('feedback').textContent = value && !valid(entry) ? 'Enter a valid number to count this response.' : '';
    });
    controls.append(input);
  } else {
    for (const [i, letter] of [...'ABCD'].entries()) {
      const label = document.createElement('label');
      label.className = 'gt-choice';
      const input = document.createElement('input');
      input.type = q.type === 'MSQ' ? 'checkbox' : 'radio';
      input.name = 'answer'; input.value = letter; input.checked = current.includes(letter);
      input.addEventListener('change', () => record(entry,
        [...controls.querySelectorAll(':checked')].map(node => node.value).join('')));
      label.append(input, q.native ? letter + '. ' + q.native[i+1] : letter);
      controls.append(label);
    }
  }
}
function showQuestion(focus = false) {
  const entry = set.questions[attempt.current];
  $('position').textContent = 'Question ' + (attempt.current + 1) + ' of ' + set.questions.length;
  $('source').textContent = [entry.paper.name, entry.question.number, entry.question.topic,
    units.get(entry.question.unit), entry.question.type].filter(Boolean).join(' · ');
  $('prev').disabled = attempt.current === 0;
  $('next').disabled = attempt.current + 1 === set.questions.length;
  for (const id of ['flag', 'clear', 'submit']) $(id).hidden = attempt.finished;
  $('palette').querySelector('[aria-current]')?.removeAttribute('aria-current');
  $('palette').children[attempt.current].setAttribute('aria-current','true');
  showPrompt(entry);
  showControls(entry);
  const review = {correct:'Correct', incorrect:'Incorrect', skipped:'Skipped', linked:'No credit · preceding linked answer required', ungraded:'Review only · no scorable key'};
  $('feedback').textContent = attempt.finished ? review[outcome(entry)] +
    (entry.question.answers.length ? ' · Key: ' + keyLabel(entry.question) : '') : '';
  updateProgress();
  if (focus) $('position').focus();
}
function jump(i) {
  attempt.current = i;
  save();
  showQuestion(true);
}
function finish() {
  if ($('confirm').open) $('confirm').close('cancel');
  attempt.finished = true;
  clearInterval(clock);
  save();
  $('timer').textContent = 'Review';
  $('result').hidden = false;
  const counts = {correct:0, incorrect:0, skipped:0, ungraded:0, linked:0};
  let marks = 0, maximum = 0;
  for (const entry of set.questions) {
    const status = outcome(entry);
    counts[status]++;
    if (status === 'ungraded') continue;
    const weight = entry.question.marks;
    maximum += weight;
    if (status === 'correct') marks += weight;
    if (status === 'incorrect' && entry.question.type === 'MCQ' && !entry.question.linkedPrevious) {
      marks -= weight / (entry.paper.year <= 2008 ? 4 : 3);
    }
  }
  $('marks').textContent = mode === 'paper' ? 'Practice marks: ' + Number(marks.toFixed(2)) + ' / ' + maximum : '';
  const graded = set.questions.length - counts.ungraded;
  $('score').textContent = graded ? counts.correct + ' correct out of ' + graded + ' questions with scorable keys' :
    'Responses saved for self-review';
  $('breakdown').textContent = counts.incorrect + ' incorrect · ' + counts.skipped +
    ' skipped with keys · ' + counts.ungraded + ' ungraded' + (counts.linked ? ' · ' + counts.linked + ' dependent on a preceding answer' : '');
  $('status').textContent = 'Submitted · Select a question to review your response.';
  showQuestion();
}
function tick() {
  const seconds = window.TestCentreCore.remaining(attempt.deadline);
  if (seconds === 0) { finish(); return; }
  $('timer').textContent = Math.floor(seconds / 3600) + ':' +
    String(Math.floor(seconds / 60) % 60).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
}
function start() {
  clearInterval(clock);
  $('result').hidden = true;
  $('palette').replaceChildren();
  set.questions.forEach((entry, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = i + 1;
    button.classList.toggle('answered', valid(entry));
    button.classList.toggle('flagged', Boolean(attempt.flags[responseId(entry)]));
    button.onclick = () => jump(i);
    $('palette').append(button);
  });
  $('workbench').hidden = false;
  if (attempt.finished) { finish(); return; }
  $('status').textContent = 'Progress saves on this device.';
  save();
  showQuestion();
  if (mode === 'paper') { clock = setInterval(tick, 1000); tick(); }
  else $('timer').textContent = 'Untimed practice';
}
function confirm(title, copy, action) {
  confirmAction = action;
  $('confirm-title').textContent = title;
  $('confirm-copy').textContent = copy;
  $('confirm-yes').textContent = action === finish ? 'Submit' : 'Start again';
  $('confirm').returnValue = '';
  $('confirm').showModal();
}
$('confirm').addEventListener('close', () => { if ($('confirm').returnValue === 'yes') confirmAction(); });
$('prev').onclick = () => jump(attempt.current - 1);
$('next').onclick = () => jump(attempt.current + 1);
$('flag').onclick = () => {
  const id = responseId(set.questions[attempt.current]);
  attempt.flags[id] = !attempt.flags[id];
  save(); updateProgress();
};
$('clear').onclick = () => { record(set.questions[attempt.current], ''); showQuestion(); };
$('submit').onclick = () => confirm('Submit this test?', $('progress').textContent + '. Your responses will be saved for review.', finish);
$('retake').onclick = () => confirm('Start a new attempt?', 'This replaces the saved attempt for this test on this device.', () => {
  attempt = freshAttempt(); start();
});
try {
  const papers = await loadPapers();
  if (!['paper','topic','unit'].includes(mode)) throw new Error();
  set = makeSets(papers, mode, year).find(item => item.id === setId);
  if (!set?.questions.length) throw new Error();
  document.title = set.name + ' · GATE EC Test Centre';
  $('title').textContent = set.name;
  attempt = restore(); start();
} catch { $('status').textContent = 'This test could not open. Return to Test Centre and select a test.'; }
