/* CUET PG 2023 paper registrations from three user-provided CSVs.
   Their answer keys are source-provided and not independently official-key verified. */
(function () {
  'use strict';
  const cuet = window.EXAM_DATA.find(exam => exam.id === 'cuet-pg');
  if (!cuet) return;
  const make = (id, title, date, subject, flagged) => ({
    id, title, bank: id, duration: 120,
    marking: { correct: 4, wrong: 1 }, level: 'Previous-year paper',
    pyp: true, paper: 'CUET PG ' + subject + ' 2023 · ' + date,
    date: '2023 · ' + date,
    reviewOnlyCount: flagged,
    sourceNote: 'Imported from user-provided 2023 CSV; answer keys have not been verified against an official NTA key. ' +
      flagged + ' source-noted uncertain/ambiguous questions are review-only. +4/−1 applies to scored questions; 120-minute practice timer.'
  });
  const life = cuet.subjects.find(subject => subject.id === 'cuet-life-sciences');
  const zoology = cuet.subjects.find(subject => subject.id === 'cuet-zoology');
  if (life) life.tests.push(
    make('cuet-pg-life-sciences-2023-shift2','Life Sciences · 2023 · Shift 2','Shift 2','Life Sciences',15),
    make('cuet-pg-life-sciences-2023-shift3','Life Sciences · 2023 · Shift 3','Shift 3','Life Sciences',7)
  );
  if (zoology) zoology.tests.push(
    make('cuet-pg-zoology-2023-shift1','Zoology · 2023 · Shift 1','Shift 1','Zoology',3)
  );
})();
