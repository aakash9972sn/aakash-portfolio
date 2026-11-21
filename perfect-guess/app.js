/* ============================================================================
   Perfect Guess — Game Logic & Cloud Best Score Sync (1–1000)
   ========================================================================== */
(() => {
  'use strict';

  const MIN_NUM = 1;
  const MAX_NUM = 1000;
  const BEST_KEY = 'bestScore';
  const WINS_KEY = 'perfectGuess.roundsWon';

  const digitEls = [
    document.getElementById('digit-0'),
    document.getElementById('digit-1'),
    document.getElementById('digit-2'),
    document.getElementById('digit-3'),
  ];
  const digitStage = document.getElementById('digit-stage');
  const proximityLabel = document.getElementById('proximity-label');
  const proximityFill = document.getElementById('proximity-fill');
  const proximityBarWrap = document.getElementById('proximity-bar-wrap');
  const rangeDisplay = document.getElementById('range-display');
  const feedbackBanner = document.getElementById('feedback-banner');
  const feedbackTag = document.getElementById('feedback-tag');
  const feedbackText = document.getElementById('feedback-text');
  const guessForm = document.getElementById('guess-form');
  const guessInput = document.getElementById('guess-input');
  const submitBtn = document.getElementById('submit-guess-btn');
  const newRoundBtn = document.getElementById('new-round-btn');
  const midpointBtn = document.getElementById('midpoint-btn');

  const attemptsVal = document.getElementById('attempts-val');
  const attemptsNote = document.getElementById('attempts-note');
  const bestVal = document.getElementById('best-val');
  const bestNote = document.getElementById('best-note');
  const winsVal = document.getElementById('wins-val');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const historyCount = document.getElementById('history-count');

  const cloudSyncCard = document.getElementById('cloud-sync-card');
  const cloudSyncTitle = document.getElementById('cloud-sync-title');
  const cloudSyncDesc = document.getElementById('cloud-sync-desc');
  const openAccountBtn = document.getElementById('open-account-btn');

  let secret = 500;
  let low = MIN_NUM;
  let high = MAX_NUM;
  let attempts = 0;
  let roundOver = false;
  let history = [];

  function randomInt(min, max) {
    const span = max - min + 1;
    if (window.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0xffffffff / span) * span;
      let val = 0;
      do {
        window.crypto.getRandomValues(buf);
        val = buf[0];
      } while (val >= limit);
      return min + (val % span);
    }
    return min + Math.floor(Math.random() * span);
  }

  function readLocalBest() {
    try {
      const n = Number(localStorage.getItem(BEST_KEY));
      return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
    } catch {
      return null;
    }
  }

  function writeLocalBest(score) {
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {}
  }

  function readWins() {
    try {
      const n = Number(localStorage.getItem(WINS_KEY));
      return Number.isInteger(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function writeWins(wins) {
    try {
      localStorage.setItem(WINS_KEY, String(wins));
    } catch {}
  }

  function setDigits(value) {
    if (value == null) {
      digitEls[0].textContent = '-';
      digitEls[1].textContent = '-';
      digitEls[2].textContent = '-';
      digitEls[3].hidden = true;
      return;
    }
    const str = String(value);
    if (str.length === 4) {
      digitEls[3].hidden = false;
      digitEls[0].textContent = str[0];
      digitEls[1].textContent = str[1];
      digitEls[2].textContent = str[2];
      digitEls[3].textContent = str[3];
    } else {
      digitEls[3].hidden = true;
      const padded = str.padStart(3, '0');
      digitEls[0].textContent = padded[0];
      digitEls[1].textContent = padded[1];
      digitEls[2].textContent = padded[2];
    }
  }

  function computeProximity(guess, target) {
    if (guess === target) return { pct: 100, label: 'Exact Match' };
    const dist = Math.abs(guess - target);
    const pct = Math.max(6, Math.round(100 - (dist / (MAX_NUM - MIN_NUM)) * 100));
    if (dist <= 5) return { pct, label: 'Scorching Close (within 5)' };
    if (dist <= 20) return { pct, label: 'Very Warm (within 20)' };
    if (dist <= 60) return { pct, label: 'Warm (within 60)' };
    if (dist <= 160) return { pct, label: 'Cool' };
    return { pct, label: 'Cold' };
  }

  function setFeedback(tone, tag, message) {
    feedbackBanner.dataset.tone = tone;
    feedbackTag.textContent = tag;
    feedbackText.textContent = message;
  }

  function updateMidpointButton() {
    const mid = Math.floor((low + high) / 2);
    midpointBtn.textContent = `Suggest midpoint (${mid})`;
    midpointBtn.dataset.mid = String(mid);
    midpointBtn.disabled = roundOver;
  }

  function refreshScoreboard() {
    attemptsVal.textContent = String(attempts);
    attemptsNote.textContent = roundOver ? 'Final count' : 'Current round';
    const localBest = readLocalBest();
    const cloudState = window.AakashAccount?.getState?.();
    const cloudBest = cloudState?.profile?.bestGuessScore;
    const effectiveBest =
      localBest && cloudBest ? Math.min(localBest, cloudBest) : localBest || cloudBest || null;

    bestVal.textContent = effectiveBest ? String(effectiveBest) : '—';
    if (cloudState?.signedIn && cloudBest) {
      bestNote.textContent = `Cloud synced · ${cloudBest} ${cloudBest === 1 ? 'try' : 'tries'}`;
    } else if (effectiveBest) {
      bestNote.textContent = 'Saved on this device';
    } else {
      bestNote.textContent = 'Lower is better';
    }
    winsVal.textContent = String(readWins());
  }

  function syncAccountBanner(detail) {
    const state = detail || window.AakashAccount?.getState?.() || { signedIn: false, profile: null };
    if (state.signedIn) {
      cloudSyncCard.dataset.signedIn = 'true';
      const name = state.profile?.displayName || 'your account';
      cloudSyncTitle.textContent = `Synced as ${name}`;
      cloudSyncDesc.textContent = state.profile?.bestGuessScore
        ? `Cloud personal best: ${state.profile.bestGuessScore} attempts.`
        : 'Finish a round to save your personal best score to Firestore.';
      openAccountBtn.textContent = 'Account & saved';
    } else {
      cloudSyncCard.dataset.signedIn = 'false';
      cloudSyncTitle.textContent = 'Playing locally';
      cloudSyncDesc.textContent = 'Sign in with Google to save your personal best across devices.';
      openAccountBtn.textContent = 'Sign in / Sync';
    }
    refreshScoreboard();
  }

  function renderHistory() {
    historyList.replaceChildren();
    historyCount.textContent = `${history.length} ${history.length === 1 ? 'entry' : 'entries'}`;
    if (!history.length) {
      historyList.append(historyEmpty);
      return;
    }
    for (const item of history) {
      const li = document.createElement('li');
      li.className = item.verdict === 'exact' ? 'history-item is-won' : 'history-item';

      const step = document.createElement('span');
      step.className = 'history-step';
      step.textContent = `#${item.step}`;

      const val = document.createElement('span');
      val.className = 'history-guess';
      val.textContent = String(item.guess);

      const note = document.createElement('span');
      note.className = 'history-verdict';
      note.textContent =
        item.verdict === 'exact'
          ? 'Exact match'
          : item.verdict === 'high'
            ? `Too high · next ${item.low}–${item.high}`
            : `Too low · next ${item.low}–${item.high}`;

      li.append(step, val, note);
      historyList.append(li);
    }
  }

  function startNewRound() {
    secret = randomInt(MIN_NUM, MAX_NUM);
    low = MIN_NUM;
    high = MAX_NUM;
    attempts = 0;
    roundOver = false;
    history = [];

    digitStage.dataset.state = 'idle';
    setDigits(null);
    rangeDisplay.textContent = `${low} — ${high}`;
    proximityLabel.textContent = 'Ready for first guess';
    proximityFill.style.width = '0%';
    proximityBarWrap.setAttribute('aria-valuenow', '0');
    setFeedback(
      'neutral',
      'READY',
      'Enter any integer from 1 to 1000. Optimal binary search averages ~9–10 attempts.'
    );
    guessInput.disabled = false;
    submitBtn.disabled = false;
    guessInput.value = '';
    updateMidpointButton();
    renderHistory();
    refreshScoreboard();
    guessInput.focus();
  }

  async function handleGuess(rawValue) {
    if (roundOver) return;
    const trimmed = String(rawValue || '').trim();
    const guess = Number(trimmed);
    if (!trimmed || !Number.isInteger(guess) || guess < MIN_NUM || guess > MAX_NUM) {
      setFeedback('warn', 'INVALID', `Please enter a whole number between ${MIN_NUM} and ${MAX_NUM}.`);
      guessInput.focus();
      return;
    }

    attempts += 1;
    setDigits(guess);
    const prox = computeProximity(guess, secret);
    proximityLabel.textContent = prox.label;
    proximityFill.style.width = `${prox.pct}%`;
    proximityBarWrap.setAttribute('aria-valuenow', String(prox.pct));

    if (guess === secret) {
      roundOver = true;
      digitStage.dataset.state = 'won';
      rangeDisplay.textContent = `${secret} ✓`;
      guessInput.disabled = true;
      submitBtn.disabled = true;

      const prevBest = readLocalBest();
      const isNewBest = !prevBest || attempts < prevBest;
      if (isNewBest) {
        writeLocalBest(attempts);
      }
      writeWins(readWins() + 1);

      history.unshift({ step: attempts, guess, verdict: 'exact', low: secret, high: secret });
      setFeedback(
        'won',
        isNewBest ? 'NEW BEST' : 'SOLVED',
        `You found ${secret} in ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}${isNewBest ? ' — personal record!' : '.'}`
      );
      renderHistory();
      updateMidpointButton();
      refreshScoreboard();

      try {
        await window.AakashAccount?.bestGuess?.(attempts);
      } catch {}
      return;
    }

    if (guess > secret) {
      if (guess - 1 < high) high = Math.max(low, guess - 1);
      digitStage.dataset.state = 'high';
      setFeedback(
        Math.abs(guess - secret) <= 20 ? 'hot' : 'warn',
        'TOO HIGH',
        `${guess} is above the secret number. Narrowed to ${low} – ${high}.`
      );
      history.unshift({ step: attempts, guess, verdict: 'high', low, high });
    } else {
      if (guess + 1 > low) low = Math.min(high, guess + 1);
      digitStage.dataset.state = 'low';
      setFeedback(
        Math.abs(guess - secret) <= 20 ? 'hot' : 'neutral',
        'TOO LOW',
        `${guess} is below the secret number. Narrowed to ${low} – ${high}.`
      );
      history.unshift({ step: attempts, guess, verdict: 'low', low, high });
    }

    rangeDisplay.textContent = `${low} — ${high}`;
    guessInput.value = '';
    updateMidpointButton();
    renderHistory();
    refreshScoreboard();
    guessInput.focus();
  }

  /* Theme toggling & synchronization are handled globally by ../theme-sync.js */

  guessForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleGuess(guessInput.value);
  });

  newRoundBtn?.addEventListener('click', startNewRound);

  midpointBtn?.addEventListener('click', () => {
    if (roundOver) return;
    guessInput.value = midpointBtn.dataset.mid || String(Math.floor((low + high) / 2));
    guessInput.focus();
  });

  openAccountBtn?.addEventListener('click', () => {
    if (window.AakashAccount?.openDialog) {
      window.AakashAccount.openDialog();
      return;
    }
    const launcher = document.querySelector('.account-launcher');
    launcher?.click();
  });

  window.addEventListener('aakash:account-state', (event) => {
    syncAccountBanner(event.detail);
  });

  startNewRound();
  syncAccountBanner();
})();
