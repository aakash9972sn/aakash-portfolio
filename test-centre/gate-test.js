import {renderCSQuestion} from './gate-cs-reader.js?v=1';
import {attemptKey, loadPapers, makeSets, units} from './gate-library.js?v=archive4';

import {loadDigitizedSet, restoreTranscription, requestTranscription} from './gate-digitization.js?v=banks1';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get('mode');
const year = params.get('year') || '';
const setId = params.get('set');
const isCS = /^CS\d/.test(setId || '');
const isEE = /^EE\d/.test(setId || '');
let key;
const snapshot = params.get('attempt');
const historyKey = 'tclab.analysis.history.v1';
const cachedImages = new Map();
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
let set, attempt, clock, renderId = 0;
let confirmAction;

function freshAttempt() {
  return {id:crypto.randomUUID(), current:0, responses:{}, flags:{}, finished:false,
    deadline:mode === 'paper' ? Date.now() + 180 * 60 * 1000 : null};
}
function save() {
  if (snapshot) return;
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
  if (entry.question.marksToAll) return 'correct';
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
function penalty(entry) {
  const q = entry.question;
  return q.type === 'MCQ' && !q.linkedPrevious ? q.marks / (entry.paper.year <= 2008 ? 4 : 3) : 0;
}
function keyLabel(question) {
  if (question.marksToAll) return 'Marks to all (official key)';
  return question.answers.map(answer => {
    if (typeof answer === 'string') return answer.split('').join(' + ');
    return answer[0] === answer[1] ? String(answer[0]) : answer.join(' to ');
  }).join(' or ');
}

function imageBatch(entry, index) {
  if (entry.paper.sourcePdf) return Promise.resolve(null);
  const part = entry.paper.id + '-' + Math.floor(index / 8);
  if (!cachedImages.has(part)) {
    if (cachedImages.size >= 4) cachedImages.delete(cachedImages.keys().next().value);
    cachedImages.set(part, fetch('gate-papers/' + part + '.json?v=reader1').then(res => {
      if (!res.ok) throw new Error('Image request failed');
      return res.json();
    }).catch(error => { cachedImages.delete(part); throw error; }));
  }
  return cachedImages.get(part);
}
async function questionImage(entry, index = entry.index) {
  if (entry.paper.sourcePdf) return renderCSQuestion(entry.paper,index);
  let batch;
  try { batch = await imageBatch(entry, index); } catch (error) {
    if (!isEE) throw error;
    const {renderEEQuestion} = await import('./gate-ee-reader.js?v=1');
    return renderEEQuestion(entry.paper,index);
  }
  const img = document.createElement('img');
  img.alt = 'Original question with its printed figures and answer choices, ' + entry.paper.name +
    ', ' + entry.paper.questions[index].number;
  img.src = 'data:image/webp;base64,' + batch[index % 8];
  return img;
}
function imageView(img, name) {
  const frame = document.createElement('div');
  frame.className = 'gt-image';
  const enlarge = document.createElement('button');
  enlarge.type = 'button';
  enlarge.className = 'btn btn-ghost';
  enlarge.textContent = 'Enlarge ' + name;
  enlarge.onclick = () => {
    const viewport = $('image-scroll');
    const copy = img.cloneNode();
    viewport.classList.remove('fit');
    viewport.style.setProperty('--zoom-width', Math.ceil(Math.max(img.naturalWidth, img.clientWidth * 1.5, 800)) + 'px');
    viewport.replaceChildren(copy);
    $('image-title').textContent = name === 'diagram' ? 'Question diagram' : 'Question image';
    $('image-fit').textContent = 'Fit to width';
    $('image-viewer').showModal();
    viewport.scrollTo(0, 0);
  };
  frame.append(img, enlarge);
  return frame;
}

$('image-fit').onclick = () => {
  const fit = $('image-scroll').classList.toggle('fit');
  $('image-fit').textContent = fit ? 'Enlarge' : 'Fit to width';
  $('image-scroll').scrollTo(0, 0);
};
$('image-viewer').addEventListener('close', () => $('image-scroll').replaceChildren());

function showPrompt(entry) {
  const token = ++renderId;
  const prompt = $('prompt');
  prompt.replaceChildren();
  if (entry.question.native) {
    const p = document.createElement('p');
    p.textContent = entry.question.native[0];
    prompt.append(p);
  }
  if (entry.question.figure || entry.question.digitizedFigure) {
    const diagram = new Image();
    diagram.src = entry.question.figure?.file || entry.question.digitizedFigure;
    diagram.alt = entry.question.figure?.alt || 'AI-transcribed diagram; compare with the original question.';
    diagram.className = 'gt-diagram';
    const view = imageView(diagram, 'diagram');
    if (entry.question.figure) prompt.append(view);
    else {
      const alternate = document.createElement('details');
      const caption = document.createElement('summary');
      caption.textContent = 'Compare AI-redrawn diagram';
      // Some exported SVGs are malformed. The printed figure stays visible.
      diagram.addEventListener('error', () => alternate.remove(), {once:true});
      alternate.append(caption, view);
      prompt.append(alternate);
    }
  }
  const source = document.createElement(entry.question.native ? 'details' : 'div');
  if (entry.question.native) {
    const caption = document.createElement('summary');
    const redrawn = Boolean(entry.question.digitizedFigure || entry.question.digitizedOptions || entry.question.usePrintedFigures);
    source.open = redrawn;
    caption.textContent = redrawn ? 'Printed question and original figures' :
      entry.question.digitized ? 'View original question (verify AI transcription)' : 'View original question';
    source.append(caption);
  }
  const stage = document.createElement('div');
  stage.textContent = 'Loading question…';
  source.append(stage);
  prompt.append(source);
  if (entry.question.native && !source.open && !entry.question.linkedPrevious) {
    source.addEventListener('toggle', function onOpen() {
      if (!source.open) return;
      source.removeEventListener('toggle', onOpen);
      if (token === renderId) loadOriginal();
    });
    return;
  }
  loadOriginal();

  async function loadOriginal() {
    try {
      const img = await questionImage(entry);
      if (token !== renderId) return;
      stage.replaceChildren(imageView(img, 'image'));
      const next = set.questions[attempt.current + 1];
      if (next && !next.question.native && !navigator.connection?.saveData) imageBatch(next, next.index).catch(() => {});
      if (entry.question.linkedPrevious) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'View preceding linked question';
        details.append(summary, imageView(await questionImage(entry, entry.index - 1), 'image'));
        if (token === renderId) prompt.prepend(details);
      }
    } catch {
      if (token !== renderId) return;
      const retry = document.createElement('button');
      retry.className = 'btn btn-ghost';
      retry.textContent = 'Retry loading question';
      retry.onclick = () => { stage.textContent = 'Loading question…'; loadOriginal(); };
      stage.replaceChildren(retry);
    }
  }
}
function paintCell(button, entry, index) {
  const answered = valid(entry);
  const marked = Boolean(attempt.flags[responseId(entry)]);
  button.className = 'pcell';
  if (marked || answered) button.classList.add(marked && answered ? 'is-answered-marked' : marked ? 'is-marked' : 'is-answered');
  if (index === attempt.current) button.classList.add('is-current');
  button.setAttribute('aria-label', 'Question ' + (index + 1) + (answered ? ', answered' : ', unanswered') + (marked ? ', marked for review' : ''));
}

function updateProgress() {
  const count = set.questions.filter(valid).length;
  $('progress').textContent = count + ' of ' + set.questions.length + ' answered';
  const entry = set.questions[attempt.current];
  const button = $('palette').children[attempt.current];
  const flag = Boolean(attempt.flags[responseId(entry)]);
  paintCell(button, entry, attempt.current);
  $('flag').classList.toggle('is-on', flag);
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
  controls.classList.toggle('gt-letters', q.type !== 'NAT' && !q.native);
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
      label.className = 'opt';
      const input = document.createElement('input');
      input.type = q.type === 'MSQ' ? 'checkbox' : 'radio';
      input.name = 'answer'; input.value = letter; input.checked = current.includes(letter);
      label.classList.toggle('is-selected', input.checked);
      input.addEventListener('change', () => {
        for (const el of controls.querySelectorAll('input')) el.parentElement.classList.toggle('is-selected', el.checked);
        record(entry, [...controls.querySelectorAll(':checked')].map(node => node.value).join(''));
      });
      const letterKey = document.createElement('span');
      letterKey.className = 'opt-key';
      letterKey.textContent = letter;
      label.append(input, letterKey);
      if (q.native) {
        const text = document.createElement('span');
        text.className = 'opt-text';
        text.textContent = q.native[i + 1];
        label.append(text);
      }
      if (q.digitizedOptions?.[i]) {
        const img = new Image();
        img.src = q.digitizedOptions[i];
        img.alt = 'Transcribed diagram for option ' + letter;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '180px';
        const figure = document.createElement('span');
        figure.className = 'gt-option-figure';
        figure.append(img, 'AI redrawing · see printed option');
        label.append(figure);
      }
      controls.append(label);
    }
  }
}

// Review tools use the existing outcome function, including historical linked-question rules.
let reviewFilter = 'all';
function matchesReview(entry) {
  const result = outcome(entry);
  return reviewFilter === 'all' || (reviewFilter === 'ungraded' ?
    result === 'ungraded' || result === 'linked' : result === reviewFilter);
}
function renderReviewTools(counts, stats) {
  const attempted = counts.correct + counts.incorrect;
  const accuracy = attempted ? (100 * counts.correct / attempted).toFixed(1) + '%' : 'Not applicable';
  const panel = document.createElement('div');
  panel.id = 'gate-review-tools';
  const summary = document.createElement('p');
  summary.textContent = 'Accuracy: ' + accuracy + ' · ' + attempted + ' graded responses (excluding linked/no-key questions)';
  panel.append(summary);
  const field = document.createElement('label');
  field.textContent = 'Review questions: ';
  const filter = document.createElement('select');
  filter.setAttribute('aria-label','Filter questions by outcome');
  for (const [value,label,n] of [['all','All',set.questions.length],['incorrect','Incorrect',counts.incorrect],
    ['skipped','Skipped',counts.skipped],['correct','Correct',counts.correct],
    ['ungraded','Ungraded / linked',counts.ungraded+counts.linked]]) {
    const option = new Option(label+' ('+n+')',value);
    option.disabled = n === 0;
    filter.add(option);
  }
  reviewFilter = 'all';
  filter.addEventListener('change', () => {
    reviewFilter = filter.value;
    const first = set.questions.findIndex(matchesReview);
    if (first >= 0) jump(first);
  });
  field.append(filter);
  panel.append(field);
  for (const [title,group,fieldName] of [['Unit-wise performance',entry=>units.get(entry.question.unit)||entry.question.unit||'General','unitStats'],
    ['Topic-wise performance',entry=>entry.question.topic||'General','topicStats']]) {
    const groups = new Map();
    for (const entry of set.questions) {
      const name = group(entry);
      if (!groups.has(name)) groups.set(name,{correct:0,incorrect:0,skipped:0,excluded:0});
      const status = outcome(entry);
      groups.get(name)[['correct','incorrect','skipped'].includes(status)?status:'excluded']++;
    }
    stats[fieldName] = Object.fromEntries([...groups].map(([name, n]) => [name, {
      correct:n.correct, wrong:n.incorrect, skipped:n.skipped, excluded:n.excluded,
      total:n.correct + n.incorrect + n.skipped + n.excluded
    }]));
    const details = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = title;
    details.append(caption);
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const label of ['Topic / unit','Correct','Incorrect','Skipped','Excluded','Accuracy']) {
      const th = document.createElement('th');
      th.scope = 'col'; th.textContent = label; head.append(th);
    }
    const body = table.createTBody();
    const ordered = [...groups].sort((a,b)=>(b[1].incorrect+b[1].skipped)-(a[1].incorrect+a[1].skipped)||a[0].localeCompare(b[0]));
    for (const [name,n] of ordered) {
      const row = body.insertRow();
      const th = document.createElement('th'); th.scope='row'; th.textContent=name; row.append(th);
      const gradedResponses = n.correct + n.incorrect;
      const groupAccuracy = gradedResponses ? (100 * n.correct / gradedResponses).toFixed(1) + '%' : '—';
      for (const value of [n.correct, n.incorrect, n.skipped, n.excluded, groupAccuracy]) {
        row.insertCell().textContent = String(value);
      }
    }
    wrap.append(table); details.append(wrap); panel.append(details);
  }
  const weak = Object.entries(stats.topicStats).filter(([,n]) => n.wrong > 0)
    .sort((a,b) => b[1].wrong - a[1].wrong || a[0].localeCompare(b[0])).slice(0,3);
  if (weak.length) {
    const note = document.createElement('p');
    note.textContent = 'Topics to revisit: ' + weak.map(([name,n]) => name + ' (' + n.wrong + ' incorrect)').join(' · ');
    panel.prepend(note);
  }
  $('gate-review-tools')?.remove();
  $('breakdown').after(panel);
}
function adjacentReview(direction) {
  for (let i = attempt.current + direction; i >= 0 && i < set.questions.length; i += direction) {
    if (!attempt.finished || matchesReview(set.questions[i])) return i;
  }
  return -1;
}
function syncReviewPalette() {
  for (const [i,cell] of [...$('palette').children].entries()) {
    const match = !attempt.finished || matchesReview(set.questions[i]);
    cell.hidden = !match;
    if (attempt.finished) {
      cell.dataset.outcome = outcome(set.questions[i]);
      const entry = set.questions[i];
      cell.setAttribute('aria-label', 'Question ' + (i + 1) + ' · ' + outcome(entry));
    } else delete cell.dataset.outcome;
  }
}

function showQuestion(focus = false) {
  const entry = set.questions[attempt.current];
  $('position').textContent = 'Question ' + (attempt.current + 1) + ' of ' + set.questions.length;
  $('source').textContent = [entry.paper.name, entry.question.number, entry.question.topic,
    units.get(entry.question.unit), entry.question.type].filter(Boolean).join(' · ');
  $('prev').disabled = adjacentReview(-1) < 0;
  const last = attempt.current + 1 === set.questions.length;
  $('next').disabled = attempt.finished && adjacentReview(1) < 0;
  $('next').textContent = last && !attempt.finished ? 'Submit test' : attempt.finished ? 'Next →' : 'Save & Next';
  for (const id of ['flag', 'clear', 'submit']) $(id).hidden = attempt.finished;
  const oldCell = $('palette').querySelector('[aria-current]');
  oldCell?.removeAttribute('aria-current');
  oldCell?.classList.remove('is-current');
  $('palette').children[attempt.current].setAttribute('aria-current','true');
  $('question-content').classList.toggle('with-diagram', Boolean(entry.question.figure || entry.question.digitizedFigure));
  const deduction = penalty(entry);
  $('marking').textContent = entry.question.marksToAll ? '+' + entry.question.marks + ' marks to all (official key)' : !entry.question.answers.length ? 'Review only · no scorable key' :
    '+' + entry.question.marks + ' for a correct answer · ' +
    (deduction ? '−' + Number(deduction.toFixed(3)) + ' for an incorrect answer' : 'No negative marking') +
    (entry.question.linkedPrevious && mode === 'paper' && entry.paper.year >= 2008 ? ' · Requires the preceding answer to be correct' : '');
  $('digitize').hidden = isCS || isEE || Boolean(entry.question.native && !entry.question.digitized);
  $('digitize').textContent = entry.question.digitized ? 'Re-transcribe with AI' : 'Transcribe with AI';
  $('digitize').disabled = false;
  $('explain').hidden = !attempt.finished || !entry.question.native;
  $('explain').disabled = false;
  $('ai-note').textContent = '';
  showPrompt(entry);
  showControls(entry);
  window.TestCentreMath?.render?.($('question-content'));
  const review = {correct:'Correct', incorrect:'Incorrect', skipped:'Skipped', linked:'No credit · preceding linked answer required', ungraded:'Review only · no scorable key'};
  $('feedback').textContent = attempt.finished ? review[outcome(entry)] +
    (entry.question.answers.length || entry.question.marksToAll ? ' · Key: ' + keyLabel(entry.question) : '') : '';
  updateProgress();
  syncReviewPalette();
  revealCurrentCell();
  if (focus) $('position').focus();
}
function jump(i) {
  attempt.current = i;
  save();
  showQuestion(true);
}
function finish() {
  if ($('image-viewer').open) $('image-viewer').close();
  if ($('palette-panel').matches(':modal')) $('palette-panel').close();
  if ($('confirm').open) $('confirm').close('cancel');
  attempt.finished = true;
  clearInterval(clock);
  save();
  $('timer').textContent = 'Review';
  $('result').hidden = false;
  const counts = {correct:0, incorrect:0, skipped:0, ungraded:0, linked:0};
  let positive = 0, negative = 0, maximum = 0;
  for (const entry of set.questions) {
    const status = outcome(entry);
    counts[status]++;
    if (status === 'ungraded') continue;
    const weight = entry.question.marks;
    maximum += weight;
    if (status === 'correct') positive += weight;
    if (status === 'incorrect') negative += penalty(entry);
  }
  const score = Number((positive - negative).toFixed(2));
  $('marks').textContent = 'Practice marks: ' + score + ' / ' + maximum +
    ' · Earned ' + positive + ' · Deductions ' + Number(negative.toFixed(2));
  const graded = set.questions.length - counts.ungraded;
  $('score').textContent = graded ? counts.correct + ' correct out of ' + graded + ' questions with scorable keys' :
    'Responses saved for self-review';
  $('breakdown').textContent = counts.incorrect + ' incorrect · ' + counts.skipped +
    ' skipped with keys · ' + counts.ungraded + ' ungraded' + (counts.linked ? ' · ' + counts.linked + ' dependent on a preceding answer' : '');
  const stats = {};
  renderReviewTools(counts, stats);
  $('retake').hidden = Boolean(snapshot);
  $('status').textContent = 'Submitted · Review questions or filter mistakes and skipped questions.';
  if (!snapshot) recordResult(counts, stats, score, maximum);
  showQuestion();
}
function recordResult(counts, stats, score, maximum) {
  attempt.id ||= crypto.randomUUID();
  attempt.submittedAt ||= Date.now();
  save();
  const ownerUid = window.AakashAccount?.getState()?.uid || null;
  const row = {
    ownerUid, testId:'gate-' + attempt.id, at:attempt.submittedAt, title:set.name,
    exam:'GATE', examId:'gate', subject:isEE ? 'Electrical Engineering' : isCS ? 'Computer Science and Information Technology' : 'Electronics and Communication', subjectId:isEE ? 'gate-ee' : isCS ? 'gate-cs' : 'gate-ec',
    gate:{mode, set:setId, year, attempt:attempt.id}, score, total:maximum,
    correct:counts.correct, wrong:counts.incorrect, unattempted:counts.skipped,
    excluded:counts.linked + counts.ungraded,
    accuracy:Number((100 * counts.correct / (counts.correct + counts.incorrect || 1)).toFixed(1)), ...stats
  };
  try {
    const rows = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const earlier = rows.filter(item => item.ownerUid === ownerUid && item.gate?.mode === mode &&
      item.gate.set === setId && (mode === 'paper' || item.gate.year === year) && item.at < row.at)
      .sort((a,b) => a.at - b.at).slice(-4);
    if (earlier.length) {
      const trend = document.createElement('details');
      const label = document.createElement('summary');
      label.textContent = 'Recent scores for this set';
      const list = document.createElement('ol');
      for (const result of [...earlier,row]) {
        const item = document.createElement('li');
        item.textContent = new Date(result.at).toLocaleString() + ' · ' + result.score + ' / ' + result.total;
        list.append(item);
      }
      trend.append(label,list);
      $('gate-review-tools').append(trend);
    }
    localStorage.setItem(key + '.' + attempt.id, JSON.stringify(attempt));
    if (rows.some(item => item.testId === row.testId && item.ownerUid === ownerUid)) return;
    rows.push(row);
    localStorage.setItem(historyKey, JSON.stringify(rows));
    if (ownerUid) window.AakashAccount.save('testAttempts', row.testId + '-' + row.at, row);
  } catch { $('status').textContent = 'Attempt history could not be saved on this device.'; }
}
function tick() {
  const seconds = window.TestCentreCore.remaining(attempt.deadline);
  if (seconds === 0) { finish(); return; }
  if (seconds <= 300 && !$('timer').classList.contains('low-time')) {
    $('timer').classList.add('low-time');
    $('status').textContent = 'Five minutes or less remaining. Responses submit when the timer expires.';
  }
  $('timer').textContent = Math.floor(seconds / 3600) + ':' +
    String(Math.floor(seconds / 60) % 60).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
}
function start() {
  clearInterval(clock);
  $('timer').classList.remove('low-time');
  $('result').hidden = true;
  reviewFilter = 'all';
  $('gate-review-tools')?.remove();
  $('palette').replaceChildren();
  set.questions.forEach((entry, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = i + 1;
    paintCell(button, entry, i);
    button.onclick = () => {
      if ($('palette-panel').matches(':modal')) $('palette-panel').close();
      jump(i);
    };
    $('palette').append(button);
  });
  $('workbench').hidden = false;
  syncPalette();
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
$('prev').onclick = () => { const i = adjacentReview(-1); if (i >= 0) jump(i); };
$('next').onclick = () => {
  const i = adjacentReview(1);
  if (i >= 0) jump(i);
  else if (!attempt.finished) askSubmit();
};
async function questionAI(kind) {
  const entry = set.questions[attempt.current];
  const token = renderId;
  const button = $(kind);
  button.disabled = true;
  $('ai-note').textContent = kind === 'digitize' ? 'Transcribing the printed question…' : 'Preparing an explanation…';
  try {
    if (kind === 'digitize') {
      await requestTranscription(entry);
      if (token === renderId) showQuestion();
    } else {
      const result = await window.HostedAI.request({action:'doubt', question:{
        exam:'GATE', subject:entry.question.topic, question:entry.question.native[0],
        options:entry.question.native.slice(1), userDoubt:'Explain this question. Recorded key: ' +
          (keyLabel(entry.question) || 'unavailable') + '. My response: ' + (response(entry) || 'skipped')
      }});
      if (token === renderId) $('ai-note').textContent = 'AI explanation · ' + result.answer;
    }
  } catch (error) {
    if (token === renderId) $('ai-note').textContent = kind === 'digitize' && error.name === 'Error'
      ? error.message : 'AI is unavailable. Use the printed question or retry.';
  } finally { if (token === renderId) button.disabled = false; }
}
$('digitize').onclick = () => questionAI('digitize');
$('explain').onclick = () => questionAI('explain');
$('flag').onclick = () => {
  const id = responseId(set.questions[attempt.current]);
  attempt.flags[id] = !attempt.flags[id];
  save(); updateProgress();
};
$('clear').onclick = () => { record(set.questions[attempt.current], ''); showQuestion(); };
function askSubmit() {
  if ($('palette-panel').matches(':modal')) $('palette-panel').close();
  confirm('Submit this test?', $('progress').textContent + '. Your responses will be saved for review.', finish);
}
$('submit').onclick = askSubmit;
$('retake').onclick = () => confirm('Start a new attempt?', 'This replaces the saved attempt for this test on this device.', () => {
  attempt = freshAttempt(); start();
});
const mobile = matchMedia('(max-width: 900px)');
const palettePanel = $('palette-panel');
function revealCurrentCell() {
  const grid = $('palette');
  const current = grid.querySelector('[aria-current]');
  if (!palettePanel.open || !current) return;
  const cell = current.getBoundingClientRect();
  const frame = grid.getBoundingClientRect();
  if (cell.top < frame.top + 4) grid.scrollTop += cell.top - frame.top - 4;
  else if (cell.bottom > frame.bottom - 4) grid.scrollTop += cell.bottom - frame.bottom + 4;
}
function syncPalette() {
  if (palettePanel.open) palettePanel.close();
  if (!mobile.matches && !$('workbench').hidden) {
    palettePanel.setAttribute('open', '');
    revealCurrentCell();
  }
}
$('palette-open').onclick = () => {
  palettePanel.showModal();
  $('palette-open').setAttribute('aria-expanded', 'true');
  document.body.classList.add('palette-open');
  $('palette-close').focus();
  revealCurrentCell();
};
$('palette-close').onclick = () => palettePanel.close();
palettePanel.addEventListener('close', () => {
  if (palettePanel.matches(':modal')) return;
  $('palette-open').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('palette-open');
});
mobile.addEventListener('change', syncPalette);
try {
  const papers = isEE ? await fetch('gate-ee-index.json?v=1').then(r=>{if(!r.ok)throw Error('EE index unavailable');return r.json();}) : isCS ? await fetch('gate-cs-index.json?v=1').then(r=>{if(!r.ok)throw Error('CS index unavailable');return r.json();}) : await loadPapers();
  if (!['paper','topic','unit'].includes(mode)) throw new Error();
  set = makeSets(papers, mode, year).find(item => item.id === setId);
  if (!set?.questions.length) throw new Error();
  const back = new URLSearchParams({mode, set:setId});
  if (year) back.set('year', year);
  $('back-to-tests').href = './?' + back + (isCS ? '#/gate-cs-papers' : '#/gate-papers');
  if (isEE) $('back-to-tests').href = 'gate-ee.html';
  document.title = set.name + ' · GATE Test Centre';
  $('title').textContent = set.name;
  if (!isCS && !isEE) await loadDigitizedSet(set);
  for (const entry of set.questions) restoreTranscription(entry);
  function openAttempt() {
    key = attemptKey(mode, setId, year);
    if (snapshot) {
      const saved = JSON.parse(localStorage.getItem(key + '.' + snapshot));
      if (!saved?.finished || saved.id !== snapshot) {
        clearInterval(clock);
        $('workbench').hidden = $('result').hidden = true;
        $('status').textContent = 'This saved review is unavailable for this account on this device.';
        return false;
      }
      attempt = saved;
    } else attempt = restore();
    return true;
  }
  window.addEventListener('aakash:account-state', () => {
    if (key === attemptKey(mode, setId, year)) return;
    if ($('confirm').open) $('confirm').close('cancel');
    if ($('image-viewer').open) $('image-viewer').close();
    if (openAttempt()) start();
  });
  if (!openAttempt()) throw new Error('snapshot');
  if (location.hash) {
    const wanted = location.hash.slice(1);
    const index = set.questions.findIndex(({paper, question}) =>
      paper.id + '-' + question.number.replaceAll(' ', '') === wanted);
    if (index >= 0) {
      attempt.current = index;
      history.replaceState(history.state, '', location.pathname + location.search);
    }
  }
  start();
} catch (error) { if (error.message !== 'snapshot') $('status').textContent = 'This test could not open. Return to Test Centre and select a test.'; }
