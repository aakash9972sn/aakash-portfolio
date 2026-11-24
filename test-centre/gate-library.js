export const units = new Map(Object.values(window.TEST_CENTRE_SYLLABI.gate.subjects)
  .flatMap(subject => subject.units.map(unit => [unit.id, unit.title])));
units.set('legacy', 'Earlier syllabus topics');

export function attemptKey(mode, setId, year) {
  return 'tclab.gate.attempt.v1.' + JSON.stringify([mode, setId, mode === 'paper' ? '' : year]);
}

export async function loadPapers() {
  const response = await fetch('gate-pyp-index.json?v=tests1');
  if (!response.ok) throw new Error('Unable to load GATE papers');
  return response.json();
}

export function makeSets(papers, mode, year) {
  const sets = new Map();
  for (const paper of papers) {
    if (mode !== 'paper' && paper.booklet && paper.booklet !== 'A') continue;
    if (year && String(paper.year) !== year) continue;
    paper.questions.forEach((question, index) => {
      const id = mode === 'paper' ? paper.id : question[mode];
      if (!sets.has(id)) {
        const name = mode === 'paper' ? paper.name : mode === 'unit' ? units.get(id) : id;
        sets.set(id, {id, name, questions: []});
      }
      sets.get(id).questions.push({paper, question, index});
    });
  }
  return mode === 'paper' ? [...sets.values()] :
    [...sets.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true}));
}
