export const units = new Map(Object.values(window.TEST_CENTRE_SYLLABI?.gate?.subjects || {})
  .flatMap(subject => subject.units.map(unit => [unit.id, unit.title])));
units.set('legacy', 'Earlier syllabus topics');

export function attemptKey(mode, setId, year) {
  const uid = window.AakashAccount?.getState()?.uid;
  const parts = [mode, setId, mode === 'paper' ? '' : year];
  if (uid) parts.push(uid);
  return 'tclab.gate.attempt.v1.' + JSON.stringify(parts);
}

let cachedPapersPromise;
export function loadPapers() {
  if (!cachedPapersPromise) {
    cachedPapersPromise = fetch('gate-pyp-index.json?v=reader1').then(response => {
      if (!response.ok) throw new Error('Unable to load GATE papers');
      return response.json();
    }).catch(error => { cachedPapersPromise = undefined; throw error; });
  }
  return cachedPapersPromise;
}

export function makeSets(papers, mode, year) {
  const sets = new Map();
  for (const paper of papers) {
    if (mode !== 'paper' && paper.booklet && paper.booklet !== 'A') continue;
    if (year && String(paper.year) !== String(year)) continue;
    paper.questions.forEach((question, index) => {
      const id = mode === 'paper' ? paper.id : question[mode];
      if (!sets.has(id)) {
        const name = mode === 'paper' ? paper.name : mode === 'unit' ? (units.get(id) || id) : id;
        sets.set(id, {id, name, questions: []});
      }
      sets.get(id).questions.push({paper, question, index});
    });
  }
  return mode === 'paper' ? [...sets.values()] :
    [...sets.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true}));
}

export function summarizeSet(set) {
  const counts = { MCQ: 0, MSQ: 0, NAT: 0 };
  let marks = 0;
  const years = new Set();
  for (const {paper, question} of set.questions) {
    counts[question.type] = (counts[question.type] || 0) + 1;
    marks += Number(question.marks) || 1;
    years.add(Number(paper.year));
  }
  const sorted = [...years].sort((a,b) => a-b);
  return {total:set.questions.length, marks,
    typesLabel:Object.entries(counts).filter(([,n]) => n).map(([type,n]) => n+' '+type).join(' · '),
    yearsLabel:sorted.length > 1 ? sorted[0]+'–'+sorted.at(-1) : String(sorted[0] || '')};
}
export function inspectSavedAttempt(set, mode, year) {
  try {
    const saved = JSON.parse(localStorage.getItem(attemptKey(mode,set.id,year)));
    if (!saved || !saved.responses || typeof saved.responses !== 'object') return null;
    const expired = mode === 'paper' && Number.isFinite(saved.deadline) && saved.deadline <= Date.now();
    const answeredCount = set.questions.filter(({paper,question,index}) => {
      const value = saved.responses[paper.id+'.'+index];
      return typeof value === 'string' && !!value.trim() &&
        (question.type !== 'NAT' || (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) && Number.isFinite(Number(value))));
    }).length;
    return {saved, expired, review: !!saved.finished || expired, answeredCount};
  } catch { return null; }
}
