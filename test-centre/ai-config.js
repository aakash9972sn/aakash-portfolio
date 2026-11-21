// Hosted service on GitHub Pages; same-origin Gemini routes on Node hosting.
window.TEST_CENTRE_AI_ENDPOINT = (window.AAKASH_BACKEND_BASE || '') + '/api';

window.AAKASH_AI = {
  endpoint: (window.AAKASH_BACKEND_BASE || '') + '/api/ai/chat/stream',
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
