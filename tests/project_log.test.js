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
import { KIND_NORMAL } from '../src/shared/constants.js';

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
