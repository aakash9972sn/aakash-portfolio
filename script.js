'use strict';

const entries = window.portfolioEntries || [];
const filters = [...document.querySelectorAll('[data-filter]')];
const topicChips = [...document.querySelectorAll('[data-topic]')];
const layoutButtons = [...document.querySelectorAll('[data-layout]')];
const search = document.querySelector('#work-search');
const results = document.querySelector('#results-status');

let selectedType = 'all';
let activeTopic = '';
let activeLayout = 'grid';

/* Hero Featured Build Spotlight Switcher */
const SPOTLIGHTS = {
  rfid: {
    title: 'RFID Card Detection System',
    desc: 'Arduino UNO + MFRC522 13.56 MHz SPI reader & reference bench',
    href: 'rfid-card-detection.html',
  },
  tests: {
    title: 'Test Centre — NEET, GATE & CUET',
    desc: '275+ PYPs, timed mock exams & Gemini AI MCQ generator',
    href: 'test-centre/',
  },
  maps: {
    title: 'Blunder — Everyday Store & Maps',
    desc: 'Interactive Google Maps DTU 6 km zone picker & Gemini cart helper',
    href: 'blunder/',
  },
};

const spotButtons = [...document.querySelectorAll('[data-spot]')];
const spotTitle = document.querySelector('#spot-title');
const spotDesc = document.querySelector('#spot-desc');
const spotLink = document.querySelector('#spot-link');

spotButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.spot;
    const item = SPOTLIGHTS[key];
    if (!item) return;
    spotButtons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    if (spotTitle) spotTitle.textContent = item.title;
    if (spotDesc) spotDesc.textContent = item.desc;
    if (spotLink) spotLink.href = item.href;
  });
});

function makeCard(entry, index) {
  const article = document.createElement('article');
  article.className = 'collection-card';
  article.id = entry.id;

  const link = document.createElement('a');
  link.className = 'entry-link';
  link.href = entry.href;

  const visual = document.createElement('div');
  visual.className = 'entry-art';
  visual.setAttribute('aria-hidden', 'true');
  const template = document.getElementById(`artwork-${entry.artwork}`);
  if (template) {
    visual.append(template.content.cloneNode(true));
    visual.classList.add(`entry-art-${entry.artwork}`);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'plate-frame';
    fallback.textContent = entry.title;
    visual.append(fallback);
  }

  const body = document.createElement('div');
  body.className = 'entry-body';

  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  if (typeof index === 'number') {
    const num = document.createElement('span');
    num.className = 'entry-index';
    num.textContent = String(index + 1).padStart(2, '0');
    meta.append(num);
  }
  const cat = document.createElement('span');
  cat.textContent = entry.category;
  meta.append(cat);

  if (entry.level) {
    const sep = document.createElement('span');
    sep.className = 'meta-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '·';
    const lvl = document.createElement('span');
    lvl.textContent = entry.level;
    meta.append(sep, lvl);
  }

  if (entry.date) {
    const sep = document.createElement('span');
    sep.className = 'meta-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '·';
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = entry.dateLabel || entry.date;
    meta.append(sep, date);
  }

  const title = document.createElement('h4');
  title.textContent = entry.title;
  body.append(meta, title);

  if (entry.organization) {
    const org = document.createElement('p');
    org.className = 'entry-organization';
    org.textContent = entry.organization;
    body.append(org);
  }

  const description = document.createElement('p');
  description.className = 'entry-description';
  description.textContent = entry.description;
  body.append(description);

  if (Array.isArray(entry.tags) && entry.tags.length) {
    const stack = document.createElement('p');
    stack.className = 'entry-stack';
    stack.textContent = entry.tags.join(' · ');
    body.append(stack);
  }

  const action = document.createElement('span');
  action.className = 'entry-action';
  action.append(document.createTextNode(entry.action || (entry.type === 'workshop' ? 'Explore notes' : 'View project')));
  const arrow = document.createElement('span');
  arrow.className = 'entry-action-arrow';
  arrow.innerHTML =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  arrow.setAttribute('aria-hidden', 'true');
  action.append(arrow);
  body.append(action);

  link.append(visual, body);
  article.append(link);
  return article;
}

function renderCollection() {
  const query = (search?.value || '').trim().toLocaleLowerCase();
  const matched = entries.filter((entry) => {
    const haystack = [
      entry.title,
      entry.category,
      entry.level,
      entry.description,
      entry.organization,
      entry.dateLabel,
      ...(entry.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    const matchesType = selectedType === 'all' || entry.type === selectedType;
    const matchesTopic = !activeTopic || haystack.includes(activeTopic.toLocaleLowerCase());
    const matchesQuery = !query || haystack.includes(query);
    return matchesType && matchesTopic && matchesQuery;
  });

  for (const type of ['project', 'workshop']) {
    const group = document.querySelector(`[data-collection="${type}"]`);
    if (!group) continue;
    const items = matched.filter((entry) => entry.type === type);
    if (type === 'workshop') {
      items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    group.hidden = items.length === 0;
    const grid = group.querySelector('.collection-grid');
    if (grid) {
      grid.classList.toggle('is-compact', activeLayout === 'compact');
      grid.replaceChildren(...items.map((item, idx) => makeCard(item, idx)));
    }
    const countEl = group.querySelector('.collection-count');
    if (countEl) countEl.textContent = String(items.length).padStart(2, '0');
  }

  filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === selectedType));
  });

  topicChips.forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.topic === activeTopic);
  });

  layoutButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.layout === activeLayout));
  });

  if (results) {
    if (query) {
      results.textContent = `${matched.length} ${matched.length === 1 ? 'result' : 'results'} matching “${search.value.trim()}”`;
    } else if (activeTopic) {
      results.textContent = `${matched.length} ${matched.length === 1 ? 'item' : 'items'} filtered by topic · ${activeTopic}`;
    } else {
      results.textContent = `${matched.length} ${selectedType === 'all' ? 'curated builds & workshop notes' : selectedType + (matched.length === 1 ? '' : 's')}`;
    }
  }

  const emptyEl = document.querySelector('#empty-results');
  const clearBtn = document.querySelector('#clear-search');
  if (emptyEl) emptyEl.hidden = matched.length !== 0;
  if (clearBtn) clearBtn.hidden = !search?.value;

  document.dispatchEvent(new Event('portfolio:rendered'));
}

filters.forEach((button) => {
  const type = button.dataset.filter;
  const countSpan = button.querySelector('span');
  if (countSpan) {
    countSpan.textContent = entries.filter((entry) => type === 'all' || entry.type === type).length;
  }
  button.addEventListener('click', () => {
    selectedType = type;
    renderCollection();
  });
});

topicChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    activeTopic = activeTopic === chip.dataset.topic ? '' : chip.dataset.topic;
    if (activeTopic) selectedType = 'all';
    renderCollection();
  });
});

layoutButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeLayout = btn.dataset.layout === 'compact' ? 'compact' : 'grid';
    renderCollection();
  });
});

search?.addEventListener('input', renderCollection);

document.querySelector('#clear-search')?.addEventListener('click', () => {
  if (search) search.value = '';
  renderCollection();
  search?.focus();
});

document.querySelector('#reset-filters')?.addEventListener('click', () => {
  if (search) search.value = '';
  selectedType = 'all';
  activeTopic = '';
  renderCollection();
  search?.focus();
});

document.querySelectorAll('[data-snap-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedType = btn.dataset.snapFilter || 'all';
    activeTopic = '';
    renderCollection();
    document.querySelector('#work')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelectorAll('[data-snap-dossier]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateDossierTab(btn.dataset.snapDossier || 'education');
    document.querySelector('#dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* Tabbed Engineering Dossier */
const dossierTabs = [...document.querySelectorAll('[data-dossier-panel]')];
function activateDossierTab(tabName) {
  dossierTabs.forEach((tab) => {
    const active = tab.dataset.dossierPanel === tabName;
    tab.setAttribute('aria-selected', String(active));
    const panel = document.getElementById(`panel-${tab.dataset.dossierPanel}`);
    if (panel) panel.hidden = !active;
  });
}

dossierTabs.forEach((tab) => {
  tab.addEventListener('click', () => activateDossierTab(tab.dataset.dossierPanel));
});

function handleHashNavigation() {
  const hash = location.hash;
  if (hash === '#education') {
    activateDossierTab('education');
    document.querySelector('#dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (hash === '#about') {
    activateDossierTab('about');
    document.querySelector('#dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (hash === '#workshops') {
    selectedType = 'workshop';
    activeTopic = '';
    renderCollection();
  }
}

window.addEventListener('hashchange', handleHashNavigation);

/* Theme toggling & synchronization are handled globally by theme-sync.js */

/* Mobile Navigation Menu */
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-navigation');
function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('is-open');
}

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation?.classList.toggle('is-open', open);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', (event) => {
    closeMenu();
    const href = link.getAttribute('href');
    if (href === '#education') {
      event.preventDefault();
      activateDossierTab('education');
      document.querySelector('#dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#education');
    } else if (href === '#about') {
      event.preventDefault();
      activateDossierTab('about');
      document.querySelector('#dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#about');
    } else if (href === '#workshops') {
      selectedType = 'workshop';
      activeTopic = '';
      renderCollection();
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.studio-topbar')) closeMenu();
});

matchMedia('(max-width: 1020px)').addEventListener('change', closeMenu);

const yearEl = document.querySelector('#year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

renderCollection();
if (location.hash === '#education' || location.hash === '#about') handleHashNavigation();
