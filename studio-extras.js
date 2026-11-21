/* Selected studio features adapted from the user-provided portfolio ZIP.
   Additive: existing pages, study content, Firebase and Gemini routes are untouched. */
(() => {
  'use strict';
  const hero = document.querySelector('.site-home .hero');
  const work = document.querySelector('.site-home .work-section');
  const toolbar = work?.querySelector('.collection-toolbar');
  const search = work?.querySelector('#work-search');
  const entries = Array.isArray(window.portfolioEntries) ? window.portfolioEntries : [];
  if (!hero || !work || !toolbar || !search || !entries.length) return;

  const make = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };

  /* A featured-build switcher rather than duplicating a separate project list.
     Links and descriptions always come from the authoritative portfolio data. */
  const featured = [
    { id: 'rfid-card-detection', tab: '01  RFID hardware', label: 'EMBEDDED / 13.56 MHZ' },
    { id: 'biology-test', tab: '02  Test Centre', label: 'NEET · GATE ECE · CUET' },
    { id: 'blunder-pro-max', tab: '03  Blunder store', label: 'GROCERY / FULL STACK' },
  ].map(item => ({ ...item, entry: entries.find(entry => entry.id === item.id) }))
    .filter(item => item.entry);

  if (featured.length) {
    const region = make('section', 'studio-featured wrap');
    region.setAttribute('aria-labelledby', 'studio-featured-title');
    const header = make('div', 'studio-featured-heading');
    const kicker = make('span', 'studio-featured-kicker', 'SELECTED / BUILDS');
    const heading = make('h2', '', 'Featured engineering work');
    heading.id = 'studio-featured-title';
    const intro = make('p', '', 'Switch between a hardware system, a learning tool and a web product.');
    header.append(kicker, heading, intro);

    const content = make('div', 'studio-featured-content');
    const options = make('div', 'studio-featured-tabs');
    options.setAttribute('role', 'tablist');
    options.setAttribute('aria-label', 'Featured projects');
    const details = make('div', 'studio-featured-details');
    details.id = 'studio-featured-details';
    details.setAttribute('role', 'tabpanel');
    const category = make('span', 'studio-featured-category');
    const title = make('h3', 'studio-featured-title');
    const description = make('p', 'studio-featured-description');
    const link = make('a', 'studio-featured-link', 'Explore this project');
    const arrow = make('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    details.append(category, title, description, link);
    content.append(options, details);
    region.append(header, content);
    hero.after(region);

    let selected = 0;
    const tabs = featured.map((item, index) => {
      const button = make('button', 'studio-featured-tab', item.tab);
      button.type = 'button';
      button.id = 'studio-featured-tab-' + index;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', details.id);
      button.addEventListener('click', () => activate(index));
      button.addEventListener('keydown', event => {
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        let next = selected;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = featured.length - 1;
        else next = (selected + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + featured.length) % featured.length;
        activate(next);
        tabs[next].focus();
      });
      options.append(button);
      return button;
    });

    function activate(index) {
      const item = featured[index];
      if (!item) return;
      selected = index;
      tabs.forEach((button, i) => {
        const active = i === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      details.setAttribute('aria-labelledby', tabs[index].id);
      details.dataset.kind = item.entry.artwork || 'default';
      category.textContent = item.label;
      title.textContent = item.entry.title;
      description.textContent = item.entry.description;
      link.href = item.entry.href; // The existing authoritative project link.
      if (/^https?:\/\//.test(item.entry.href)) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    }
    activate(0);
  }

  /* Quick topic buttons map to existing portfolio search tags, not guesses. */
  const actions = make('div', 'studio-quick-actions');
  actions.setAttribute('aria-label', 'Quick work filters and layout');
  const topics = make('div', 'studio-topic-actions');
  const topicLabel = make('span', 'studio-quick-label', 'Quick focus');
  topics.append(topicLabel);
  const specs = [
    ['Arduino UNO', 'RFID / Embedded'],
    ['JavaScript', 'Web / AI tools'],
    ['Analog circuits', 'Analog'],
    ['PCB design', 'PCB / Hardware'],
  ];
  const topicButtons = specs.map(([query, caption]) => {
    const button = make('button', 'studio-topic-chip', caption);
    button.type = 'button';
    button.dataset.topic = query;
    button.setAttribute('aria-pressed', 'false');
    topics.append(button);
    button.addEventListener('click', () => {
      const active = search.value.trim().toLocaleLowerCase() !== query.toLocaleLowerCase();
      search.value = active ? query : '';
      const showAll = toolbar.querySelector('[data-filter="all"]');
      if (showAll) showAll.click();
      search.dispatchEvent(new Event('input', { bubbles: true }));
      work.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      search.focus({ preventScroll: true });
    });
    return button;
  });

  const viewGroup = make('div', 'studio-view-actions');
  viewGroup.setAttribute('role', 'group');
  viewGroup.setAttribute('aria-label', 'Project card layout');
  viewGroup.append(make('span', 'studio-quick-label', 'View'));
  const viewButtons = [
    ['bento', 'Bento'],
    ['index', 'Compact'],
  ].map(([view, label]) => {
    const button = make('button', 'studio-view-chip', label);
    button.type = 'button';
    button.dataset.studioView = view;
    button.addEventListener('click', () => setView(view));
    viewGroup.append(button);
    return button;
  });
  function setView(view) {
    const index = view === 'index';
    document.body.classList.toggle('studio-list-view', index);
    viewButtons.forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.studioView === (index ? 'index' : 'bento'))));
    try { sessionStorage.setItem('aakash.studio.view', index ? 'index' : 'bento'); }
    catch (_) { /* Preference storage can be unavailable; layout still works. */ }
  }
  search.addEventListener('input', () => {
    const active = search.value.trim().toLocaleLowerCase();
    topicButtons.forEach(button => button.setAttribute(
      'aria-pressed', String(button.dataset.topic.toLocaleLowerCase() === active)
    ));
  });
  actions.append(topics, viewGroup);
  toolbar.before(actions);
  let preferred = 'bento';
  try { preferred = sessionStorage.getItem('aakash.studio.view') || 'bento'; } catch (_) {}
  setView(preferred === 'index' ? 'index' : 'bento');
})();
