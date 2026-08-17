// settings_derive.test.js
// Description: verifies the settings layer (snapping, colour stability, library
//              growth) and every derived-number rule from SPEC §9.
// Inputs:  none (scratch dirs under OS temp)
// Outputs: node:test results
// Created: 2026-08-17

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SettingsStore, snapInterval } from '../src/main/settings/settings_store.js';
import {
  durationMinutes, dayTotalHours, elapsedMinutes, wrappedSpanMinutes,
  formatElapsed, formatCountdown, formatClock, rollup,
  isValidHHMM, isValidDate
} from '../src/shared/derive.js';
import { COLOR_PALETTE } from '../src/shared/constants.js';

function scratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'logit-settings-'));
}

// ── settings ────────────────────────────────────────────────────────────────

test('interval snapping picks the nearest allowed value', () => {
  assert.equal(snapInterval(20), 20);
  assert.equal(snapInterval(5), 10);
  assert.equal(snapInterval(25), 20);   // tie 20/30 resolves to the smaller
  assert.equal(snapInterval(50), 45);
  assert.equal(snapInterval(999), 60);
});

test('illegal stored interval is snapped on load and re-saved', () => {
  const root = scratchRoot();
  fs.writeFileSync(path.join(root, 'settings.json'),
    JSON.stringify({ intervalMinutes: 17 }), 'utf8');
  const store = new SettingsStore(root);
  assert.equal(store.data.intervalMinutes, 15);
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'));
  assert.equal(onDisk.intervalMinutes, 15);
});

test('colour assignment is first-unused, persistent, and per-map', () => {
  const root = scratchRoot();
  const store = new SettingsStore(root);
  const c1 = store.colorFor('category', 'Work');
  const c2 = store.colorFor('category', 'School');
  assert.equal(c1, COLOR_PALETTE[0]);
  assert.equal(c2, COLOR_PALETTE[1]);
  assert.equal(store.colorFor('category', 'Work'), c1);        // stable
  assert.equal(store.colorFor('project', 'Work'), COLOR_PALETTE[0]);  // separate map
  const reloaded = new SettingsStore(root);
  assert.equal(reloaded.colorFor('category', 'Work'), c1);     // survives restart
});

test('colour assignment cycles after all 8 are taken', () => {
  const store = new SettingsStore(scratchRoot());
  for (let i = 0; i < COLOR_PALETTE.length; i++) store.colorFor('category', `c${i}`);
  const ninth = store.colorFor('category', 'c-extra');
  assert.ok(COLOR_PALETTE.includes(ninth));
});

test('library growth adds unseen names once; removal never touches colours', () => {
  const store = new SettingsStore(scratchRoot());
  assert.equal(store.addToLibrary('category', 'Thesis'), true);
  assert.equal(store.addToLibrary('category', 'Thesis'), false);   // duplicate no-op
  assert.equal(store.addToLibrary('category', '   '), false);      // blank no-op
  store.removeFromLibrary('category', 'Thesis');
  assert.equal(store.data.categories.includes('Thesis'), false);
});

// ── derived numbers (SPEC §9) ───────────────────────────────────────────────

test('duration: open rows and negative spans contribute zero', () => {
  assert.equal(durationMinutes({ start: '09:00', end: '10:30' }), 90);
  assert.equal(durationMinutes({ start: '14:02', end: '' }), 0);
  assert.equal(durationMinutes({ start: '23:45', end: '00:10' }), 0);  // never negative
});

test('day total sums durations in hours', () => {
  const rows = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '10:30' },
    { start: '14:02', end: '' }
  ];
  assert.equal(dayTotalHours(rows), 1.5);
});

test('elapsed wraps midnight (start later than now = started yesterday)', () => {
  assert.equal(elapsedMinutes('14:02', '14:25'), 23);
  assert.equal(elapsedMinutes('23:45', '00:10'), 25);
});

test('wrapped span targets next occurrence; equal times are invalid', () => {
  assert.equal(wrappedSpanMinutes('13:30', '15:30'), 120);
  assert.equal(wrappedSpanMinutes('23:30', '01:00'), 90);
  assert.equal(wrappedSpanMinutes('13:30', '13:30'), 0);
});

test('formatting rules', () => {
  assert.equal(formatElapsed(64), '1h 04m');
  assert.equal(formatElapsed(41), '41m');
  assert.equal(formatCountdown(286), 'in 4m 46s');
  assert.equal(formatCountdown(4000), 'in 1h 06m');
  assert.equal(formatCountdown(0), 'now');
  assert.equal(formatClock(3961), '01:06:01');
});

test('rollup keeps zero days, buckets by category, and totals focus', () => {
  const range = [
    { date: '2026-05-18', rows: [{ start: '09:00', end: '11:00', kind: 'normal', category: 'Work' }] },
    { date: '2026-05-19', rows: [] },
    {
      date: '2026-05-20', rows: [
        { start: '09:00', end: '10:00', kind: 'focus', category: 'Work' },
        { start: '13:00', end: '13:30', kind: 'inactive', category: 'Break / Inactive' },
        { start: '14:02', end: '', kind: 'normal', category: '' }
      ]
    }
  ];
  const r = rollup(range);
  assert.equal(r.days.length, 3);
  assert.equal(r.days[1].totalHours, 0);
  assert.equal(r.totalHours, 3.5);
  assert.equal(r.focusHours, 1);
  assert.equal(r.byCategory['Work'], 3);
  assert.equal(r.byCategory['Break / Inactive'], 0.5);   // legacy rows still count
});

test('validators', () => {
  assert.equal(isValidHHMM('23:59'), true);
  assert.equal(isValidHHMM('24:00'), false);
  assert.equal(isValidHHMM('9:00'), false);
  assert.equal(isValidDate('2026-02-29'), false);   // not a leap year
  assert.equal(isValidDate('2028-02-29'), true);
});
