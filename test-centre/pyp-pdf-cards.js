/* Register original image-based PDFs alongside ordinary CUET PG test cards.
 * These four paper sets have no verified answer key: PDF-mode answers are local
 * practice responses and are NEVER treated as scored MCQs. */
(function () {
  'use strict';
  const papers = window.PYPOriginalSourceManifest || [];
  const exam = (window.EXAM_DATA || []).find(e => e.id === 'cuet-pg');
  if (!exam) return;
  for (const source of papers) {
    if (source.test) continue; // Already registered as full question-bank tests.
    const subject = exam.subjects.find(s =>
      source.id.includes('zoology') ? s.id === 'cuet-zoology' : s.id === 'cuet-life-sciences');
    if (!subject || subject.tests.some(t => t.id === source.id)) continue;
    const year = source.id.match(/20\d\d/)?.[0] || '';
    const shift = source.title.match(/Shift\s*\d+/i)?.[0] || '';
    subject.tests.push({
      id: source.id, title: source.title, pyp: true, pdfOnly: true,
      questionCount: source.count, duration: source.duration,
      date: [year, shift].filter(Boolean).join(' · '),
      level: 'Previous-year paper',
      sourceNote: 'Original scanned PDF practice. The original text, figures and tables are preserved in the PDF. No verified answer key is supplied; responses remain ungraded and are saved only on this device.'
    });
  }
})();
