/* ============================================================================
   AAKASH Portfolio — Unified Cross-Page Light / Dark Theme Sync
   Single canonical localStorage key: 'aakash.theme' ('light' | 'dark')
   ========================================================================== */
(() => {
  'use strict';

  const THEME_KEY = 'aakash.theme';
  const LEGACY_KEYS = ['tclab.theme'];

  const ICONS = {
    moon: '<svg class="icon theme-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    sun: '<svg class="icon theme-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  };

  function resolveInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      for (const legacyKey of LEGACY_KEYS) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy === 'dark' || legacy === 'light') {
          localStorage.setItem(THEME_KEY, legacy);
          return legacy;
        }
      }
    } catch {}
    return 'light';
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
      for (const legacyKey of LEGACY_KEYS) {
        localStorage.setItem(legacyKey, theme);
      }
    } catch {}
  }

  function updateMetaColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'dark' ? '#0B100F' : '#F6F7F4');
  }

  function updateToggleButtons(theme) {
    const isDark = theme === 'dark';
    const nextAction = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    const nextText = isDark ? 'Light' : 'Dark';

    const buttons = document.querySelectorAll(
      '#home-theme-toggle, #pg-theme-toggle, #theme-toggle, [data-theme-toggle]'
    );

    buttons.forEach((btn) => {
      btn.setAttribute('aria-label', nextAction);
      btn.setAttribute('title', nextAction);
      btn.setAttribute('aria-pressed', String(isDark));
      btn.dataset.themeState = theme;

      const labelEl = btn.querySelector('#theme-label, #pg-theme-label, [data-theme-label]');
      if (labelEl) {
        labelEl.textContent = nextText;
      }

      const existingSvg = btn.querySelector('svg');
      const nextMarkup = isDark ? ICONS.sun : ICONS.moon;
      if (existingSvg) {
        existingSvg.outerHTML = nextMarkup;
      } else {
        btn.insertAdjacentHTML('afterbegin', nextMarkup);
      }
    });
  }

  function applyTheme(theme, persist = false) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    if (persist) writeTheme(resolved);
    updateMetaColor(resolved);
    updateToggleButtons(resolved);
    try {
      window.dispatchEvent(new CustomEvent('aakash:theme-change', { detail: { theme: resolved } }));
    } catch {}
    return resolved;
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return applyTheme(cur === 'dark' ? 'light' : 'dark', true);
  }

  function ensureStylesheetLoaded() {
    if (document.querySelector('link[href*="theme-sync.css"]')) return;
    const scriptEl = document.currentScript || document.querySelector('script[src*="theme-sync.js"]');
    if (!scriptEl) return;
    const base = new URL('.', new URL(scriptEl.src, location.href));
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('theme-sync.css?v=20261121-t1', base).href;
    document.head.append(link);
  }

  function wireExistingButtons() {
    const buttons = document.querySelectorAll(
      '#home-theme-toggle, #pg-theme-toggle, #theme-toggle, [data-theme-toggle]'
    );
    buttons.forEach((btn) => {
      if (btn.dataset.themeBound === '1') return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggleTheme);
    });
  }

  function mountFallbackToggle() {
    if (
      document.querySelector('#home-theme-toggle, #pg-theme-toggle, #theme-toggle, [data-theme-toggle]')
    ) {
      return;
    }

    const headerActions = document.querySelector('.header-actions, .top-links');
    const subHeader = document.querySelector('.report-header, .case-header');
    let target = headerActions;

    if (!target && subHeader) {
      target = document.createElement('div');
      target.className = 'header-actions';
      const rightEl = subHeader.querySelector('.github-nav, .back-link');
      if (rightEl) {
        subHeader.insertBefore(target, rightEl);
        target.append(rightEl);
      } else {
        subHeader.append(target);
      }
    }

    if (!target) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unified-theme-btn';
    btn.setAttribute('data-theme-toggle', '');
    btn.innerHTML = `${ICONS.moon}<span data-theme-label>Dark</span>`;
    target.prepend(btn);
  }

  // Apply immediately in <head> before paint to avoid FOUC
  ensureStylesheetLoaded();
  const initialTheme = resolveInitialTheme();
  applyTheme(initialTheme, false);

  function onReady() {
    mountFallbackToggle();
    wireExistingButtons();
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    updateMetaColor(cur);
    updateToggleButtons(cur);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
      applyTheme(event.newValue, false);
    }
  });

  window.AakashTheme = {
    key: THEME_KEY,
    get() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    },
    set(next) {
      return applyTheme(next, true);
    },
    toggle: toggleTheme,
  };
})();
