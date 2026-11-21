const express = require('express');
const path = require('path');
const { GoogleGenAI, ThinkingLevel, Type } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const PORTFOLIO_SYSTEM_INSTRUCTION = `You are the fast AI portfolio & study assistant for AAKASH, a B.Tech Electronics & Communication Engineering (ECE) student at Delhi Technological University (DTU, Class of 2028).
Answer clearly, accurately, and concisely in English or Hindi/Hinglish matching the visitor's language.
Write clean plain text (avoid markdown syntax such as ** or ###).

Key portfolio details:
1. Projects:
   - RFID Card Detection System (Foundation project): 13.56 MHz contactless identification using Arduino UNO R3, MFRC522 reader via SPI (with 5 V to 3.3 V level conversion), UID byte comparison (4/7/10-byte UIDs), green/red LEDs, active buzzer, and Serial Monitor diagnostics. Design/reference build without claimed physical range measurements.
   - Smart ID Entry-Exit & Time Analytics (System design): Proposed ESP32-S3 N16R8 architecture with dual PN532 NFC readers on separate UARTs (entry vs exit), DS3231 battery-backed RTC over I2C, microSD local CSV logging over SPI, permanent Person IDs decoupled from replaceable NTAG213 cards, and session-based duration analytics that exclude unclosed/orphan scans and breaks.
   - Perfect Guess: Browser number-guessing game (1-1000) with best-score tracking.
   - Test Centre - NEET & GATE: Practice test web app for NEET, GATE ECE, and CUET with timers, marking, saved progress, solutions, and AI MCQ generation.
   - Blunder - Everyday Store: Grocery storefront web project (Node.js/SQLite architecture).
2. Workshops & Learning:
   - Analog Circuit Analysis, Design & Testing (3-4 June 2026, Dept. of ECE, DTU): Design-Oriented Analysis (DOA), Low-Entropy Expressions, R. David Middlebrook's Extra Element Theorem (EET & DEET), BJT biasing stability with emitter degeneration (RE), and small-signal CE audio amplifier synthesis.
   - PCB Designing Bootcamp (13-14 February 2026, AICTE IDEA Lab, DTU): Schematic capture, component placement, routing, DRC, fabrication, assembly, and QA using EDWinXP.
3. Education: DTU B.Tech ECE (2024-2028), Govt. Boys Sr. Sec. School No. 1 (Class X 2021, Class XII 2023), MCD Primary School.

Keep responses concise, helpful, and grounded in the published portfolio facts and current page context. Do not invent hardware test metrics that are not documented.`;

function createGeminiClient() {
  if (app.locals.aiFactory) return app.locals.aiFactory();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server.');
    err.status = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 25000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildConversationContents(question, history = [], context = {}) {
  const contents = [];
  if (Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content.slice(0, 1200) }],
      });
    }
  }
  let serializedContext = '';
  if (typeof context === 'string' && context.trim()) {
    serializedContext = context.trim().slice(0, 2000);
  } else if (context && typeof context === 'object' && Object.keys(context).length) {
    serializedContext = JSON.stringify(context).slice(0, 2000);
  }
  const contextText = serializedContext ? `\n\n[Current page context]\n${serializedContext}` : '';
  contents.push({
    role: 'user',
    parts: [{ text: `${question.trim()}${contextText}` }],
  });
  return contents;
}

function extractErrorStatus(error) {
  const status = Number(error?.status || error?.statusCode || error?.code);
  if (status >= 400 && status < 600) return status;
  const msg = String(error?.message || '');
  if (
    msg.includes('504') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('408') ||
    msg.includes('ETIMEDOUT') ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError'
  ) {
    return 504;
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE')) return 503;
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('400') || msg.includes('API_KEY_INVALID')) return 400;
  return 500;
}

function extractErrorMessage(error) {
  const status = extractErrorStatus(error);
  if (status === 504) return 'The AI service took too long to respond. Please try again.';
  if (status === 429) return 'Too many AI requests right now. Please wait a moment and try again.';
  const raw = String(error?.message || 'AI request failed.');
  if (/^\s*<!doctype|^\s*<html|unexpected token '</i.test(raw)) {
    return 'The AI service returned an unexpected response. Please retry in a moment.';
  }
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (parsed?.error?.message) return parsed.error.message;
    } catch {}
  }
  return raw;
}

async function generateWithRetry(ai, params) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error) {
      lastError = error;
      const status = extractErrorStatus(error);
      if ((status === 503 || status === 500 || status === 504 || status === 408) && attempt < 1) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function normalizeMcqText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sanitizeMcqList(rawList, fallbackTopic, expectedCount) {
  if (!Array.isArray(rawList)) return null;
  const cleaned = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const q = String(item.q || '').trim().slice(0, 880);
    const options = Array.isArray(item.options)
      ? item.options.slice(0, 4).map((opt) => String(opt || '').trim().slice(0, 240))
      : [];
    const answerIndex = Number(item.answerIndex);
    const explanation = String(item.explanation || '').trim().slice(0, 1250);
    const topic = String(item.topic || fallbackTopic || 'General').trim().slice(0, 95);

    const uniqueOptions = new Set(options.map(normalizeMcqText));
    const valid =
      q.length >= 15 &&
      options.length === 4 &&
      options.every((opt) => opt.length >= 1) &&
      uniqueOptions.size === 4 &&
      Number.isInteger(answerIndex) &&
      answerIndex >= 0 &&
      answerIndex <= 3 &&
      explanation.length >= 10 &&
      topic.length >= 2;

    if (!valid) continue;
    cleaned.push({ q, options, answerIndex, explanation, topic });
    if (cleaned.length === expectedCount) break;
  }
  return cleaned.length === expectedCount ? cleaned : null;
}

// Permit the existing GitHub Pages sites as well as this server's own frontend.
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'https://aakash9972sn.github.io').split(',').map(value => value.trim()).filter(Boolean));
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === req.get('Host'); } catch {}
    if (!sameOrigin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Origin is not allowed.' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    ok: true,
    provider: 'google-gemini',
    configured,
    model: MODEL_ID,
  });
});

app.post('/api/ai/chat/stream', async (req, res) => {
  const { question, history, context, pageContext } = req.body || {};
  if (typeof question !== 'string' || question.trim().length < 2 || question.length > 700) {
    return res.status(400).json({ error: 'Please enter a question between 2 and 700 characters.' });
  }

  let ai;
  try {
    ai = createGeminiClient();
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableEnded) clientClosed = true;
  });

  try {
    const response = await generateWithRetry(ai, {
      model: MODEL_ID,
      contents: buildConversationContents(question, history, context || pageContext || {}),
      config: {
        systemInstruction: PORTFOLIO_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    const text = (response.text || '').trim();
    if (!text) {
      throw new Error('AI returned an empty response. Please retry.');
    }
    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Gemini stream error:', error);
    if (!clientClosed) {
      const status = extractErrorStatus(error);
      const message =
        status === 429
          ? 'AI rate limit reached. Please try again in a moment.'
          : extractErrorMessage(error);
      res.write(`data: ${JSON.stringify({ error: message, status })}\n\n`);
      res.end();
    }
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { question, history, context, pageContext } = req.body || {};
  if (typeof question !== 'string' || question.trim().length < 2 || question.length > 700) {
    return res.status(400).json({ error: 'Please enter a question between 2 and 700 characters.' });
  }

  try {
    const ai = createGeminiClient();
    const response = await generateWithRetry(ai, {
      model: MODEL_ID,
      contents: buildConversationContents(question, history, context || pageContext || {}),
      config: {
        systemInstruction: PORTFOLIO_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    const answer = (response.text || '').trim();
    if (!answer) {
      return res.status(502).json({ error: 'AI returned an empty response. Please retry.' });
    }
    return res.json({ answer });
  } catch (error) {
    console.error('Gemini chat error:', error);
    const status = extractErrorStatus(error);
    return res.status(status).json({ error: extractErrorMessage(error) });
  }
});

app.post('/api/ai/study-mcq', async (req, res) => {
  const { exam, subject, topic, count, difficulty, avoid } = req.body || {};
  const targetCount = Math.min(10, Math.max(1, Number.parseInt(count, 10) || 2));
  const examName = String(exam || 'GATE ECE').trim().slice(0, 60);
  const subjectName = String(subject || 'Signals and Systems').trim().slice(0, 80);
  const topicName = String(topic || 'Important syllabus concepts').trim().slice(0, 100);
  const levelName = String(difficulty || 'Exam Standard').trim().slice(0, 40);
  const avoidList = Array.isArray(avoid)
    ? avoid
        .slice(-15)
        .map((q) => String(q || '').trim().slice(0, 120))
        .filter(Boolean)
    : [];

  const prompt = [
    `Generate exactly ${targetCount} high-quality single-choice MCQs for ${examName}.`,
    `Subject: ${subjectName}.`,
    `Focus topic: ${topicName}.`,
    `Difficulty: ${levelName}.`,
    'Rules:',
    '- Each question must have a clear standalone problem statement (15-800 characters, plain text/Unicode math symbols, no markdown code blocks).',
    '- Each question must have exactly 4 distinct plausible options.',
    '- Verify the calculation/fact carefully so answerIndex (0, 1, 2, or 3) points to the unequivocally single best option.',
    '- Include a concise step-by-step explanation (20-800 characters) and short subtopic label.',
    avoidList.length
      ? `Avoid repeating or paraphrasing these previously seen questions:\n- ${avoidList.join('\n- ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const ai = createGeminiClient();
    let validated = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await generateWithRetry(ai, {
        model: MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert GATE ECE and NEET UG exam question writer. Output strictly valid JSON matching the requested schema.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    q: { type: Type.STRING, description: 'Question statement in plain text (15-800 chars).' },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Exactly 4 distinct options.',
                    },
                    answerIndex: {
                      type: Type.INTEGER,
                      description: 'Zero-based index (0, 1, 2, or 3) of the single correct option.',
                    },
                    explanation: { type: Type.STRING, description: 'Concise solution explanation (20-800 chars).' },
                    topic: { type: Type.STRING, description: 'Short subtopic name (3-80 chars).' },
                  },
                  required: ['q', 'options', 'answerIndex', 'explanation', 'topic'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      try {
        const parsed = JSON.parse((response.text || '{}').trim());
        validated = sanitizeMcqList(parsed.questions, topicName, targetCount);
        if (validated) break;
      } catch {}
    }

    if (!validated) {
      return res.status(502).json({ error: 'AI returned an incomplete question batch. Please try again.' });
    }
    return res.json({ questions: validated });
  } catch (error) {
    console.error('Gemini study-mcq error:', error);
    const status = extractErrorStatus(error);
    return res.status(status).json({ error: extractErrorMessage(error) });
  }
});

app.post('/api/ai/study-doubt', async (req, res) => {
  const { exam, subject, question, options, correctIndex, selectedIndex, userDoubt } = req.body || {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Question details are required to explain a doubt.' });
  }

  const opts = Array.isArray(options) ? options.slice(0, 4).map((o, i) => `${i + 1}. ${String(o || '')}`) : [];
  const prompt = [
    `Exam: ${String(exam || 'Competitive Exam').slice(0, 60)}`,
    `Subject: ${String(subject || 'General').slice(0, 80)}`,
    `Question: ${question.slice(0, 900)}`,
    opts.length ? `Options:\n${opts.join('\n')}` : '',
    Number.isInteger(correctIndex) && opts[correctIndex] ? `Stored key: ${opts[correctIndex]}` : '',
    Number.isInteger(selectedIndex) && opts[selectedIndex] ? `Student selected: ${opts[selectedIndex]}` : '',
    userDoubt ? `Request: ${String(userDoubt).slice(0, 400)}` : 'Explain step-by-step and verify the answer key.',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const ai = createGeminiClient();
    const response = await generateWithRetry(ai, {
      model: MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a patient GATE & NEET subject tutor. Explain clearly in plain text (no markdown ** or ###). Verify whether the stored answer key is correct and highlight if any option has an error.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    const answer = (response.text || '').trim();
    if (!answer) {
      return res.status(502).json({ error: 'AI returned an empty explanation. Please retry.' });
    }
    return res.json({ answer });
  } catch (error) {
    console.error('Gemini study-doubt error:', error);
    const status = extractErrorStatus(error);
    return res.status(status).json({ error: extractErrorMessage(error) });
  }
});

app.use((req, res, next) => {
  if (/^\/(?:node_modules|tests|server\.js|package(?:-lock)?\.json|bun\.lock|Dockerfile|firestore\.rules|firebase\.json)(?:\/|$)/.test(req.path)) return res.sendStatus(404);
  next();
});

app.use(
  express.static(__dirname, {
    dotfiles: 'ignore',
    extensions: ['html'],
    index: 'index.html',
  })
);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  return res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err?.status || err?.statusCode) || 500;
  return res.status(status).json({
    error: extractErrorMessage(err),
  });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`Server listening on http://${HOST}:${PORT}`));
}
module.exports = app;
