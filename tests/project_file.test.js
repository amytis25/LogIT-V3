// project_file.test.js
// Description: verifies the pure project-log helpers — the sanitization rules
//              that turn a free-text category or project into a writable file
//              name, the 4-column row shape, and the completeness predicate
//              that decides whether a row is mirrored at all (SPEC §3.1).
// Inputs:  none
// Outputs: node:test results
// Created: 2026-08-27

import test from 'node:test';
import assert from 'node:assert/strict';
import { isMirrorable, projectRowFields, sanitizePathName } from '../src/main/log/project_file.js';
import { parseCsv, serializeLine } from '../src/main/log/csv.js';
import { KIND_NORMAL, PROJECT_LOG_HEADER_LINE } from '../src/shared/constants.js';

const row = (over = {}) => ({
  start: '09:00', end: '10:30', kind: KIND_NORMAL,
  category: 'School', project: 'Capstone', notes: '', ...over
});

// ── sanitization (SPEC §3.1) ────────────────────────────────────────────────

test('sanitize: a clean name is unchanged', () => {
  assert.equal(sanitizePathName('Capstone'), 'Capstone');
  assert.equal(sanitizePathName('Thermo Lab'), 'Thermo Lab');
});

test('sanitize: every Windows-illegal character becomes a dash', () => {
  const cases = [
    ['Thermo Lab: Part 2', 'Thermo Lab- Part 2'],
    ['R&D / Ops', 'R&D - Ops'],
    ['back\\slash', 'back-slash'],
    ['star*', 'star-'],
    ['what?', 'what-'],
    ['say "hi"', 'say -hi-'],
    ['a<b>c', 'a-b-c'],
    ['pipe|d', 'pipe-d']
  ];
  for (const [input, expected] of cases) {
    assert.equal(sanitizePathName(input), expected, `input: ${input}`);
  }
});

test('sanitize: control characters become dashes', () => {
  assert.equal(sanitizePathName('a\x00b\x1fc'), 'a-b-c');
});

test('sanitize: trailing dots and surrounding whitespace are trimmed', () => {
  assert.equal(sanitizePathName('Notes.'), 'Notes');
  assert.equal(sanitizePathName('Notes...'), 'Notes');
  assert.equal(sanitizePathName('  Trim me  '), 'Trim me');
  assert.equal(sanitizePathName('Trailing space '), 'Trailing space');
});

test('sanitize: reserved device names gain a prefix, keeping their case', () => {
  assert.equal(sanitizePathName('CON'), '_CON');
  assert.equal(sanitizePathName('con'), '_con');
  assert.equal(sanitizePathName('COM1'), '_COM1');
  assert.equal(sanitizePathName('LPT9'), '_LPT9');
  assert.equal(sanitizePathName('CON.'), '_CON');
  // Not reserved: only the exact names are.
  assert.equal(sanitizePathName('CONTEXT'), 'CONTEXT');
});

test('sanitize: a name with no writable form returns empty', () => {
  assert.equal(sanitizePathName('...'), '');
  assert.equal(sanitizePathName('   '), '');
  assert.equal(sanitizePathName(''), '');
  assert.equal(sanitizePathName(null), '');
  assert.equal(sanitizePathName(undefined), '');
});

test('sanitize: separators are replaced, not dropped — no path traversal', () => {
  // A separator becomes a dash rather than vanishing, so no name can climb out
  // of Projects/. '..' on its own trims to empty and is refused outright.
  assert.equal(sanitizePathName('..'), '');
  assert.equal(sanitizePathName('../secrets'), '..-secrets');
  assert.equal(sanitizePathName('..\\secrets'), '..-secrets');
});

// ── the completeness predicate ──────────────────────────────────────────────

test('mirrorable: a fully attributed closed row is mirrored', () => {
  assert.equal(isMirrorable(row()), true);
});

test('mirrorable: an open row is never mirrored', () => {
  assert.equal(isMirrorable(row({ end: '' })), false);
});

test('mirrorable: a row with no category or no project is never mirrored', () => {
  assert.equal(isMirrorable(row({ category: '' })), false);
  assert.equal(isMirrorable(row({ project: '' })), false);
  assert.equal(isMirrorable(row({ category: '', project: '' })), false);
});

// ── the row shape ───────────────────────────────────────────────────────────

test('row fields: date first, then times, then notes — category/project omitted', () => {
  assert.deepEqual(
    projectRowFields('2026-08-27', row({ notes: 'wrote the plan' })),
    ['2026-08-27', '09:00', '10:30', 'wrote the plan']
  );
});

test('row fields: an empty note is a literal empty field', () => {
  const line = serializeLine(projectRowFields('2026-08-27', row()));
  assert.equal(line, '2026-08-27,09:00,10:30,');
});

test('row fields: notes with commas, quotes and newlines round-trip', () => {
  const notes = 'read "the spec", then\nwrote tests';
  const line = serializeLine(projectRowFields('2026-08-27', row({ notes })));
  const [fields] = parseCsv(line);
  assert.equal(fields[3], notes);
});

test('the header line is exactly the four agreed columns', () => {
  assert.equal(PROJECT_LOG_HEADER_LINE, 'date,start_time,end_time,additional_notes');
});
