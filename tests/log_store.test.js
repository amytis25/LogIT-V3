// log_store.test.js
// Description: verifies the log layer against the frozen file contract —
//              RFC 4180 both ways, CRLF, both folder layouts, open-row scan
//              (not last-line), atomic rewrite, delete, range walk, retry.
// Inputs:  none (creates scratch data roots under the OS temp dir)
// Outputs: node:test results
// Created: 2026-08-17

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LogStore, LogWriteError, nextDate, prevDate, toDateStr } from '../src/main/log/log_store.js';
import { parseCsv, serializeLine } from '../src/main/log/csv.js';
import { KIND_NORMAL, KIND_MANUAL, KIND_FOCUS, LOG_HEADER_LINE } from '../src/shared/constants.js';

// Description: fresh scratch root per test.
// Inputs: none  Outputs: directory path
function scratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'logit-test-'));
}

const noSleep = () => Promise.resolve();

const row = (over = {}) => ({
  start: '14:02', end: '', kind: KIND_NORMAL, category: '', project: '', notes: '', ...over
});

// ── CSV contract ────────────────────────────────────────────────────────────

test('csv: quoting round-trips commas, quotes, and newlines', () => {
  const notes = 'figuring out what a CV is cuz this posting requires "other"?, huh';
  const line = serializeLine(['09:00', '09:30', 'normal', 'Work', 'A,B', notes]);
  const [fields] = parseCsv(line);
  assert.equal(fields[4], 'A,B');
  assert.equal(fields[5], notes);
});

test('csv: empty fields are literal empty strings between commas', () => {
  const line = serializeLine(['09:00', '', 'normal', '', '', '']);
  assert.equal(line, '09:00,,normal,,,');
});

test('csv: parses LF files as well as CRLF (hand-edited logs)', () => {
  const rows = parseCsv('a,b\nc,d\n');
  assert.deepEqual(rows, [['a', 'b'], ['c', 'd']]);
});

// ── file creation and append ────────────────────────────────────────────────

test('append creates folder tree, header, and CRLF endings', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-03-23', row());
  const file = store.dayFilePath('2026-03-23');
  assert.ok(file.includes(path.join('AppLog', '2026', '03-March', '2026-03-23.csv')));
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text, LOG_HEADER_LINE + '\r\n' + '14:02,,normal,,,\r\n');
});

test('append goes to an existing legacy-layout file, never splitting a day', async () => {
  const root = scratchRoot();
  const store = new LogStore(root, noSleep);
  const legacy = store.legacyDayFilePath('2026-03-23');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, LOG_HEADER_LINE + '\r\n09:00,10:00,normal,Work,,\r\n', 'utf8');
  await store.appendRow('2026-03-23', row());
  assert.equal(fs.existsSync(store.dayFilePath('2026-03-23')), false);
  assert.equal(store.readDay('2026-03-23').length, 2);
});

test('legacy rows with mode=inactive still parse', async () => {
  const root = scratchRoot();
  const store = new LogStore(root, noSleep);
  const legacy = store.legacyDayFilePath('2025-11-02');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy,
    LOG_HEADER_LINE + '\r\n13:00,13:20,inactive,Break / Inactive,,\r\n', 'utf8');
  const rows = store.readDay('2025-11-02');
  assert.equal(rows[0].kind, 'inactive');
  assert.equal(rows[0].category, 'Break / Inactive');
});

test('missing file reads as an empty day, never an error', () => {
  const store = new LogStore(scratchRoot(), noSleep);
  assert.deepEqual(store.readDay('2026-01-01'), []);
});

// ── the open row ────────────────────────────────────────────────────────────

test('open row is found by empty end scan, not by last line', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-05-20', row({ start: '14:02' }));               // open
  await store.appendRow('2026-05-20', row({                                   // manual after it
    start: '09:00', end: '10:00', kind: KIND_MANUAL, category: 'School'
  }));
  const open = store.findOpenRow('2026-05-20');
  assert.equal(open.index, 0);
  assert.equal(open.row.start, '14:02');
});

test('updateOpenRow sets end + details and preserves kind', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-05-20', row({ kind: KIND_FOCUS, start: '13:30' }));
  await store.updateOpenRow('2026-05-20', {
    end: '15:30', category: 'Work', project: 'Thesis', notes: 'wrote ch. 2'
  });
  const rows = store.readDay('2026-05-20');
  assert.deepEqual(rows[0], {
    start: '13:30', end: '15:30', kind: KIND_FOCUS,
    category: 'Work', project: 'Thesis', notes: 'wrote ch. 2'
  });
  assert.equal(store.findOpenRow('2026-05-20'), null);
});

test('deleteOpenRow removes only the open row', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-05-20', row({ start: '09:00', end: '10:00', category: 'Work' }));
  await store.appendRow('2026-05-20', row({ start: '10:00' }));               // open
  await store.deleteOpenRow('2026-05-20');
  const rows = store.readDay('2026-05-20');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].start, '09:00');
});

test('deleteOpenRow with no open row is a no-op', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-05-20', row({ start: '09:00', end: '10:00' }));
  await store.deleteOpenRow('2026-05-20');
  assert.equal(store.readDay('2026-05-20').length, 1);
});

// ── range walk ──────────────────────────────────────────────────────────────

test('readRange includes missing days as empty slots', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  await store.appendRow('2026-05-18', row({ start: '09:00', end: '10:00' }));
  await store.appendRow('2026-05-20', row({ start: '11:00', end: '12:00' }));
  const range = store.readRange('2026-05-18', '2026-05-20');
  assert.equal(range.length, 3);
  assert.equal(range[1].rows.length, 0);
  assert.equal(range[1].date, '2026-05-19');
});

test('date helpers cross month and year boundaries correctly', () => {
  assert.equal(nextDate('2026-01-31'), '2026-02-01');
  assert.equal(nextDate('2026-12-31'), '2027-01-01');
  assert.equal(prevDate('2026-03-01'), '2026-02-28');
  assert.equal(toDateStr(new Date(2026, 0, 5)), '2026-01-05');
});

// ── retry on locked files ───────────────────────────────────────────────────

test('withRetry retries then succeeds', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  let calls = 0;
  await store.withRetry(() => {
    calls += 1;
    if (calls < 3) { const e = new Error('busy'); e.code = 'EBUSY'; throw e; }
  });
  assert.equal(calls, 3);
});

test('withRetry throws LogWriteError after final failure', async () => {
  const store = new LogStore(scratchRoot(), noSleep);
  let calls = 0;
  await assert.rejects(
    store.withRetry(() => { calls += 1; throw new Error('locked'); }),
    LogWriteError
  );
  assert.equal(calls, 3);
});
