// Same-origin Gemini backend routes (handled securely on server.js)
window.TEST_CENTRE_AI_ENDPOINT = (window.API_BASE_URL || '') + '/api';

window.AAKASH_AI = {
  endpoint: `${window.TEST_CENTRE_AI_ENDPOINT}/ai/chat/stream`,
  app: 'study',
  title: 'Aakash Gemini',
  intro:
    'Your fast Gemini study companion. Ask GATE/NEET concepts, clear doubts, or plan your revision right here.',
  suggestions: [
    'Explain Fourier Transform properties for GATE ECE',
    'Explain a tricky NEET Physics or Biology concept',
    'Help me choose a GATE practice test',
  ],
  privacy:
    'Questions use Gemini on the app server with public test-catalogue context only. Active test responses are never sent automatically.',
  isAllowed: () => !location.hash.startsWith('#/t/'),
  context: () => ({
    // PYPs and AI-generated CUET mocks are separate from EXAM_DATA subject modules.
    // Give Gemini accurate catalogue facts instead of making it infer availability.
    cuetPg: {
      available: true,
      subjects: ['Life Sciences (SCQP17)', 'Zoology (SCQP28)'],
      officialSyllabusRegistry: 'syllabus-data.js',
      aiMocks: 'Syllabus-driven Gemini MCQs for Life Sciences and Zoology; generation requires the live backend',
      previousYearPapers: [
        { exam: 'CUET PG', year: 2025, subject: 'Life Sciences', questions: 75 },
        { exam: 'CUET PG', year: 2023, subject: 'Life Sciences', shift: 2, questions: 100, reviewOnly: 15 },
        { exam: 'CUET PG', year: 2023, subject: 'Life Sciences', shift: 3, questions: 100, reviewOnly: 7 },
        { exam: 'CUET PG', year: 2023, subject: 'Zoology', shift: 1, questions: 100, reviewOnly: 3 },
        { exam: 'CUET PG', year: 2022, subject: 'Zoology', questions: 100 },
        { exam: 'CUCET', year: 2021, subject: 'Life Sciences', questions: 100 },
      ],
      totalImportedPreviousYearQuestions: 575,
      originalPdfArchive: '10 user-provided source PDFs (6 linked to scored paper sets; 4 with 350 questions available in original-PDF ungraded practice). PDFs must be attached on the device and remain in local browser storage.',
      note: '28 source-flagged questions across six imported papers are review-only and excluded from scoring; 2023 answer keys came from supplied CSVs and have not been independently verified against an official answer key.',
    },
    exams: (window.EXAM_DATA || []).map((exam) => ({
      name: exam.name,
      subjects: exam.subjects.map((subject) => ({
        name: subject.name,
        tests: subject.tests.slice(0, 6).map((test) => ({
          title: test.title,
          duration: test.duration,
          level: test.level,
        })),
      })),
    })),
  }),
};
