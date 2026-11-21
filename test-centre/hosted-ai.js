/* Test Centre transport for the configured server-side Gemini API. */
(() => {
  'use strict';

  const base = window.AAKASH_BACKEND_BASE || '';

  async function parseJsonSafely(response, fallbackError) {
    const raw = await response.text();
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error(fallbackError || 'AI server returned an empty response. Please retry.');
    }
    if (trimmed.startsWith('<')) {
      throw new Error(
        'Session or proxy returned a web page instead of AI data (HTTP ' +
          response.status +
          '). Please refresh this page and try again.'
      );
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(fallbackError || 'AI returned unreadable data. Please retry.');
    }
  }

  async function post(path, body, signal) {
    const url = base + path;
    let response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(60000),
    });

    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') && response.ok) {
      // Retry once with cache-busting query in case an auth/proxy edge served stale HTML
      response = await fetch(url + '?_=' + Date.now(), {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify(body),
        signal: signal || AbortSignal.timeout(60000),
      });
    }

    if (!response.ok) {
      let msg = '';
      try {
        const err = await parseJsonSafely(response);
        msg = err?.error || '';
      } catch (parseErr) {
        msg = parseErr?.message || '';
      }
      throw new Error(
        msg ||
          (response.status === 429
            ? 'AI usage limit reached. Please wait a moment and try again.'
            : 'AI service returned HTTP ' + response.status + '. Please retry.')
      );
    }
    return response;
  }

  async function stream(body, signal, onText) {
    const response = await post('/api/ai/chat/stream', body, signal);
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      throw new Error('Please refresh this page once and retry your question.');
    }
    if (!response.body) throw new Error('The AI stream is unavailable.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let done = false;

    function processBlock(block) {
      const raw = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!raw) return;
      if (raw === '[DONE]') {
        done = true;
        return;
      }
      const data = JSON.parse(raw);
      if (data.error) throw new Error(data.error);
      if (typeof data.text === 'string' && data.text.length > 0) {
        answer += data.text;
        onText?.(answer);
      }
      if (data.done) done = true;
    }

    try {
      while (!done) {
        const part = await reader.read();
        const chunk = part.done
          ? decoder.decode()
          : decoder.decode(part.value, { stream: true });
        buffer += chunk.replace(/\r\n/g, '\n');

        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          processBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
        }

        if (part.done) {
          if (buffer.trim()) processBlock(buffer);
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }

    if (!answer.trim()) {
      throw new Error('AI returned an incomplete answer. Please retry.');
    }
    return { answer, sources: [], googleGrounded: false };
  }

  async function request(body, signal, onText) {
    if (body.action === 'generate') {
      const subjects = {
        'gate-em': 'Engineering Mathematics',
        'gate-nt': 'Network Theory',
        'gate-ss': 'Signals and Systems',
        'gate-dc': 'Digital Circuits',
        'gate-ac': 'Analog Circuits',
        'gate-ed': 'Electronic Devices',
        'gate-cs': 'Control Systems',
        'gate-comm': 'Communications',
        'gate-emt': 'Electromagnetics',
        'gate-ga': 'General Aptitude',
        'neet-bio': 'Biology',
        'neet-phy': 'Physics',
        'neet-chem': 'Chemistry',
      };
      const difficultyMap = {
        Easy: 'Foundation',
        Medium: 'Exam Standard',
        Hard: 'Challenge',
        Mixed: 'Exam Standard',
      };
      const response = await post(
        '/api/ai/study-mcq',
        {
          exam: body.exam === 'neet' ? 'NEET UG' : 'GATE ECE',
          subject: subjects[body.subject] || body.subject,
          topic: body.topic || 'Important syllabus concepts',
          count: body.count,
          difficulty: difficultyMap[body.difficulty] || 'Exam Standard',
          avoid: Array.isArray(body.avoid) ? body.avoid.slice(-20) : [],
        },
        signal
      );
      const data = await parseJsonSafely(response, 'AI returned an invalid question set.');
      if (!Array.isArray(data.questions)) {
        throw new Error('AI returned an invalid question set.');
      }
      return {
        questions: data.questions.map((q) => ({
          q: q.q,
          o: q.options,
          a: q.answerIndex,
          e: q.explanation,
          t: q.topic,
        })),
      };
    }

    if (body.action === 'doubt') {
      const response = await post('/api/ai/study-doubt', body.question, signal);
      return parseJsonSafely(response, 'AI returned an invalid explanation.');
    }

    return stream(
      {
        question: body.question || 'Review these completed test results and suggest a revision plan.',
        history: (body.history || []).filter((m) => ['user', 'assistant'].includes(m.role)).slice(-6),
        pageContext: JSON.stringify(body.context || body.stats || {}),
      },
      signal,
      onText
    );
  }

  async function transport(url, options = {}) {
    if (options.method === 'GET' || String(url).endsWith('/health')) {
      const response = await fetch(base + '/api/health', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: options.signal,
      });
      const data = await parseJsonSafely(response, 'Health check failed.');
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    const data = await request(payload, options.signal);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  window.HostedAI = { base, request, stream, transport };
})();
