/* Fast streaming AI portfolio assistant backed by server-side Gemini API. */
(() => {
  'use strict';

  const config = window.AAKASH_AI;
  if (!config?.endpoint) return;

  const assetBase = new URL('.', document.currentScript?.src || location.href);
  const spark =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 1v22M1 12h22M4 4l16 16M4 20 20 4"/></svg>';
  const arrow =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';

  const host = document.createElement('aakash-assistant');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<link rel="stylesheet" href="${new URL('ai-assistant.css?v=20261122-review-fix1', assetBase)}"><button class="launcher" aria-haspopup="dialog" aria-label="Open AI assistant"><span class="launcher-badge" aria-hidden="true">${spark}</span><span class="launcher-text">Ask AI</span><svg class="launcher-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></button><dialog aria-labelledby="assistant-title"><header><div class="mark" aria-hidden="true">${spark}</div><div><span class="eyebrow">FAST PORTFOLIO ASSISTANT</span><h2 id="assistant-title"></h2></div><button class="close" aria-label="Close AI assistant">×</button></header><div class="conversation"><div class="welcome"><span class="spark" aria-hidden="true">${spark}</span><h3>What’s on your mind?</h3><p></p><div class="suggestions"></div></div><div class="messages" role="log" aria-label="Conversation" aria-live="polite"></div></div><div class="status" role="status"></div><form><label class="sr-only" for="ai-question">Your question</label><textarea id="ai-question" rows="2" maxlength="700" placeholder="Ask in English or Hindi…" required></textarea><button class="send" aria-label="Send question">${arrow}</button></form><footer><span>AI can make mistakes. Check the source details.</span><button type="button" class="clear">Clear chat</button></footer><p class="privacy"></p></dialog>`;

  function syncTheme(explicitTheme) {
    let resolved = explicitTheme;
    if (resolved !== 'dark' && resolved !== 'light') {
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (docTheme === 'dark' || docTheme === 'light') {
        resolved = docTheme;
      } else {
        try {
          const saved = localStorage.getItem('aakash.theme');
          resolved = saved === 'dark' ? 'dark' : 'light';
        } catch {
          resolved = 'light';
        }
      }
    }
    host.setAttribute('data-theme', resolved === 'dark' ? 'dark' : 'light');
  }

  syncTheme();
  window.addEventListener('aakash:theme-change', (event) => syncTheme(event.detail?.theme));
  window.addEventListener('storage', (event) => {
    if (event.key === 'aakash.theme') syncTheme(event.newValue);
  });
  new MutationObserver(() => syncTheme()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  document.body.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const dialog = $('dialog');
  const input = $('textarea');
  const status = $('.status');
  const messages = $('.messages');
  const conversation = $('.conversation');
  const sendButton = $('.send');

  $('#assistant-title').textContent = config.title || 'Aakash AI Guide';
  $('.welcome p').textContent = config.intro || 'Ask about this page.';
  $('.privacy').textContent =
    config.privacy || 'Questions use public page context only and stay in memory for this session.';

  let history = [];
  let busy = false;
  let controller = null;
  let sequence = 0;
  let lastQuestion = '';

  for (const question of config.suggestions || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = question;
    button.addEventListener('click', () => {
      input.value = question;
      submit();
    });
    $('.suggestions').appendChild(button);
  }

  function permitted() {
    return !config.isAllowed || config.isAllowed();
  }

  function open(question) {
    if (!permitted()) return;
    if (!dialog.open) dialog.showModal();
    if (question) input.value = question;
    input.focus();
  }

  function cancel() {
    sequence++;
    controller?.abort();
    controller = null;
    busy = false;
    sendButton.disabled = false;
    sendButton.innerHTML = arrow;
    status.textContent = '';
  }

  $('.launcher').addEventListener('click', () => open());
  $('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    cancel();
    $('.launcher').focus({ preventScroll: true });
  });

  $('.clear').addEventListener('click', () => {
    cancel();
    history = [];
    lastQuestion = '';
    messages.replaceChildren();
    $('.welcome').hidden = false;
    input.value = '';
    input.focus();
  });

  function bubble(text, role) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    const label = document.createElement('b');
    label.textContent = role === 'user' ? 'You' : config.title || 'Assistant';
    const content = document.createElement('p');
    content.textContent = text;
    div.append(label, content);
    messages.appendChild(div);
    conversation.scrollTop = conversation.scrollHeight;
    return content;
  }

  async function requestAnswer(payload, signal, onChunk) {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      let errMsg = '';
      try {
        if (contentType.includes('application/json')) {
          const errData = await response.json();
          errMsg = errData?.error || '';
        }
      } catch {}
      throw new Error(
        errMsg ||
          (response.status === 429
            ? 'Too many requests right now. Please wait a moment and try again.'
            : 'AI service returned an error. Please try again.')
      );
    }

    if (contentType.includes('text/html')) {
      throw new Error('Session returned a web page instead of an AI response. Refresh the page and retry.');
    }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error('No answer came back. Please try again.');
      }
      onChunk(data.answer);
      return data.answer;
    }

    if (!response.body) {
      throw new Error('Streaming response unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let done = false;

    function processBlock(block) {
      const dataLines = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!dataLines) return;
      const data = JSON.parse(dataLines);
      if (data.error) {
        throw new Error(data.error);
      }
      if (typeof data.text === 'string' && data.text.length > 0) {
        fullText += data.text;
        onChunk(fullText);
      }
      if (data.done) {
        done = true;
      }
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

    if (!fullText.trim()) {
      throw new Error('No answer came back. Please try again.');
    }
    return fullText;
  }

  async function submit() {
    const question = input.value.trim();
    if (busy || question.length < 2 || !permitted()) return;
    if (question.length > 700) {
      status.textContent = 'Keep your question under 700 characters.';
      return;
    }
    const context = config.context?.();
    if (!context) {
      status.textContent = 'The page is still loading. Try again in a moment.';
      return;
    }

    busy = true;
    const id = ++sequence;
    controller = new AbortController();
    sendButton.disabled = true;
    sendButton.textContent = '…';
    status.textContent = 'Thinking…';
    $('.welcome').hidden = true;

    if (question !== lastQuestion) bubble(question, 'user');
    lastQuestion = question;
    input.value = '';

    let assistantParagraph = null;

    try {
      const answer = await requestAnswer(
        {
          question,
          context,
          app: config.app || 'portfolio',
          history: history.slice(-6).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 1200),
          })),
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
        (partial) => {
          if (id !== sequence) return;
          if (!assistantParagraph) {
            assistantParagraph = bubble('', 'assistant');
            status.textContent = '';
          }
          assistantParagraph.textContent = partial.slice(0, 8000);
          conversation.scrollTop = conversation.scrollHeight;
        }
      );

      if (id !== sequence) return;
      const finalAnswer = answer.slice(0, 8000);
      if (!assistantParagraph) {
        assistantParagraph = bubble(finalAnswer, 'assistant');
      } else {
        assistantParagraph.textContent = finalAnswer;
      }

      history.push(
        { role: 'user', content: question },
        { role: 'assistant', content: finalAnswer }
      );
      history = history.slice(-6);
      lastQuestion = '';
      status.textContent = '';
    } catch (error) {
      if (id !== sequence) return;
      if (assistantParagraph && !assistantParagraph.textContent.trim()) {
        assistantParagraph.parentElement?.remove();
      }
      status.textContent =
        error.name === 'TimeoutError'
          ? 'The answer took too long. Please try again.'
          : error.message || 'AI is unavailable. Try again.';
      input.value = question;
    } finally {
      if (id === sequence) {
        busy = false;
        sendButton.disabled = false;
        sendButton.innerHTML = arrow;
        input.focus();
      }
    }
  }

  $('form').addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });

  function availability() {
    host.hidden = !permitted();
    if (host.hidden && dialog.open) dialog.close();
  }
  window.addEventListener('hashchange', availability);
  availability();

  window.AakashAssistant = Object.freeze({ open });
})();
