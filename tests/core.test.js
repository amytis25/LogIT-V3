// core.test.js
// Description: exhaustive headless verification of the state machine against
//              the master event→effect table (FUNCTIONAL_SPEC §7), the timers
//              (§6), engagement semantics (§5.3), focus (§5.4), manual entry
//              (§5.5), and quit (§5.1). Everything runs on a fake clock; every
//              assertion about data reads the actual file, not the screen.
// Inputs:  none (scratch data roots)
// Outputs: node:test results
// Created: 2026-08-17

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Core } from '../src/main/core/core.js';
import { T_ENGAGEMENT, T_FOCUS_END, T_INTERVAL } from '../src/main/core/scheduler.js';
import { LogStore, LogWriteError } from '../src/main/log/log_store.js';
import { SettingsStore } from '../src/main/settings/settings_store.js';
import {
  CTX_EXIT_PROMPT, CTX_FOCUS_END, CTX_FOCUS_INTERRUPT, CTX_INTERVAL, CTX_OFF_CYCLE,
  STATE_ACTIVE_FOCUS, STATE_ACTIVE_NORMAL, STATE_INACTIVE, TIMED_OUT_NOTE
} from '../src/shared/constants.js';

// ── fake time: a deterministic clock + timer factory ────────────────────────
class FakeTime {
  constructor(startMs) {
    this.nowMs = startMs;
    this.timers = new Map();
    this.nextId = 1;
  }
  clock = () => this.nowMs;
  set = (fn, ms) => {
    const id = this.nextId++;
    this.timers.set(id, { fn, at: this.nowMs + ms });
    return id;
  };
  clear = (id) => { this.timers.delete(id); };
  // Advance wall time, firing due timers in order (including ones armed while
  // advancing) and awaiting async handlers.
  async advance(ms) {
    const target = this.nowMs + ms;
    for (;;) {
      let dueId = null;
      let dueAt = Infinity;
      for (const [id, t] of this.timers) {
        if (t.at <= target && t.at < dueAt) { dueAt = t.at; dueId = id; }
      }
      if (dueId === null) break;
      const t = this.timers.get(dueId);
      this.timers.delete(dueId);
      this.nowMs = t.at;
      await t.fn();
    }
    this.nowMs = target;
  }
}

// ── fake surface: records every UI effect ───────────────────────────────────
function fakeSurface() {
  const calls = [];
  return {
    calls,
    confirmAnswer: true,
    showCheckin: (ctx, prefill) => calls.push(['showCheckin', ctx, prefill]),
    showStartLogging: () => calls.push(['showStartLogging']),
    showFocus: (variant, prefill) => calls.push(['showFocus', variant, prefill]),
    closePopup: () => calls.push(['closePopup']),
    showShell: (pane) => calls.push(['showShell', pane]),
    toast: (text) => calls.push(['toast', text]),
    notifyError: (text) => calls.push(['notifyError', text]),
    refresh: () => {},
    confirmQuit() { calls.push(['confirmQuit']); return Promise.resolve(this.confirmAnswer); },
    last: (name) => calls.filter((c) => c[0] === name).at(-1)
  };
}

// ── harness ─────────────────────────────────────────────────────────────────
// Starts at 2026-05-20 (Wed) 14:00 local, default 20-minute interval.
function makeCore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logit-core-'));
  const time = new FakeTime(new Date(2026, 4, 20, 14, 0, 0).getTime());
  const log = new LogStore(root, () => Promise.resolve());
  const settings = new SettingsStore(root);
  const surface = fakeSurface();
  let quitCount = 0;
  const core = new Core({
    log, settings, clock: time.clock, timers: { set: time.set, clear: time.clear },
    surface, quitApp: () => { quitCount += 1; }
  });
  core.start();
  return { core, time, log, settings, surface, root, today: '2026-05-20', quits: () => quitCount };
}

const MIN = 60 * 1000;

// ── the logging cycle ───────────────────────────────────────────────────────

test('start logging writes an empty open row and arms the interval', async () => {
  const { core, log, today } = makeCore();
  const res = await core.startLogging();
  assert.equal(res.ok, true);
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  const rows = log.readDay(today);
  assert.deepEqual(rows, [{ start: '14:00', end: '', kind: 'normal', category: '', project: '', notes: '' }]);
  assert.ok(core.sched.isArmed(T_INTERVAL));
});

test('interval fire in ACTIVE_NORMAL shows the INTERVAL check-in', async () => {
  const { core, time, surface } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  assert.equal(core.popup.context, CTX_INTERVAL);
  assert.deepEqual(surface.last('showCheckin'), ['showCheckin', CTX_INTERVAL, undefined]);
  assert.equal(core.sched.isArmed(T_INTERVAL), false);   // stopped while popup up
});

test('submit closes the row with details and opens a new empty one', async () => {
  const { core, time, log, settings, surface, today } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  const res = await core.checkinSubmit({ category: 'Deep Work', project: 'Frontend', notes: 'built stuff' });
  assert.equal(res.ok, true);
  const rows = log.readDay(today);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    start: '14:00', end: '14:20', kind: 'normal',
    category: 'Deep Work', project: 'Frontend', notes: 'built stuff'
  });
  assert.deepEqual(rows[1], { start: '14:20', end: '', kind: 'normal', category: '', project: '', notes: '' });
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  assert.ok(settings.data.categories.includes('Deep Work'));   // library growth
  assert.ok(settings.data.projects.includes('Frontend'));
  assert.deepEqual(surface.last('toast'), ['toast', 'Logged: Deep Work - Frontend']);
  assert.ok(core.sched.isArmed(T_INTERVAL));   // restarts when dealt with
});

test('submit with a blank required field writes nothing', async () => {
  const { core, time, log, today } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  const res = await core.checkinSubmit({ category: '', project: 'X', notes: '' });
  assert.equal(res.invalid, true);
  assert.equal(log.readDay(today).length, 1);
  assert.notEqual(core.popup, null);   // popup stays open
});

test('skip deletes the open row entirely and goes INACTIVE', async () => {
  const { core, time, log, today } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  await core.checkinSkip();
  assert.equal(core.state, STATE_INACTIVE);
  assert.equal(log.readDay(today).length, 0);   // one fewer line — gone, not closed
});

test('dismiss writes nothing and leaves the open row untouched', async () => {
  const { core, time, log, today } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  core.checkinDismiss({ toShell: true });
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  const rows = log.readDay(today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].end, '');
  assert.ok(core.sched.isArmed(T_INTERVAL));
});

test('interval restarts from when the popup was dealt with, not when it appeared', async () => {
  const { core, time } = makeCore();
  await core.startLogging();                    // 14:00
  await time.advance(20 * MIN);                 // popup at 14:20
  await time.advance(55 * 1000);                // user stares at it for 55 s
  core.checkinDismiss();
  const deadline = core.sched.deadline(T_INTERVAL);
  assert.equal(deadline, time.clock() + 20 * MIN);
});

test('check-in timeout closes with the marker, opens a new row, and does NOT reset engagement', async () => {
  const { core, time, log, today } = makeCore();
  await core.startLogging();                                    // engagement reset at 14:00
  const engagementBefore = core.sched.deadline(T_ENGAGEMENT);
  await time.advance(20 * MIN);                                 // popup 14:20
  await time.advance(60 * 1000);                                // timeout 14:21
  const rows = log.readDay(today);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].end, '14:21');
  assert.equal(rows[0].notes, TIMED_OUT_NOTE);
  assert.equal(rows[0].category, '');
  assert.equal(rows[1].end, '');
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  assert.equal(core.popup, null);
  assert.equal(core.sched.deadline(T_ENGAGEMENT), engagementBefore);   // untouched
});

// ── start-logging popup (INACTIVE) ──────────────────────────────────────────

test('interval fire while INACTIVE shows the start-logging popup; skip stays INACTIVE', async () => {
  const { core, time, surface, log, today } = makeCore();
  await time.advance(20 * MIN);
  assert.equal(core.popup.kind, 'start');
  assert.deepEqual(surface.last('showStartLogging'), ['showStartLogging']);
  core.startPopupDismiss('skip');
  assert.equal(core.state, STATE_INACTIVE);
  assert.equal(log.readDay(today).length, 0);
  assert.ok(core.sched.isArmed(T_INTERVAL));
});

test('start popup timeout: as skip, but engagement is not reset', async () => {
  const { core, time } = makeCore();
  const engagementBefore = core.sched.deadline(T_ENGAGEMENT);
  await time.advance(20 * MIN);
  await time.advance(60 * 1000);
  assert.equal(core.popup, null);
  assert.equal(core.state, STATE_INACTIVE);
  assert.equal(core.sched.deadline(T_ENGAGEMENT), engagementBefore);
});

test('start logging from the start popup opens a row and closes the popup', async () => {
  const { core, time, log, today } = makeCore();
  await time.advance(20 * MIN);
  await core.startLogging();
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  assert.equal(core.popup, null);
  assert.equal(log.readDay(today)[0].start, '14:20');
});

// ── focus ───────────────────────────────────────────────────────────────────

test('focus A: begin writes a focus row, suspends interval + engagement, arms focus-end', async () => {
  const { core, log, today } = makeCore();
  core.openFocus();
  assert.equal(core.popup.variant, 'A');
  const res = await core.focusBegin({ start: '14:00', end: '15:30', wrap: null });
  assert.equal(res.ok, true);
  assert.equal(core.state, STATE_ACTIVE_FOCUS);
  const rows = log.readDay(today);
  assert.deepEqual(rows[0], { start: '14:00', end: '', kind: 'focus', category: '', project: '', notes: '' });
  assert.equal(core.sched.isArmed(T_INTERVAL), false);
  assert.equal(core.sched.isArmed(T_ENGAGEMENT), false);
  assert.equal(core.sched.deadline(T_FOCUS_END), new Date(2026, 4, 20, 15, 30).getTime());
});

test('focus validation: end equal to start and bad times are rejected', async () => {
  const { core } = makeCore();
  core.openFocus();
  let res = await core.focusBegin({ start: '14:00', end: '14:00', wrap: null });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('after start')));
  res = await core.focusBegin({ start: '14:00', end: '25:99', wrap: null });
  assert.equal(res.ok, false);
  assert.equal(core.state, STATE_INACTIVE);   // nothing armed, nothing written
});

test('focus end time crossing midnight targets the next occurrence', async () => {
  const { core } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '01:00', wrap: null });   // 01:00 tomorrow
  assert.equal(core.sched.deadline(T_FOCUS_END), new Date(2026, 4, 21, 1, 0).getTime());
});

test('focus B: closes the open block with required details, then opens the focus row', async () => {
  const { core, log, today } = makeCore();
  await core.startLogging();
  core.openFocus();
  assert.equal(core.popup.variant, 'B');
  const bad = await core.focusBegin({ start: '14:00', end: '15:00', wrap: { category: '', project: '', notes: '' } });
  assert.equal(bad.ok, false);
  const res = await core.focusBegin({
    start: '14:00', end: '15:00',
    wrap: { category: 'Work', project: 'Thesis', notes: 'wrapped' }
  });
  assert.equal(res.ok, true);
  const rows = log.readDay(today);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, 'Work');
  assert.equal(rows[0].end, '14:00');
  assert.equal(rows[1].kind, 'focus');
  assert.equal(rows[1].end, '');
});

test('focus end fires the FOCUS_END check-in; submit keeps kind=focus and opens a normal row', async () => {
  const { core, time, log, today } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(60 * MIN);
  assert.equal(core.popup.context, CTX_FOCUS_END);
  await core.checkinSubmit({ category: 'Work', project: 'Thesis', notes: 'deep session' });
  const rows = log.readDay(today);
  assert.equal(rows[0].kind, 'focus');           // kind never modified
  assert.equal(rows[0].end, '15:00');
  assert.equal(rows[1].kind, 'normal');
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  assert.ok(core.sched.isArmed(T_ENGAGEMENT));   // resumes fresh
  assert.ok(core.sched.isArmed(T_INTERVAL));
});

test('FOCUS_END cannot be dismissed or skipped', async () => {
  const { core, time } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(60 * MIN);
  core.checkinDismiss();
  assert.equal(core.popup?.context, CTX_FOCUS_END);   // still there
  const res = await core.checkinSkip();
  assert.equal(res.ok, false);
});

test('FOCUS_END timeout closes with marker, opens NO new row, goes INACTIVE', async () => {
  const { core, time, log, today } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(60 * MIN);
  await time.advance(60 * 1000);
  const rows = log.readDay(today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'focus');
  assert.equal(rows[0].notes, TIMED_OUT_NOTE);
  assert.equal(core.state, STATE_INACTIVE);
  assert.ok(core.sched.isArmed(T_ENGAGEMENT));
});

test('shortcut during focus interrupts; dismissal leaves the session running', async () => {
  const { core, time } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(10 * MIN);
  core.shortcutActivate();
  assert.equal(core.popup.context, CTX_FOCUS_INTERRUPT);
  core.checkinDismiss();
  assert.equal(core.popup, null);
  assert.equal(core.state, STATE_ACTIVE_FOCUS);
  assert.ok(core.sched.isArmed(T_FOCUS_END));          // still running
  assert.equal(core.sched.isArmed(T_ENGAGEMENT), false);   // still suspended
});

test('interrupt submit ends focus early and starts normal logging', async () => {
  const { core, time, log, today } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(10 * MIN);
  core.shortcutActivate();
  await core.checkinSubmit({ category: 'Work', project: 'Thesis', notes: '' });
  const rows = log.readDay(today);
  assert.equal(rows[0].end, '14:10');
  assert.equal(rows[0].kind, 'focus');
  assert.equal(rows[1].kind, 'normal');
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
  assert.equal(core.sched.isArmed(T_FOCUS_END), false);
});

test('focus end passing while the interrupt popup is open defers, then fires on dismissal', async () => {
  const { core, time } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:00', wrap: null });
  await time.advance(59.5 * MIN);
  core.shortcutActivate();                       // interrupt popup at 14:59:30
  assert.equal(core.popup.context, CTX_FOCUS_INTERRUPT);
  await time.advance(35 * 1000);                 // end time passes underneath — no stack
  assert.equal(core.popup.context, CTX_FOCUS_INTERRUPT);
  core.checkinDismiss();                         // "session continues"… but it's over
  assert.equal(core.popup.context, CTX_FOCUS_END);
});

// ── engagement (the dead-man's switch) ──────────────────────────────────────

test('an hour of popup timeouts does not postpone engagement; the open row is discarded', async () => {
  const { core, time, log, today } = makeCore();
  await core.startLogging();   // 14:00, engagement deadline 15:00
  // Three full cycles of ignored popups: fire at +20m, timeout at +21m, …
  await time.advance(59 * MIN);
  assert.equal(core.state, STATE_ACTIVE_NORMAL);   // still cycling on timeouts
  await time.advance(2 * MIN);                     // engagement fires at 15:00
  assert.equal(core.state, STATE_INACTIVE);
  assert.equal(core.paused, true);
  assert.equal(core.sched.isArmed(T_INTERVAL), false);   // popups stop
  const rows = log.readDay(today);
  assert.equal(rows.filter((r) => r.end === '').length, 0);   // no open row survives
  // The timed-out closed rows written during the hour remain — history intact.
  assert.ok(rows.every((r) => r.notes === TIMED_OUT_NOTE));
});

test('any user action resumes from PAUSED and resets engagement', async () => {
  const { core, time } = makeCore();
  await core.startLogging();
  await time.advance(61 * MIN);
  assert.equal(core.paused, true);
  core.userAction();
  assert.equal(core.paused, false);
  assert.ok(core.sched.isArmed(T_INTERVAL));
  assert.ok(core.sched.isArmed(T_ENGAGEMENT));
});

test('an hour of focus does not trigger engagement', async () => {
  const { core, time } = makeCore();
  core.openFocus();
  await core.focusBegin({ start: '14:00', end: '15:30', wrap: null });
  await time.advance(85 * MIN);   // 85 min in, no engagement fire
  assert.equal(core.state, STATE_ACTIVE_FOCUS);
  assert.equal(core.paused, false);
});

// ── manual entry ────────────────────────────────────────────────────────────

test('manual save lands in the chosen date file with kind=manual, state untouched', async () => {
  const { core, log } = makeCore();
  await core.startLogging();
  const res = await core.manualSave({
    date: '2026-05-18', start: '09:00', end: '10:30',
    category: 'School', project: 'Lab', notes: 'back-filled'
  });
  assert.equal(res.ok, true);
  const rows = log.readDay('2026-05-18');
  assert.deepEqual(rows[0], {
    start: '09:00', end: '10:30', kind: 'manual',
    category: 'School', project: 'Lab', notes: 'back-filled'
  });
  assert.equal(core.state, STATE_ACTIVE_NORMAL);   // open row untouched
  assert.equal(log.readDay('2026-05-20').length, 1);
});

test('manual validation lists every problem at once and writes nothing', async () => {
  const { core, log } = makeCore();
  const res = await core.manualSave({
    date: 'nope', start: '10:00', end: '09:00', category: '', project: '', notes: ''
  });
  assert.equal(res.ok, false);
  assert.equal(res.errors.length, 3);   // bad date, end before start, no category
  assert.equal(log.readDay('2026-05-20').length, 0);
});

// ── quit (SPEC §5.1) ────────────────────────────────────────────────────────

test('quit with an open row shows EXIT_PROMPT; submit closes it and exits', async () => {
  const { core, log, today, quits } = makeCore();
  await core.startLogging();
  await core.quitRequest();
  assert.equal(core.popup.context, CTX_EXIT_PROMPT);
  await core.checkinSubmit({ category: 'Work', project: 'Wrap', notes: 'done' });
  assert.equal(quits(), 1);
  const rows = log.readDay(today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, 'Work');
  assert.equal(rows[0].end, '14:00');
});

test('exit-prompt skip deletes the row and exits; dismiss cancels the quit', async () => {
  const { core, log, today, quits, surface } = makeCore();
  await core.startLogging();
  await core.quitRequest();
  core.checkinDismiss();
  assert.equal(quits(), 0);
  assert.deepEqual(surface.last('showShell'), ['showShell', 'dashboard']);
  assert.equal(log.readDay(today).length, 1);   // untouched
  await core.quitRequest();
  await core.checkinSkip();
  assert.equal(quits(), 1);
  assert.equal(log.readDay(today).length, 0);
});

test('exit-prompt timeout closes with the marker and exits', async () => {
  const { core, time, log, today, quits } = makeCore();
  await core.startLogging();
  await core.quitRequest();
  await time.advance(60 * 1000);
  assert.equal(quits(), 1);
  assert.equal(log.readDay(today)[0].notes, TIMED_OUT_NOTE);
});

test('quit with no open row asks for confirmation', async () => {
  const { core, surface, quits } = makeCore();
  surface.confirmAnswer = false;
  await core.quitRequest();
  assert.equal(quits(), 0);
  surface.confirmAnswer = true;
  await core.quitRequest();
  assert.equal(quits(), 1);
});

// ── never stack + failure paths ─────────────────────────────────────────────

test('popups never stack: triggers while one is open are no-ops', async () => {
  const { core, time } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  const before = core.popup;
  core.shortcutActivate();
  core.logActivity();
  core.openFocus();
  assert.equal(core.popup, before);
  assert.equal(core.popup.context, CTX_INTERVAL);
});

test('a failed save keeps the popup open, counts attempts, and echoes at attempt 3', async () => {
  const { core, time, log } = makeCore();
  await core.startLogging();
  await time.advance(20 * MIN);
  const realUpdate = log.updateOpenRow.bind(log);
  log.updateOpenRow = () => { throw new LogWriteError(new Error('locked')); };
  for (let i = 1; i <= 3; i++) {
    const res = await core.checkinSubmit({ category: 'Work', project: 'X', notes: 'precious text' });
    assert.equal(res.ok, false);
    assert.equal(res.saveError.attempt, i);
    assert.equal(res.saveError.final, i === 3);
    assert.equal(res.saveError.echo.notes, 'precious text');
    assert.notEqual(core.popup, null);   // never closes, never loses text
  }
  log.updateOpenRow = realUpdate;
  const res = await core.checkinSubmit({ category: 'Work', project: 'X', notes: 'precious text' });
  assert.equal(res.ok, true);   // each further press is another attempt
});

test('interval change re-arms from now with the new period', async () => {
  const { core, time } = makeCore();
  await core.startLogging();
  await time.advance(5 * MIN);
  core.intervalChange(45);
  assert.equal(core.sched.deadline(T_INTERVAL), time.clock() + 45 * MIN);
  assert.equal(core.settings.data.intervalMinutes, 45);
});
