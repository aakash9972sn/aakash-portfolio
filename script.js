'use strict';

const entries = window.portfolioEntries || [];
const filters = [...document.querySelectorAll('[data-filter]')];
const search = document.querySelector('#work-search');
const results = document.querySelector('#results-status');
let selectedType = 'all';

function makeCard(entry) {
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
    visual.classList.add('entry-art-default');
    const initial = document.createElement('span');
    initial.textContent = entry.title.charAt(0);
    visual.append(initial);
  }
  const body = document.createElement('div');
  body.className = 'entry-body';
  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  const category = document.createElement('span');
  category.textContent = entry.category;
  meta.append(category);
  if (entry.level) {
    const level = document.createElement('span');
    level.className = 'entry-level';
    level.textContent = entry.level;
    meta.append(level);
  }
  if (entry.date) {
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = entry.dateLabel || entry.date;
    meta.append(date);
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
  const tags = document.createElement('ul');
  tags.className = 'entry-tags';
  tags.setAttribute('aria-label', 'Topics and tools');
  for (const tag of entry.tags || []) {
    const item = document.createElement('li');
    item.textContent = tag;
    tags.append(item);
  }
  const action = document.createElement('span');
  action.className = 'entry-action';
  action.append(document.createTextNode(entry.action || (entry.type === 'workshop' ? 'Explore my learning' : 'View project')));
  const arrow = document.createElement('span');
  arrow.innerHTML = "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 19 19 5M5 5h14v14\"/></svg>";
  arrow.setAttribute('aria-hidden', 'true');
  action.append(arrow);
  body.append(description, tags, action);
  link.append(visual, body);
  article.append(link);
  return article;
}

function renderCollection() {
  const query = search.value.trim().toLocaleLowerCase();
  const matched = entries.filter(entry =>
    (selectedType === 'all' || entry.type === selectedType) &&
    [entry.title, entry.category, entry.level, entry.description, entry.organization, entry.dateLabel, ...(entry.tags || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
  );
  for (const type of ['project', 'workshop']) {
    const group = document.querySelector(`[data-collection="${type}"]`);
    const items = matched.filter(entry => entry.type === type);
    if (type === 'workshop') items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    group.hidden = items.length === 0;
    group.querySelector('.collection-grid').replaceChildren(...items.map(makeCard));
    group.querySelector('.collection-count').textContent = String(items.length).padStart(2, '0');
  }
  filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === selectedType)));
  results.textContent = query
    ? `${matched.length} ${matched.length === 1 ? 'result' : 'results'} for “${search.value.trim()}”`
    : `${matched.length} ${selectedType === 'all' ? 'things built & learned' : selectedType + (matched.length === 1 ? '' : 's')}`;
  document.querySelector('#empty-results').hidden = matched.length !== 0;
  document.querySelector('#clear-search').hidden = !search.value;
  document.dispatchEvent(new Event('portfolio:rendered'));
}

filters.forEach(button => {
  const type = button.dataset.filter;
  button.querySelector('span').textContent = entries.filter(entry => type === 'all' || entry.type === type).length;
  button.addEventListener('click', () => { selectedType = type; renderCollection(); });
});
search.addEventListener('input', renderCollection);
document.querySelector('#clear-search').addEventListener('click', () => {
  search.value = '';
  renderCollection();
  search.focus();
});
document.querySelector('#reset-filters').addEventListener('click', () => {
  search.value = '';
  selectedType = 'all';
  renderCollection();
  search.focus();
});
renderCollection();

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-navigation');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
document.querySelector('#year').textContent = new Date().getFullYear();
