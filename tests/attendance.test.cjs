// Run with: node --test tests/attendance.test.cjs (no package install required).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'case-study.js'), 'utf8'), context);
const analyze = context.analyzeAttendance;
const scan = (time, direction, person = 'P001', status = 'ACCEPTED') => ({ time, direction, person, status });
const start = '2026-11-16T00:00:00+05:30';
const end = '2026-11-17T00:00:00+05:30';

test('sums separate visits without counting the lunch break', () => {
  const result = analyze([
    scan('2026-11-16T09:00:00+05:30', 'IN'), scan('2026-11-16T12:00:00+05:30', 'OUT'),
    scan('2026-11-16T13:00:00+05:30', 'IN'), scan('2026-11-16T17:00:00+05:30', 'OUT')
  ], start, end);
  assert.equal(result.minutes, 420);
  assert.equal(result.sessions, 2);
  assert.equal(result.flags, 0);
});

test('splits an overnight visit across month boundaries', () => {
  const events = [scan('2026-11-30T22:30:00+05:30', 'IN'), scan('2026-12-01T01:15:00+05:30', 'OUT')];
  const november = analyze(events, '2026-11-01T00:00:00+05:30', '2026-12-01T00:00:00+05:30');
  const december = analyze(events, '2026-12-01T00:00:00+05:30', '2027-01-01T00:00:00+05:30');
  assert.equal(november.minutes, 90);
  assert.equal(december.minutes, 75);
  assert.equal(november.minutes + december.minutes, 165);
});

test('preserves timezone offsets and accepts unordered event input', () => {
  const result = analyze([
    scan('2026-11-16T12:00:00+05:30', 'OUT'), scan('2026-11-16T03:30:00Z', 'IN')
  ], start, end);
  assert.equal(result.minutes, 180);
  assert.equal(result.flags, 0);
});

test('does not invent timestamps for open or orphan sessions', () => {
  const result = analyze([scan('2026-11-16T08:00:00+05:30', 'OUT'), scan('2026-11-16T09:00:00+05:30', 'IN')], start, end);
  assert.equal(result.minutes, 0);
  assert.equal(result.sessions, 0);
  assert.equal(result.flags, 2);
});

test('excludes an ambiguous interval following a repeated IN', () => {
  const result = analyze([
    scan('2026-11-16T09:00:00+05:30', 'IN'), scan('2026-11-16T10:00:00+05:30', 'IN'), scan('2026-11-16T12:00:00+05:30', 'OUT')
  ], start, end);
  assert.equal(result.minutes, 0);
  assert.equal(result.sessions, 0);
  assert.equal(result.flags, 1);
});

test('ignores revoked credentials and keeps people independent', () => {
  const result = analyze([
    scan('2026-11-16T08:00:00+05:30', 'IN', 'P001', 'REVOKED'),
    scan('2026-11-16T09:00:00+05:30', 'IN', 'P001'), scan('2026-11-16T12:00:00+05:30', 'OUT', 'P001'),
    scan('2026-11-16T10:00:00+05:30', 'IN', 'P002'), scan('2026-11-16T12:00:00+05:30', 'OUT', 'P002')
  ], start, end);
  assert.equal(result.minutes, 300);
  assert.equal(result.sessions, 2);
  assert.equal(result.rejected, 1);
  assert.equal(result.flags, 0);
});

test('clips to a custom range and excludes a visit ending at its start', () => {
  const events = [scan('2026-11-16T09:00:00+05:30', 'IN'), scan('2026-11-16T12:00:00+05:30', 'OUT')];
  assert.equal(analyze(events, '2026-11-16T10:15:00+05:30', '2026-11-16T11:30:00+05:30').minutes, 75);
  const outside = analyze(events, '2026-11-16T12:00:00+05:30', end);
  assert.equal(outside.minutes, 0);
  assert.equal(outside.sessions, 0);
});

test('handles empty data and rejects an invalid reporting interval', () => {
  assert.equal(analyze([], start, end).minutes, 0);
  assert.throws(() => analyze([], end, start), /reporting window/);
  assert.throws(() => analyze([], 'invalid', end), /reporting window/);
});
