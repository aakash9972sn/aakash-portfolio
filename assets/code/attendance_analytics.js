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

if (typeof module !== "undefined") module.exports = { analyzeAttendance };
