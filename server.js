const express = require('express');
const fs = require('fs');
const path = require('path');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(path.join(__dirname, '.env'))) {
  // Node 22+ built-in .env loading. Hosting provider env variables take precedence.
  process.loadEnvFile(path.join(__dirname, '.env'));
}
const { GoogleGenAI, ThinkingLevel, Type } = require('@google/genai');
const { registerPortableRoutes, sources } = require('./src/routes/portable-api');
const { attachLiveRelay } = require('./src/live-relay');
const {mountOSM} = require('./src/routes/osm');
const { isConfigured: postgresConfigured } = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const MODEL_ID = process.env.GEMINI_MODEL_FAST || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const DEEP_MODEL_ID = process.env.GEMINI_MODEL_DEEP || 'gemini-2.5-pro';
const chooseModel = preset => preset === 'deep' ? DEEP_MODEL_ID : MODEL_ID;

function getMapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.MAPS_API_KEY ||
      ''
  ).trim();
}

function getAllowedOrigins() {
  const raw = String(
    process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'https://aakash9972sn.github.io,http://localhost:3000,http://127.0.0.1:3000'
  );
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );
}

const ALLOWED_ORIGINS = getAllowedOrigins();

/* Per-process budget for paid model requests. A single client cannot exhaust
 * the free Gemini quota by repeatedly calling different /api/ai routes.
 * For distributed deployments, add a shared gateway quota at the host/CDN.
 */
const aiRequestBudget = new Map();
function aiRateLimit(req,res,next){
  const cap=Math.max(1,Math.min(120,Number(process.env.AI_REQUESTS_PER_MINUTE)||12));
  const originIp=String(req.ip||req.socket?.remoteAddress||'unknown');
  const now=Date.now();
  const entry=aiRequestBudget.get(originIp)||{since:now,count:0};
  if(now-entry.since>=60000){entry.since=now;entry.count=0;}
  entry.count++;
  aiRequestBudget.set(originIp,entry);
  if(aiRequestBudget.size>10000){
    for(const [key,value] of aiRequestBudget)if(now-value.since>120000)aiRequestBudget.delete(key);
  }
  if(entry.count>cap){
    res.setHeader('Retry-After',String(Math.max(1,Math.ceil((entry.since+60000-now)/1000))));
    return res.status(429).json({error:'AI request budget reached. Please retry in a minute.'});
  }
  return next();
}


const PORTFOLIO_SYSTEM_INSTRUCTION = `You are the fast AI portfolio & study assistant for AAKASH, a B.Tech Electronics & Communication Engineering (ECE) student at Delhi Technological University (DTU, Class of 2028).
Answer clearly, accurately, and concisely in English or Hindi/Hinglish matching the visitor's language.
Write clean plain text (avoid markdown syntax such as ** or ###).

Key portfolio details:
1. Projects:
   - RFID Card Detection System (Foundation project): 13.56 MHz contactless identification using Arduino UNO R3, MFRC522 reader via SPI (with 5 V to 3.3 V level conversion), UID byte comparison (4/7/10-byte UIDs), green/red LEDs, active buzzer, and Serial Monitor diagnostics. Design/reference build without claimed physical range measurements.
   - Smart ID Entry-Exit & Time Analytics (System design): Proposed ESP32-S3 N16R8 architecture with dual PN532 NFC readers on separate UARTs (entry vs exit), DS3231 battery-backed RTC over I2C, microSD local CSV logging over SPI, permanent Person IDs decoupled from replaceable NTAG213 cards, and session-based duration analytics that exclude unclosed/orphan scans and breaks.
   - Perfect Guess: Browser number-guessing game (1-1000) with best-score tracking.
   - Test Centre - NEET & GATE: Practice test web app for NEET, GATE ECE, and CUET with timers, marking, saved progress, solutions, and AI MCQ generation.
   - Blunder - Everyday Store: Grocery storefront web project with Google Maps delivery zone picker and Gemini shopping helper.
2. Workshops & Learning:
   - Analog Circuit Analysis, Design & Testing (3-4 June 2026, Dept. of ECE, DTU): Design-Oriented Analysis (DOA), Low-Entropy Expressions, R. David Middlebrook's Extra Element Theorem (EET & DEET), BJT biasing stability with emitter degeneration (RE), and small-signal CE audio amplifier synthesis.
   - PCB Designing Bootcamp (13-14 February 2026, AICTE IDEA Lab, DTU): Schematic capture, component placement, routing, DRC, fabrication, assembly, and QA using EDWinXP.
3. Education: DTU B.Tech ECE (2024-2028), Govt. Boys Sr. Sec. School No. 1 (Class X 2021, Class XII 2023), MCD Primary School.

Keep responses concise, helpful, and grounded in the published portfolio facts and current page context. Use textbook-style LaTeX for mathematical, chemical, and scientific expressions: inline \\( ... \\), display \\[ ... \\]; for example \\(\\frac{a+b}{c}\\), \\(NH_3\\), \\(sp^3\\). Keep ordinary prose as plain text; no HTML, markdown code fences, or raw equations outside math delimiters. Do not invent hardware test metrics that are not documented.`;

const STUDY_SYSTEM_INSTRUCTION = `You are Aakash Gemini, the Test Centre study assistant for GATE ECE, NEET UG, and CUET PG. Answer accurately based on the supplied public catalogue context; never invent course availability, question counts or live API success.
The Test Centre explicitly supports CUET PG Life Sciences (SCQP17) and Zoology (SCQP28), with a separate syllabus registry and Gemini syllabus-driven MCQ mock generation. Its imported PYP bank contains 575 questions across six papers: CUET PG Life Sciences 2025 (75), Life Sciences 2023 Shift 2 (100) and Shift 3 (100), Zoology 2023 Shift 1 (100), Zoology 2022 (100), and CUCET Life Sciences 2021 (100). Of these, 28 source-flagged uncertain questions are review-only and excluded from scored attempts. 2023 answer keys came from user-provided CSVs and are not independently verified against official NTA answer keys. These PYPs are stored separately from EXAM_DATA; the absence of CUET in EXAM_DATA must NEVER be interpreted as CUET content being unavailable.
Distinguish built-in previous-year papers from generated questions, which require the hosted Gemini backend. Use textbook-style LaTeX for mathematical, chemical, and scientific expressions: inline \\( ... \\), display \\[ ... \\]; for example \\(\\frac{a+b}{c}\\), \\(NH_3\\), \\(sp^3\\). Keep ordinary prose as plain text; no HTML, markdown code fences, or raw equations outside math delimiters. If asked for navigation, point students to the CUET PG track and its PYP or AI mock interface. Match the user's language and avoid unsupported claims.`;

function createGeminiClient() {
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

function sanitizeMcqList(rawList, fallbackTopic, expectedCount, allowPartial = false) {
  if (!Array.isArray(rawList)) return null;
  const cleaned = [];
  const seen = new Set();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const q = String(item.q || '').trim().slice(0, 880);
    const normQ = normalizeMcqText(q);
    if (!normQ || seen.has(normQ)) continue;
    const options = Array.isArray(item.options)
      ? item.options.slice(0, 4).map((opt) => String(opt || '').trim().slice(0, 240))
      : [];
    const answerIndex = Number(item.answerIndex);
    const explanation = String(item.explanation || '').trim().slice(0, 600);
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
    seen.add(normQ);
    cleaned.push({ q, options, answerIndex, explanation, topic });
    if (cleaned.length === expectedCount) break;
  }
  if (cleaned.length === expectedCount) return cleaned;
  if (allowPartial && cleaned.length >= 1) return cleaned;
  return null;
}

function extractAddressComponent(components, type) {
  if (!Array.isArray(components)) return '';
  const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  return found ? String(found.long_name || '') : '';
}

function formatGeocodeResult(item) {
  if (!item || !item.geometry?.location) return null;
  const comps = item.address_components || [];
  const subpremise = extractAddressComponent(comps, 'subpremise');
  const streetNumber = extractAddressComponent(comps, 'street_number');
  const route = extractAddressComponent(comps, 'route');
  const sublocality2 = extractAddressComponent(comps, 'sublocality_level_2');
  const sublocality1 = extractAddressComponent(comps, 'sublocality_level_1');
  const city =
    extractAddressComponent(comps, 'locality') ||
    extractAddressComponent(comps, 'administrative_area_level_2') ||
    'New Delhi';
  const state = extractAddressComponent(comps, 'administrative_area_level_1') || 'Delhi';
  const pincode = extractAddressComponent(comps, 'postal_code');
  const line = [subpremise, streetNumber, route, sublocality2, sublocality1]
    .filter(Boolean)
    .join(', ');
  return {
    lat: Number(item.geometry.location.lat),
    lng: Number(item.geometry.location.lng),
    formattedAddress: String(item.formatted_address || ''),
    placeId: String(item.place_id || ''),
    addressLine: line || String(item.formatted_address || '').split(',').slice(0, 2).join(', ').trim(),
    city,
    state,
    pincode: /^[1-9]\d{5}$/.test(pincode) ? pincode : '',
  };
}

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (origin) {
    const cleanOrigin = String(origin).replace(/\/+$/, '');
    if (
      ALLOWED_ORIGINS.has(cleanOrigin)
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    } else {
      return res.status(403).json({ error: 'This browser origin is not allowed by CORS_ORIGIN.' });
    }
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});
// Media endpoints accept bounded base64; all other API JSON bodies stay capped at 128 KB.
app.use('/api/ai/image', express.json({limit:'8mb'}));
app.use('/api/ai/transcribe', express.json({limit:'9mb'}));
// Quota protection is applied before any optional paid Gemini call.
app.use('/api/ai',aiRateLimit);
app.use(express.json({limit:'128kb'}));
registerPortableRoutes(app, express, createGeminiClient);
mountOSM(app);

app.get('/api/health', (req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  const mapsConfigured = Boolean(getMapsApiKey());
  res.json({
    ok: true,
    configured,
    mapsConfigured,
    model: MODEL_ID,
    deepModel: DEEP_MODEL_ID,
    postgresConfigured: postgresConfigured(),
    liveEnabled: process.env.ENABLE_LIVE_AUDIO === 'true' && configured,
  });
});

app.get('/api/maps/config', (req, res) => {
  // Browser keys are public by design but MUST be HTTP-referrer restricted.
  // Never expose a server-side Geocoding/Maps Grounding secret.
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
  res.json({
    configured: Boolean(apiKey),
    apiKey,
    provider: apiKey ? 'google' : 'openstreetmap',
  });
});

app.post('/api/maps/search', async (req, res) => {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Google Maps API key is not configured on the server.' });
  }
  const query = String(req.body?.query || '').trim().slice(0, 180);
  if (query.length < 3) {
    return res.status(400).json({ error: 'Please enter at least 3 characters to search an address.' });
  }
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('components', 'country:IN');
    url.searchParams.set('language', 'en');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 429) {
      return res.status(429).json({
        error: 'Google Maps Platform quota reached.',
        status: 'RESOURCE_EXHAUSTED',
      });
    }
    const data = await response.json();
    if (data.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({
        error: 'Google Maps Platform quota reached.',
        status: 'RESOURCE_EXHAUSTED',
      });
    }
    if (data.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: data.error_message || 'Geocoding API request denied.' });
    }
    const results = Array.isArray(data.results)
      ? data.results.slice(0, 5).map(formatGeocodeResult).filter(Boolean)
      : [];
    return res.json({ status: data.status || 'OK', results });
  } catch (error) {
    console.error('Maps search error:', error);
    return res.status(502).json({ error: 'Could not reach Google Geocoding service.' });
  }
});

app.post('/api/maps/reverse', async (req, res) => {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Google Maps API key is not configured on the server.' });
  }
  const lat = Number(req.body?.latitude ?? req.body?.lat);
  const lng = Number(req.body?.longitude ?? req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
  }
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('language', 'en');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 429) {
      return res.status(429).json({
        error: 'Google Maps Platform quota reached.',
        status: 'RESOURCE_EXHAUSTED',
      });
    }
    const data = await response.json();
    if (data.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({
        error: 'Google Maps Platform quota reached.',
        status: 'RESOURCE_EXHAUSTED',
      });
    }
    if (data.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: data.error_message || 'Geocoding API request denied.' });
    }
    const first = Array.isArray(data.results) && data.results[0] ? formatGeocodeResult(data.results[0]) : null;
    return res.json({ status: data.status || 'OK', result: first });
  } catch (error) {
    console.error('Maps reverse geocode error:', error);
    return res.status(502).json({ error: 'Could not reverse-geocode coordinates.' });
  }
});

app.get('/api/store', (req, res) => {
  try {
    const storePath = path.join(__dirname, 'blunder', 'data', 'store.json');
    const catalogPath = path.join(__dirname, 'blunder', 'data', 'catalog.json');
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const products = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    res.json({
      ...store,
      products,
      mapsAvailable: Boolean(getMapsApiKey()),
      checkoutEnabled: false,
      paymentMethods: ['cod'],
      paymentMode: 'live',
    });
  } catch (error) {
    console.error('Store config error:', error);
    res.status(500).json({ error: 'Could not load Blunder store catalog.' });
  }
});

app.post('/api/ai/shop-assistant', async (req, res) => {
  const { question, history, context, cart } = req.body || {};
  if (typeof question !== 'string' || question.trim().length < 2 || question.length > 700) {
    return res.status(400).json({ error: 'Please enter a question between 2 and 700 characters.' });
  }
  try {
    const ai = createGeminiClient();
    const shopContext = {
      ...(context && typeof context === 'object' ? context : {}),
      cart: Array.isArray(cart) ? cart.slice(0, 20) : [],
    };
    const response = await generateWithRetry(ai, {
      model: MODEL_ID,
      contents: buildConversationContents(question, history, shopContext),
      config: {
        systemInstruction:
          'You are the helpful grocery shopping assistant for BLUNDER, an everyday essentials storefront near DTU Delhi. Answer in crisp plain text (English or Hindi/Hinglish matching the customer). Suggest useful items, cooking pairings, pack sizes, and check delivery policies from the provided catalog context without inventing prices or unverified claims.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
    const answer = (response.text || '').trim();
    if (!answer) {
      return res.status(502).json({ error: 'AI returned an empty response. Please retry.' });
    }
    return res.json({ answer });
  } catch (error) {
    console.error('Gemini shop-assistant error:', error);
    const status = extractErrorStatus(error);
    return res.status(status).json({ error: extractErrorMessage(error) });
  }
});

app.post('/api/ai/chat/stream', async (req, res) => {
  const { question, history, context, pageContext, app: clientApp, modelPreset, verifyWithWebSearch } = req.body || {};
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
    const grounded = verifyWithWebSearch === true;
    const response = await generateWithRetry(ai, {
      model: chooseModel(modelPreset),
      contents: buildConversationContents(question, history, context || pageContext || {}),
      config: {
        systemInstruction: clientApp === 'study' ? STUDY_SYSTEM_INSTRUCTION : PORTFOLIO_SYSTEM_INSTRUCTION,
        ...(grounded ? {tools:[{googleSearch:{}}]} : {thinkingConfig:{thinkingLevel:ThinkingLevel.MINIMAL}})
      },
    });
    const text = (response.text || '').trim();
    if (!text) {
      throw new Error('AI returned an empty response. Please retry.');
    }
    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, sources: grounded ? sources(response) : [] })}\n\n`);
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
  const { question, history, context, pageContext, app: clientApp, modelPreset, verifyWithWebSearch } = req.body || {};
  if (typeof question !== 'string' || question.trim().length < 2 || question.length > 700) {
    return res.status(400).json({ error: 'Please enter a question between 2 and 700 characters.' });
  }

  try {
    const ai = createGeminiClient();
    const grounded = verifyWithWebSearch === true;
    const response = await generateWithRetry(ai, {
      model: chooseModel(modelPreset),
      contents: buildConversationContents(question, history, context || pageContext || {}),
      config: {
        systemInstruction: clientApp === 'study' ? STUDY_SYSTEM_INSTRUCTION : PORTFOLIO_SYSTEM_INSTRUCTION,
        ...(grounded ? {tools: [{googleSearch:{}}]} :
          {thinkingConfig: {thinkingLevel: modelPreset === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL}}),
      },
    });
    const answer = (response.text || '').trim();
    if (!answer) {
      return res.status(502).json({ error: 'AI returned an empty response. Please retry.' });
    }
    return res.json({ answer, sources: grounded ? sources(response) : [] });
  } catch (error) {
    console.error('Gemini chat error:', error);
    const status = extractErrorStatus(error);
    return res.status(status).json({ error: extractErrorMessage(error) });
  }
});

const BATCH_ANGLES = [
  'core definitions and fundamental principles',
  'numerical problem solving and formula calculations',
  'conceptual edge cases and common exam traps',
  'practical circuit/experimental applications and comparisons',
  'time/frequency domain or multi-step analytical reasoning',
  'theorem conditions, units, and dimensional limits',
  'system-level synthesis and parameter sensitivity',
  'high-yield previous-year pattern variations',
];

app.post('/api/ai/study-mcq', async (req, res) => {
  const { exam, subject, topic, unit, syllabusSpec, count, difficulty, avoid, batchIndex } = req.body || {};
  const targetCount = Math.min(12, Math.max(1, Number.parseInt(count, 10) || 2));
  const examName = String(exam || 'GATE ECE').trim().slice(0, 60);
  const subjectName = String(subject || 'Signals and Systems').trim().slice(0, 80);
  const unitName = String(unit || '').trim().slice(0, 120);
  const syllabusText = String(syllabusSpec || '').trim().slice(0, 1400);
  const topicName = String(topic || '').trim().slice(0, 100);
  const levelName = String(difficulty || 'Exam Standard').trim().slice(0, 40);
  const batchNum = Number.isInteger(Number(batchIndex)) ? Math.max(0, Number(batchIndex)) : 0;
  const angleHint = BATCH_ANGLES[batchNum % BATCH_ANGLES.length];
  const avoidList = Array.isArray(avoid)
    ? avoid
        .slice(-30)
        .map((q) => String(q || '').trim().slice(0, 85))
        .filter(Boolean)
    : [];

  const prompt = [
    `Generate exactly ${targetCount} distinct single-choice MCQs strictly matching the official ${examName} exam level and syllabus.`,
    `Subject: ${subjectName}. Difficulty: ${levelName}.`,
    unitName ? `Target Syllabus Unit: ${unitName}.` : '',
    syllabusText ? `OFFICIAL SYLLABUS TOPICS (generate ONLY from these topics, do not go out of syllabus):\n${syllabusText}` : '',
    topicName && topicName !== 'Important syllabus concepts' ? `Additional Student Focus: ${topicName}.` : '',
    `Batch variation #${batchNum + 1}: emphasize ${angleHint}.`,
    'Rules:',
    '- Strictly stay inside the stated exam pattern and official syllabus topics above.',
    '- Standalone clear question (15-500 chars) and options. Render all mathematical, chemical and symbolic expressions as LaTeX wrapped in \\( ... \\) or \\[ ... \\]; use \\frac, _ for subscripts, ^ for powers. Ordinary prose stays plain text without markdown.',
    '- Exactly 4 distinct options and verified single best answerIndex (0-3).',
    '- Crisp 1-2 sentence explanation (20-280 chars) and exact short syllabus unit/subtopic tag; math and chemistry notation use the same LaTeX delimiters.',
    avoidList.length ? `Do not repeat or paraphrase:\n- ${avoidList.join('\n- ')}` : '',
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
            'You are an expert Indian competitive exam paper setter for GATE ECE, NEET UG, and CUET PG (Life Sciences SCQP17 & Zoology SCQP28). Strictly follow the provided official syllabus unit and subtopic list—never ask out-of-syllabus questions. Output strictly valid JSON matching the schema with concise verified solutions. Use LaTeX escaped correctly for JSON strings, with math delimited by \\( ... \\) and \\[ ... \\]; do not use HTML.',
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
                    q: { type: Type.STRING, description: 'Question statement (15-500 chars).' },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Exactly 4 distinct options.',
                    },
                    answerIndex: {
                      type: Type.INTEGER,
                      description: 'Zero-based index (0-3) of the correct option.',
                    },
                    explanation: { type: Type.STRING, description: 'Concise 1-2 line solution (20-280 chars).' },
                    topic: { type: Type.STRING, description: 'Short subtopic name (3-60 chars).' },
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
        const allowPartial = attempt === 1 && targetCount >= 2;
        validated = sanitizeMcqList(parsed.questions, topicName || unitName || subjectName, targetCount, allowPartial);
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
          'You are a patient GATE ECE, NEET UG & CUET PG subject tutor. Explain clearly in plain text (no markdown ** or ###). Verify whether the stored answer key is correct and highlight if any option has an error. Use textbook-style LaTeX for mathematical, chemical, and scientific expressions: inline \\( ... \\), display \\[ ... \\]; for example \\(\\frac{a+b}{c}\\), \\(NH_3\\), \\(sp^3\\). Keep ordinary prose as plain text; no HTML, markdown code fences, or raw equations outside math delimiters.',
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

// Import as an Express handler under serverless Node (e.g. Vercel); the
// long-running WS relay is supported only when this process owns the listener.
if (require.main === module && !process.env.VERCEL) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
  attachLiveRelay(server, ALLOWED_ORIGINS);
}
module.exports = app;

