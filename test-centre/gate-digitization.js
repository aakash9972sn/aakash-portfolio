import {applyDigitizedRecord} from './gate-transcription.mjs?v=ink2';
export {applyDigitizedRecord, svgImageSource} from './gate-transcription.mjs?v=ink2';

// Bundled Google AI Studio transcriptions. Official question metadata and keys
// remain in gate-pyp-index.json; never replace them with generated answers.
const supported = new Set(['EC2020', 'EC2021', 'EC2022', 'EC2025', 'EC2026']);
const cache = new Map();
let batchManifest;
async function batchPapers() {
  batchManifest ??= fetch('gate-digitized/batch/manifest.json', {cache:'no-cache', signal:AbortSignal.timeout(6000)})
    .then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return batchManifest;
}

function bank(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url, {signal:AbortSignal.timeout(6000)})
      .then(r => r.ok ? r.json() : null)
      .catch(() => { cache.delete(url); return null; }));
  }
  return cache.get(url);
}

async function getPaper(id) {
  const filename = encodeURIComponent(id) + '.json?v=';
  const [curated, manifest] = await Promise.all([
    supported.has(id) ? bank('gate-digitized/' + filename + 'ec2020-22-v2') : null,
    batchPapers()
  ]);
  const version = manifest?.[id];
  if (!/^[0-9a-f]{16}$/.test(version || '')) return curated;
  const batch = await bank('gate-digitized/batch/' + filename + version);
  return {...batch, ...curated};
}

export async function loadDigitizedSet(set) {
  const ids = [...new Set(set.questions.map(entry => entry.paper.id))];
  const maps = new Map(await Promise.all(ids.map(async id => [id, await getPaper(id)])));
  let imported = 0;
  for (const entry of set.questions) {
    const record = maps.get(entry.paper.id)?.[String(entry.index)];
    if (!applyDigitizedRecord(entry, record, true)) continue;
    imported++;
    const q = entry.question;
    const validBox = box => Array.isArray(box) && box.length === 4 &&
      box.every(Number.isInteger) && box[0] >= 0 && box[1] >= 0 &&
      box[2] > box[0] && box[3] > box[1];
    const stem = validBox(record.figureBox);
    const options = q.type !== 'NAT' && Array.isArray(record.optionBoxes) &&
      record.optionBoxes.length === 4 && record.optionBoxes.every(validBox);
    if (stem) {
      q.originalFigureBox = record.figureBox;
      q.printedStem = record.printedStem === true;
    }
    if (options) q.originalOptionBoxes = record.optionBoxes;
    if (stem || options) {
      q.usePrintedFigures = false;
      q.publishedTranscript.usePrintedFigures = false;
    }
  }
  return imported;
}

const requests = new Map();
const storageKey = entry => 'tclab.gate.transcription.' +
  (entry.question.publishedTranscript ? 'ink2.' : 'v1.') + entry.paper.id + '.' + entry.index;

function replaceTranscription(entry, record) {
  const q = entry.question;
  if (q.native && !q.digitized) return false;
  const replacement = {type:q.type, figure:q.figure};
  if (!applyDigitizedRecord({question:replacement}, record)) return false;
  if (q.publishedTranscript) {
    q.native = replacement.native.map((value,i) =>
      i && (q.printedOptions?.[i-1] || q.originalOptionBoxes?.[i-1]) ? q.publishedTranscript.native[i] : value);
    q.usePrintedFigures = q.publishedTranscript.usePrintedFigures ||
      (!q.figure && !q.printedOptions && !q.originalFigureBox && !q.originalOptionBoxes && replacement.usePrintedFigures);
    q.manualTranscript = true;
  } else {
    delete q.usePrintedFigures;
    Object.assign(q, replacement);
  }
  return true;
}

export function usePublishedTranscription(entry) {
  const q = entry.question;
  if (!q.publishedTranscript) return;
  q.native = q.publishedTranscript.native;
  q.usePrintedFigures = q.publishedTranscript.usePrintedFigures;
  q.manualTranscript = false;
  try { localStorage.removeItem(storageKey(entry)); } catch { /* Session reset still applies. */ }
}

export function restoreTranscription(entry) {
  try {
    return replaceTranscription(entry, JSON.parse(localStorage.getItem(storageKey(entry))));
  } catch { return false; }
}

export async function requestTranscription(entry) {
  const key = storageKey(entry);
  if (!requests.has(key)) {
    const task = (async () => {
      const res = await fetch((window.API_BASE_URL || '') + '/api/ai/gate-digitize', {
        method:'POST', headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(45000),
        body:JSON.stringify({paperId:entry.paper.id, index:entry.index, refresh:!!entry.question.digitized})
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.error === 'string' ? detail.error.slice(0,180) : 'Transcription unavailable. Use the printed question.');
      }
      const record = await res.json();
      if (!replaceTranscription(entry, record)) throw new Error('Incomplete transcription');
      try { localStorage.setItem(key, JSON.stringify(record)); } catch { /* Available for this session. */ }
    })().finally(() => requests.delete(key));
    requests.set(key, task);
  }
  return requests.get(key);
}
