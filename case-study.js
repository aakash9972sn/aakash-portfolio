'use strict';

// This model processes illustrative records. It has no connection to RFID hardware.
function analyzeAttendance(events, rangeStart, rangeEnd) {
  const start = Date.parse(rangeStart);
  const end = Date.parse(rangeEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError('A reporting window must have a valid start and a later end.');
  }
  const open = new Map();
  let milliseconds = 0;
  let sessions = 0;
  let flags = 0;
  let rejected = 0;
  const chronological = [...events].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  for (const event of chronological) {
    if (event.status !== 'ACCEPTED') { rejected++; continue; }
    const time = Date.parse(event.time);
    if (!Number.isFinite(time) || !event.person) { flags++; continue; }
    const previous = open.get(event.person);
    if (event.direction === 'IN') {
      if (previous) {
        // A second IN makes the interval ambiguous; do not infer a missing exit.
        previous.ambiguous = true;
        flags++;
      } else {
        open.set(event.person, { time, ambiguous: false });
      }
    } else if (event.direction === 'OUT') {
      if (!previous) { flags++; continue; }
      if (time <= previous.time) {
        flags++;
      } else if (!previous.ambiguous) {
        const overlap = Math.max(0, Math.min(time, end) - Math.max(previous.time, start));
        if (overlap > 0) { milliseconds += overlap; sessions++; }
      }
      open.delete(event.person);
    } else {
      flags++;
    }
  }
  flags += open.size;
  return { minutes: milliseconds / 60000, sessions, flags, rejected };
}

document.addEventListener('DOMContentLoaded', () => {
  const links = [...document.querySelectorAll('.report-subnav a')];
  const sections = links.map(link => document.querySelector(link.hash)).filter(Boolean);
  let scheduled = false;
  function updateNavigation() {
    const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= 150) || sections[0];
    links.forEach(link => {
      if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
  }, { passive: true });
  updateNavigation();

  const example = document.querySelector('#attendance-example');
  if (!example) return;
  const scan = (time, direction, credential = 'C001', status = 'ACCEPTED') => ({ time, direction, credential, status, person: 'P001' });
  const day = [scan('2026-11-16T09:00:00+05:30', 'IN'), scan('2026-11-16T12:00:00+05:30', 'OUT'), scan('2026-11-16T13:00:00+05:30', 'IN'), scan('2026-11-16T17:00:00+05:30', 'OUT')];
  const examples = {
    day: {
      title: 'Two visits. One hour away.',
      period: 'Reporting period: 16 November 2026 · Asia/Kolkata',
      start: '2026-11-16T00:00:00+05:30', end: '2026-11-17T00:00:00+05:30', events: day,
      explanation: '09:00–12:00 contributes 3 hours; 13:00–17:00 contributes 4. The break is excluded.'
    },
    overnight: {
      title: 'One visit. Two calendar months.',
      period: 'Reporting period: November 2026 · Asia/Kolkata',
      start: '2026-11-01T00:00:00+05:30', end: '2026-12-01T00:00:00+05:30',
      events: [scan('2026-11-30T22:30:00+05:30', 'IN'), scan('2026-12-01T01:15:00+05:30', 'OUT')],
      explanation: 'The full visit lasts 2h 45m. November receives 1h 30m; the remaining 1h 15m belongs to December.'
    },
    incomplete: {
      title: 'An open visit needs review.',
      period: 'Reporting period: 16 November 2026 · Asia/Kolkata',
      start: '2026-11-16T00:00:00+05:30', end: '2026-11-17T00:00:00+05:30', events: day.slice(0, 3),
      explanation: 'The morning visit contributes 3 hours. The 13:00 entry has no exit and is flagged; no departure time is invented.'
    },
    replacement: {
      title: 'A new credential. The same person.',
      period: 'Reporting period: 16 November 2026 · Person P001',
      start: '2026-11-16T00:00:00+05:30', end: '2026-11-17T00:00:00+05:30',
      events: [scan('2026-11-16T08:55:00+05:30', 'IN', 'C001', 'REVOKED'), scan('2026-11-16T09:00:00+05:30', 'IN', 'C002'), scan('2026-11-16T12:00:00+05:30', 'OUT', 'C002')],
      explanation: 'The revoked card is rejected. The replacement card records one 3-hour visit for the existing Person ID; historical records remain intact.'
    }
  };
  const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  function render(key, announce = true) {
    const data = examples[key];
    const result = analyzeAttendance(data.events, data.start, data.end);
    const duration = `${Math.floor(result.minutes / 60)}h ${String(Math.round(result.minutes % 60)).padStart(2, '0')}m`;
    document.querySelector('#demo-title').textContent = data.title;
    document.querySelector('#demo-period').textContent = data.period;
    document.querySelector('#demo-duration').textContent = duration;
    document.querySelector('#demo-visits').textContent = result.sessions;
    document.querySelector('#demo-flags').textContent = result.flags;
    document.querySelector('#demo-explanation').textContent = data.explanation;
    document.querySelector('#demo-events').replaceChildren(...data.events.map(event => {
      const row = document.createElement('tr');
      [timeFormat.format(new Date(event.time)), event.direction, event.credential, event.status === 'ACCEPTED' ? 'Accepted' : 'Rejected · revoked'].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      return row;
    }));
    example.querySelectorAll('[data-example]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.example === key)));
    if (announce) document.querySelector('#demo-announcement').textContent = `${data.title} Confirmed presence ${duration}, ${result.sessions} completed visits, ${result.flags} flags for review.`;
  }
  example.querySelector('.example-options').hidden = false;
  example.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => render(button.dataset.example)));
  render('day', false);
});
