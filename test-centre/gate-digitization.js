import {applyDigitizedRecord} from './gate-transcription.mjs?v=ink2';
export {applyDigitizedRecord, svgImageSource} from './gate-transcription.mjs?v=ink2';

// Bundled Google AI Studio transcriptions. Official question metadata and keys
// remain in gate-pyp-index.json; never replace them with generated answers.
const supported = new Set(['EC2020', 'EC2021', 'EC2022', 'EC2025', 'EC2026']);
const cache = new Map();

function getPaper(id) {
  if (!supported.has(id)) return Promise.resolve(null);
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      try {
        const res = await fetch('gate-digitized/' + encodeURIComponent(id) + '.json?v=ec2020-22-v1',
          {signal: AbortSignal.timeout(6000)});
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
      } catch { return null; }
    })());
  }
  return cache.get(id);
}

export async function loadDigitizedSet(set) {
  const ids = [...new Set(set.questions.map(entry => entry.paper.id))];
  const maps = new Map(await Promise.all(ids.map(async id => [id, await getPaper(id)])));
  let imported = 0;
  for (const entry of set.questions) {
    const record = maps.get(entry.paper.id)?.[String(entry.index)];
    if (applyDigitizedRecord(entry, record, true)) imported++;
    if (record?.figureBox && entry.question.native && Array.isArray(record.figureBox) &&
        record.figureBox.length === 4 && record.figureBox.every(Number.isFinite)) {
      entry.question.originalFigureBox = record.figureBox;
      entry.question.usePrintedFigures = false;
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
      i && q.printedOptions?.[i-1] ? q.publishedTranscript.native[i] : value);
    q.usePrintedFigures = q.publishedTranscript.usePrintedFigures ||
      (!q.figure && !q.printedOptions && replacement.usePrintedFigures);
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
