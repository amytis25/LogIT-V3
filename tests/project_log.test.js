// project_log.test.js
// Description: verifies the project-log mirror through the log layer against
//              real files — where the path lands, header-then-append, the
//              completeness rules from every angle, the off switch, and the
//              failure contract (a mirror failure never throws and never
//              disturbs the daily row).
// Inputs:  none (creates scratch data roots under the OS temp dir)
// Outputs: node:test results
// Created: 2026-08-27

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LogStore } from '../src/main/log/log_store.js';
import {
  KIND_MANUAL, KIND_NORMAL, MIRROR_OK, MIRROR_SKIPPED,
  MIRROR_REASON_UNWRITABLE_NAME, MIRROR_REASON_WRITE_FAILED,
  PROJECT_LOG_HEADER_LINE, TIMED_OUT_NOTE
} from '../src/shared/constants.js';

// Description: fresh scratch root per test.
// Inputs: none  Outputs: directory path
function scratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'logit-proj-'));
}

const noSleep = () => Promise.resolve();

// Description: a store with the mirror already switched on.
// Inputs: none  Outputs: { store, root }
function mirroringStore() {
  const root = scratchRoot();
  const store = new LogStore(root, noSleep);
  store.setProjectMirror(true);
  return { store, root };
}

// Description: an open row with default fields, overridable per test.
// Inputs: over — partial row  Outputs: row object
const open = (over = {}) => ({
  start: '09:00', end: '', kind: KIND_NORMAL, category: '', project: '', notes: '', ...over
});
// Description: a completed row with default fields, overridable per test.
// Inputs: over — partial row  Outputs: row object
const done = (over = {}) => ({
  start: '09:00', end: '10:30', kind: KIND_NORMAL,
  category: 'School', project: 'Capstone', notes: '', ...over
});

// ── the path ────────────────────────────────────────────────────────────────

test('project path is AppLog/Projects/<Category>/<Project>.csv', () => {
  const { store } = mirroringStore();
  const file = store.projectFilePath('School', 'Capstone');
  assert.ok(file.endsWith(path.join('AppLog', 'Projects', 'School', 'Capstone.csv')), file);
});

test('project path sanitizes both halves', () => {
  const { store } = mirroringStore();
  const file = store.projectFilePath('R&D / Ops', 'Thermo Lab: Part 2');
  assert.ok(file.endsWith(path.join('R&D - Ops', 'Thermo Lab- Part 2.csv')), file);
});

test('project path is null when either name has no writable form', () => {
  const { store } = mirroringStore();
  assert.equal(store.projectFilePath('...', 'Capstone'), null);
  assert.equal(store.projectFilePath('School', '   '), null);
});

test('project path follows setRoot, like every other path', () => {
  const { store } = mirroringStore();
  const moved = scratchRoot();
  store.setRoot(moved);
  assert.ok(store.projectFilePath('School', 'Capstone').startsWith(moved));
});

test('the mirror is off unless switched on', () => {
  const store = new LogStore(scratchRoot(), noSleep);
  assert.equal(store.projectMirror, false);
  store.setProjectMirror(true);
  assert.equal(store.projectMirror, true);
  // Anything other than a literal true is off — the setting arrives from JSON.
  store.setProjectMirror('yes');
  assert.equal(store.projectMirror, false);
});

// ── writing ─────────────────────────────────────────────────────────────────

test('a completed manual entry creates the project file with a header', async () => {
  const { store } = mirroringStore();
  const res = await store.appendRow('2026-08-27',
    done({ kind: KIND_MANUAL, notes: 'wrote the plan' }));
  assert.equal(res.mirror, MIRROR_OK);
  const text = fs.readFileSync(store.projectFilePath('School', 'Capstone'), 'utf8');
  assert.equal(text,
    PROJECT_LOG_HEADER_LINE + '\r\n' + '2026-08-27,09:00,10:30,wrote the plan\r\n');
});

test('a second entry in the same project appends without repeating the header', async () => {
  const { store } = mirroringStore();
  await store.appendRow('2026-08-27', done());
  await store.appendRow('2026-08-28', done({ start: '11:00', end: '12:00' }));
  const text = fs.readFileSync(store.projectFilePath('School', 'Capstone'), 'utf8');
  assert.equal(text,
    PROJECT_LOG_HEADER_LINE + '\r\n' +
    '2026-08-27,09:00,10:30,\r\n' +
    '2026-08-28,11:00,12:00,\r\n');
});

test('closing an open row mirrors the completed block', async () => {
  const { store } = mirroringStore();
  const appended = await store.appendRow('2026-08-27', open());
  assert.equal(appended.mirror, MIRROR_SKIPPED);   // nothing to mirror yet
  const closed = await store.updateOpenRow('2026-08-27', {
    end: '10:30', category: 'Work', project: 'LogIT', notes: 'shipped it'
  });
  assert.equal(closed.mirror, MIRROR_OK);
  const text = fs.readFileSync(store.projectFilePath('Work', 'LogIT'), 'utf8');
  assert.ok(text.endsWith('2026-08-27,09:00,10:30,shipped it\r\n'), text);
});

// ── what is NOT mirrored (the completeness rule, from every angle) ──────────

test('an open row is not mirrored', async () => {
  const { store, root } = mirroringStore();
  const res = await store.appendRow('2026-08-27', open());
  assert.equal(res.mirror, MIRROR_SKIPPED);
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
});

test('a timeout-closed row is not mirrored', async () => {
  const { store, root } = mirroringStore();
  await store.appendRow('2026-08-27', open());
  const res = await store.updateOpenRow('2026-08-27', {
    end: '09:20', notes: TIMED_OUT_NOTE
  });
  assert.equal(res.mirror, MIRROR_SKIPPED);
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
});

test('a manual entry with a blank project is not mirrored', async () => {
  const { store, root } = mirroringStore();
  const res = await store.appendRow('2026-08-27',
    done({ kind: KIND_MANUAL, project: '' }));
  assert.equal(res.mirror, MIRROR_SKIPPED);
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
});

test('deleting the open row touches no project file', async () => {
  const { store, root } = mirroringStore();
  await store.appendRow('2026-08-27', open());
  await store.deleteOpenRow('2026-08-27');
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
  assert.equal(store.readDay('2026-08-27').length, 0);
});

test('with the mirror off, Projects/ is never created', async () => {
  const root = scratchRoot();
  const store = new LogStore(root, noSleep);          // mirror defaults off
  await store.appendRow('2026-08-27', done());
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
  assert.equal(store.readDay('2026-08-27').length, 1);
});

// ── ordering and dates ──────────────────────────────────────────────────────

test('a back-filled earlier date appends at the end, out of date order', async () => {
  const { store } = mirroringStore();
  await store.appendRow('2026-08-27', done());
  await store.appendRow('2026-08-25', done({ kind: KIND_MANUAL, start: '13:00', end: '14:00' }));
  const text = fs.readFileSync(store.projectFilePath('School', 'Capstone'), 'utf8');
  const lines = text.trim().split('\r\n');
  assert.equal(lines[1], '2026-08-27,09:00,10:30,');
  assert.equal(lines[2], '2026-08-25,13:00,14:00,');
});

test('a block spanning midnight files under its start date', async () => {
  const { store } = mirroringStore();
  await store.appendRow('2026-08-27', open({ start: '23:40' }));
  await store.updateOpenRow('2026-08-27', {
    end: '00:15', category: 'Work', project: 'LogIT', notes: ''
  });
  const text = fs.readFileSync(store.projectFilePath('Work', 'LogIT'), 'utf8');
  assert.ok(text.includes('2026-08-27,23:40,00:15,'), text);
});

// ── failure contract ────────────────────────────────────────────────────────

test('an unwritable name is a reported failure, not a silent skip', async () => {
  const { store, root } = mirroringStore();
  const res = await store.appendRow('2026-08-27', done({ category: '...' }));
  assert.equal(res.mirror.reason, MIRROR_REASON_UNWRITABLE_NAME);
  assert.equal(typeof res.mirror.failedName, 'string');
  // The daily row is untouched by the mirror's problem.
  assert.equal(store.readDay('2026-08-27').length, 1);
  assert.equal(fs.existsSync(path.join(root, 'AppLog', 'Projects')), false);
});

test('a mirror write failure never throws and leaves the daily row intact', async () => {
  const { store, root } = mirroringStore();
  // Put a FILE where the category folder must go: mkdir then fails, the same
  // shape of failure as a locked or permission-denied path.
  const projects = path.join(root, 'AppLog', 'Projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'School'), 'in the way', 'utf8');

  const res = await store.appendRow('2026-08-27', done({ notes: 'still saved' }));
  assert.equal(res.mirror.reason, MIRROR_REASON_WRITE_FAILED);
  assert.equal(res.mirror.failedName, 'Capstone.csv');
  const rows = store.readDay('2026-08-27');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notes, 'still saved');
  assert.equal(rows[0].end, '10:30');
});

test('a mirror failure while closing a row still closes the daily row', async () => {
  const { store, root } = mirroringStore();
  const projects = path.join(root, 'AppLog', 'Projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'Work'), 'in the way', 'utf8');

  await store.appendRow('2026-08-27', open());
  const res = await store.updateOpenRow('2026-08-27', {
    end: '10:30', category: 'Work', project: 'LogIT', notes: ''
  });
  assert.equal(res.mirror.reason, MIRROR_REASON_WRITE_FAILED);
  assert.equal(store.findOpenRow('2026-08-27'), null);   // the row IS closed
});
