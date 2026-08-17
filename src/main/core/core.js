// core.js
// Description: the one state machine (FUNCTIONAL_SPEC §4–§7). Three states, no
//              flag soup; five check-in contexts; the four timers; the
//              engagement dead-man's switch. Owns every log operation's
//              sequencing. Knows nothing about pixels: all UI effects go
//              through an injected `surface` port, and time comes from an
//              injected clock + timer factory, so the whole thing runs headless
//              under test.
// Inputs:  { log: LogStore, settings: SettingsStore, clock: () => epoch ms,
//            timers: { set, clear }, surface, quitApp: () => void }
//          surface = { showCheckin(ctx, prefill), showStartLogging(),
//                      showFocus(page, prefill), closePopup(), showShell(pane?),
//                      toast(text), notifyError(text), confirmQuit() → Promise,
//                      refresh() }
// Outputs: log/settings mutations, surface calls, state snapshots
// Created: 2026-08-17

import {
  CTX_EXIT_PROMPT, CTX_FOCUS_END, CTX_FOCUS_INTERRUPT, CTX_INTERVAL, CTX_OFF_CYCLE,
  ENGAGEMENT_TIMEOUT_MS, KIND_FOCUS, KIND_MANUAL, KIND_NORMAL,
  STATE_ACTIVE_FOCUS, STATE_ACTIVE_NORMAL, STATE_INACTIVE,
  SUBMIT_MAX_ATTEMPTS, TIMED_OUT_NOTE
} from '../../shared/constants.js';
import {
  elapsedMinutes, hhmmToMinutes, isValidDate, isValidHHMM, wrappedSpanMinutes
} from '../../shared/derive.js';
import { LogStore, probeRootWritable, toDateStr } from '../log/log_store.js';
import { Scheduler, T_ENGAGEMENT, T_FOCUS_END, T_INTERVAL, T_POPUP } from './scheduler.js';

export class Core {
  // Description: wire the core to its injected dependencies. Call start() after.
  // Inputs:  deps — see file header
  // Outputs: none
  constructor({ log, settings, clock, timers, surface, quitApp }) {
    this.log = log;
    this.settings = settings;
    this.clock = clock;
    this.surface = surface;
    this.quitApp = quitApp;
    this.sched = new Scheduler(timers, clock);

    this.state = STATE_INACTIVE;
    this.paused = false;            // INACTIVE with scheduling stopped (engagement fired)
    this.openRowDate = null;        // date whose file holds the open row we wrote
    this.focus = null;              // { start, end } while ACTIVE_FOCUS
    this.popup = null;              // { kind:'checkin'|'start'|'focus', context?, variant?, prefill?, attempts }
  }

  // ── time helpers ──────────────────────────────────────────────────────────

  // Description: current local wall clock pieces from the injected clock.
  // Inputs: none  Outputs: { hhmm, dateStr, date }
  nowParts() {
    const d = new Date(this.clock());
    const p = (n) => String(n).padStart(2, '0');
    return { hhmm: `${p(d.getHours())}:${p(d.getMinutes())}`, dateStr: toDateStr(d), date: d };
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  // Description: launch per SPEC §5.1 — always INACTIVE; an open row left by a
  //              previous run is left exactly as it is (never adopted).
  // Inputs: none  Outputs: none
  start() {
    // Interval timer: trigger = period elapsed while INACTIVE or ACTIVE_NORMAL;
    // reset = popup dealt with, state entry, or interval change (SPEC §6).
    this.armIntervalIfEligible();
    // Engagement timer: trigger = 1 h without user action; reset = any user
    // action; suspended during focus; popup timeouts NEVER reset it (SPEC §5.3).
    this.armEngagement();
    this.surface.refresh();
  }

  // ── timer arming (each names its trigger + reset conditions above) ────────

  // Description: arm the interval timer when the state calls for it: INACTIVE
  //              (not paused) or ACTIVE_NORMAL, and no popup on screen.
  // Inputs: none  Outputs: none
  armIntervalIfEligible() {
    const eligible = this.popup === null && !this.paused &&
      (this.state === STATE_INACTIVE || this.state === STATE_ACTIVE_NORMAL);
    if (eligible) {
      this.sched.arm(T_INTERVAL, this.settings.data.intervalMinutes * 60 * 1000,
        () => this.onIntervalFired());
    } else {
      this.sched.clear(T_INTERVAL);
    }
  }

  // Description: (re)arm the engagement timer unless suspended (focus) / paused.
  // Inputs: none  Outputs: none
  armEngagement() {
    // Arming marks "someone was here now" — shown by the paused pill later.
    this.lastActivityHHMM = this.nowParts().hhmm;
    if (this.state === STATE_ACTIVE_FOCUS || this.paused) {
      this.sched.clear(T_ENGAGEMENT);
      return;
    }
    this.sched.arm(T_ENGAGEMENT, ENGAGEMENT_TIMEOUT_MS, () => this.onEngagementFired());
  }

  // Description: arm the focus-end timer for the next occurrence of endHHMM.
  //              Delay is always > 0 — validation rejects zero-length sessions.
  // Inputs:  endHHMM
  // Outputs: none
  armFocusEnd(endHHMM) {
    const { date } = this.nowParts();
    const target = new Date(date);
    target.setHours(Number(endHHMM.slice(0, 2)), Number(endHHMM.slice(3, 5)), 0, 0);
    let delay = target.getTime() - date.getTime();
    if (delay <= 0) delay += 24 * 60 * 60 * 1000;   // SPEC §11: next occurrence
    this.sched.arm(T_FOCUS_END, delay, () => this.onFocusEndFired());
  }

  // ── popup lifecycle ───────────────────────────────────────────────────────

  // Description: open a popup if none is open (popups never stack — CLAUDE §4.6).
  //              Opening stops the interval timer and starts the popup countdown
  //              (except surfaces with no defined timeout path).
  // Inputs:  descriptor — { kind, context?, variant?, prefill? }
  //          withCountdown — arm the 60 s timeout
  // Outputs: true if opened
  openPopup(descriptor, withCountdown) {
    if (this.popup !== null) return false;
    this.popup = { attempts: 0, ...descriptor };
    this.sched.clear(T_INTERVAL);
    if (withCountdown) {
      // Popup countdown: trigger = timeout elapsed; reset/cancel = any button
      // press in the popup (cleared in every action handler and in teardown).
      this.sched.arm(T_POPUP, this.settings.data.popupTimeoutSec * 1000,
        () => this.onPopupTimeout());
    }
    if (descriptor.kind === 'checkin') this.surface.showCheckin(descriptor.context, descriptor.prefill);
    else if (descriptor.kind === 'start') this.surface.showStartLogging();
    else this.surface.showFocus(descriptor.variant, descriptor.prefill);
    this.surface.refresh();
    return true;
  }

  // Description: tear a popup down. The countdown is stopped HERE, not only in
  //              button handlers — dismissal has several routes (GOTCHAS).
  // Inputs:  opts — { restartInterval (default true) }
  // Outputs: none
  closePopup(opts = {}) {
    const restartInterval = opts.restartInterval !== false;
    this.sched.clear(T_POPUP);
    this.popup = null;
    this.surface.closePopup();
    if (restartInterval) this.armIntervalIfEligible();
    this.surface.refresh();
  }

  // Description: swap one popup for another without the never-stack guard
  //              blocking (explicit user navigation between popups).
  // Inputs:  descriptor, withCountdown
  // Outputs: none
  replacePopup(descriptor, withCountdown) {
    this.sched.clear(T_POPUP);
    this.popup = null;
    this.openPopup(descriptor, withCountdown);
  }

  // ── log write helpers ─────────────────────────────────────────────────────

  // Description: append a fresh open row for "now" and record where it lives.
  // Inputs:  kind; startHHMM — optional explicit start (focus form)
  // Outputs: Promise<void> (throws LogWriteError upward)
  async writeOpenRow(kind, startHHMM = null) {
    const { hhmm, dateStr } = this.nowParts();
    await this.log.appendRow(dateStr, {
      start: startHHMM ?? hhmm, end: '', kind, category: '', project: '', notes: ''
    });
    this.openRowDate = dateStr;
  }

  // Description: close the open row in the file where it lives (which may be
  //              yesterday's, for a block spanning midnight — GOTCHAS).
  // Inputs:  patch — { category?, project?, notes? }; end = now
  // Outputs: Promise<void>
  async closeOpenRow(patch = {}) {
    const { hhmm } = this.nowParts();
    await this.log.updateOpenRow(this.openRowDate, { end: hhmm, ...patch });
    this.openRowDate = null;
  }

  // Description: delete the open row — the app's only destructive operation.
  // Inputs: none  Outputs: Promise<void>
  async deleteOpenRow() {
    if (this.openRowDate === null) return;
    await this.log.deleteOpenRow(this.openRowDate);
    this.openRowDate = null;
  }

  // ── user events: dashboard + start popup ──────────────────────────────────

  // Description: "Start logging" (dashboard or start popup) — SPEC §7.
  // Inputs: none
  // Outputs: { ok, error? }
  async startLogging() {
    if (this.state !== STATE_INACTIVE) return { ok: true };
    try {
      await this.writeOpenRow(KIND_NORMAL);
    } catch {
      return { ok: false, error: 'Couldn’t start logging — the log file may be locked. Nothing was written.' };
    }
    this.state = STATE_ACTIVE_NORMAL;
    this.paused = false;
    if (this.popup !== null) this.closePopup();
    else this.armIntervalIfEligible();
    this.armEngagement();
    // The session has started: the dashboard recedes; the shortcut and the
    // popups carry the day (SPEC §8.1, user decision 2026-08-17).
    this.surface.hideShell();
    this.surface.refresh();
    return { ok: true };
  }

  // Description: "Log activity" (dashboard, ACTIVE_NORMAL) → OFF_CYCLE check-in.
  // Inputs: none  Outputs: none
  logActivity() {
    if (this.state !== STATE_ACTIVE_NORMAL) return;
    this.userAction();
    this.openPopup({ kind: 'checkin', context: CTX_OFF_CYCLE }, true);
  }

  // Description: "Focus mode" pressed anywhere — variant by open row (SPEC §5.4);
  //              during a live session it shows the live page instead.
  // Inputs:  prefill — typed values carried from a check-in, or null
  // Outputs: none
  openFocus(prefill = null) {
    this.userAction();
    const fromStartPopup = this.popup !== null && this.popup.kind === 'start';
    if (this.popup !== null && !fromStartPopup) {
      if (this.popup.kind !== 'focus') return;   // never stack; check-ins use checkinSwitchFocus
    }
    if (this.state === STATE_ACTIVE_FOCUS) {
      if (fromStartPopup) return;
      this.openPopup({ kind: 'focus', variant: 'live' }, false);
      return;
    }
    const variant = this.state === STATE_ACTIVE_NORMAL ? 'B' : 'A';
    const descriptor = { kind: 'focus', variant, prefill };
    if (fromStartPopup) this.replacePopup(descriptor, false);   // SPEC §7: start popup "Focus mode"
    else this.openPopup(descriptor, false);
  }

  // ── start popup actions ───────────────────────────────────────────────────

  // Description: start popup "View dashboard" / "Skip" (SPEC §7 table).
  // Inputs:  action — 'view' | 'skip'
  // Outputs: none
  startPopupDismiss(action) {
    if (this.popup === null || this.popup.kind !== 'start') return;
    this.armEngagement();   // explicit button press = engagement (SPEC §5.3)
    this.closePopup();
    if (action === 'view') this.surface.showShell('dashboard');
  }

  // ── check-in actions ──────────────────────────────────────────────────────

  // Description: check-in Submit for all five contexts (SPEC §7). Validation
  //              first; then the context's log ops; save failures keep the
  //              popup open with the attempt count (SPEC §10).
  // Inputs:  details — { category, project, notes }; opts — { andView }
  // Outputs: { ok, invalid?, saveError? }
  async checkinSubmit(details, opts = {}) {
    if (this.popup === null || this.popup.kind !== 'checkin') return { ok: false };
    const context = this.popup.context;
    const category = String(details.category ?? '').trim();
    const project = String(details.project ?? '').trim();
    const notes = String(details.notes ?? '');

    // A submit press is engagement, and it cancels the countdown even if the
    // save fails — the user is demonstrably present.
    this.sched.clear(T_POPUP);
    this.armEngagement();

    if (category === '' || project === '') {
      this.surface.refresh();
      return { ok: false, invalid: true };
    }

    // Close the block being described.
    try {
      await this.closeOpenRow({ category, project, notes });
    } catch {
      this.popup.attempts += 1;
      this.surface.refresh();
      return {
        ok: false,
        saveError: {
          attempt: this.popup.attempts,
          final: this.popup.attempts >= SUBMIT_MAX_ATTEMPTS,
          echo: { category, project, notes }
        }
      };
    }

    this.settings.addToLibrary('category', category);
    this.settings.addToLibrary('project', project);

    if (context === CTX_EXIT_PROMPT) {
      this.quitApp();
      return { ok: true };
    }

    if (context === CTX_FOCUS_INTERRUPT || context === CTX_FOCUS_END) {
      this.sched.clear(T_FOCUS_END);
      this.focus = null;
    }

    // SPEC §7: every non-exit Submit opens a new empty normal row.
    let openedNewRow = true;
    try {
      await this.writeOpenRow(KIND_NORMAL);
    } catch {
      openedNewRow = false;
    }
    this.state = openedNewRow ? STATE_ACTIVE_NORMAL : STATE_INACTIVE;
    this.armEngagement();
    this.closePopup();
    if (!openedNewRow) {
      // The entry WAS saved; only the auto-opened follow-up failed. Say so
      // plainly rather than pretending (CLAUDE §4.4) or losing the save.
      this.surface.showShell('dashboard');
      this.surface.notifyError(
        'Your entry was saved, but a new block couldn’t be opened — the log file may be locked. Press Start logging when it’s free.');
    } else {
      this.surface.toast(`Logged: ${category} - ${project}`);
      if (opts.andView) this.surface.showShell('dashboard');
    }
    this.surface.refresh();
    return { ok: true };
  }

  // Description: check-in Skip — deletes the open row (INTERVAL / OFF_CYCLE),
  //              or deletes-and-exits (EXIT_PROMPT). Hidden elsewhere.
  // Inputs: none  Outputs: { ok, error? }
  async checkinSkip() {
    if (this.popup === null || this.popup.kind !== 'checkin') return { ok: false };
    const context = this.popup.context;
    if (context !== CTX_INTERVAL && context !== CTX_OFF_CYCLE && context !== CTX_EXIT_PROMPT) {
      return { ok: false };   // Skip is hidden in focus contexts (SPEC §4)
    }
    this.sched.clear(T_POPUP);
    this.armEngagement();
    try {
      await this.deleteOpenRow();
    } catch {
      this.popup.attempts += 1;
      this.surface.refresh();
      return { ok: false, saveError: { attempt: this.popup.attempts, final: this.popup.attempts >= SUBMIT_MAX_ATTEMPTS, echo: null } };
    }
    if (context === CTX_EXIT_PROMPT) {
      this.quitApp();
      return { ok: true };
    }
    this.state = STATE_INACTIVE;
    this.closePopup();
    this.surface.refresh();
    return { ok: true };
  }

  // Description: check-in dismissal (View dashboard / Esc / close) — writes
  //              nothing. FOCUS_END cannot be dismissed; FOCUS_INTERRUPT leaves
  //              the session running; EXIT_PROMPT cancels the quit (SPEC §7).
  // Inputs:  opts — { toShell } show the shell after closing
  // Outputs: none
  checkinDismiss(opts = {}) {
    if (this.popup === null || this.popup.kind !== 'checkin') return;
    const context = this.popup.context;
    if (context === CTX_FOCUS_END) return;   // must be acted on
    this.armEngagement();
    if (context === CTX_FOCUS_INTERRUPT) {
      // Engagement stays suspended during focus.
      this.sched.clear(T_ENGAGEMENT);
      this.closePopup({ restartInterval: false });
      // If the session's end time passed while the interrupt popup was up, the
      // deferred FOCUS_END fires now (never-stack made the timer fire a no-op).
      if (this.focus !== null && !this.sched.isArmed(T_FOCUS_END)) {
        this.openPopup({ kind: 'checkin', context: CTX_FOCUS_END }, true);
        return;
      }
      if (opts.toShell) this.surface.showShell('dashboard');
      return;
    }
    this.closePopup();
    if (opts.toShell || context === CTX_EXIT_PROMPT) this.surface.showShell('dashboard');
  }

  // Description: "Switch to focus mode" inside a check-in — carries the typed
  //              values into focus popup variant B (SPEC §8.3).
  // Inputs:  typed — { category, project, notes }
  // Outputs: none
  checkinSwitchFocus(typed) {
    if (this.popup === null || this.popup.kind !== 'checkin') return;
    const context = this.popup.context;
    if (context !== CTX_INTERVAL && context !== CTX_OFF_CYCLE) return;
    this.armEngagement();
    this.replacePopup({ kind: 'focus', variant: 'B', prefill: typed }, false);
  }

  // ── focus popup actions ───────────────────────────────────────────────────

  // Description: "Begin focus" (SPEC §5.4). Variant B closes the open block
  //              first (its details are required); then the focus row opens.
  //              A failed focus-row write must not pretend a session is running
  //              (SPEC §10) — the app falls back to INACTIVE.
  // Inputs:  form — { start, end, wrap: { category, project, notes } | null }
  // Outputs: { ok, errors? }
  async focusBegin(form) {
    if (this.popup === null || this.popup.kind !== 'focus') return { ok: false };
    const errors = [];
    const start = String(form.start ?? '').trim();
    const end = String(form.end ?? '').trim();
    if (!isValidHHMM(start)) errors.push('Start must be a valid HH:MM time.');
    if (!isValidHHMM(end)) errors.push('End is required as HH:MM.');
    if (errors.length === 0 && wrappedSpanMinutes(start, end) === 0) {
      errors.push('End must be after start.');
    }
    const variantB = this.popup.variant === 'B';
    let wrap = null;
    if (variantB) {
      wrap = {
        category: String(form.wrap?.category ?? '').trim(),
        project: String(form.wrap?.project ?? '').trim(),
        notes: String(form.wrap?.notes ?? '')
      };
      if (wrap.category === '' || wrap.project === '') {
        errors.push('Category and project are required to wrap up the current block.');
      }
    }
    this.armEngagement();
    if (errors.length > 0) { this.surface.refresh(); return { ok: false, errors }; }

    if (variantB) {
      try {
        await this.closeOpenRow(wrap);
      } catch {
        return { ok: false, errors: ['Save failed — the log file may be locked. Close any app that has it open, then try again.'] };
      }
      this.settings.addToLibrary('category', wrap.category);
      this.settings.addToLibrary('project', wrap.project);
    }

    try {
      await this.writeOpenRow(KIND_FOCUS, start);
    } catch {
      // Variant B already closed the previous block: be honest about where we
      // are (INACTIVE), keep the popup open, and report.
      this.state = STATE_INACTIVE;
      this.surface.refresh();
      return { ok: false, errors: ['The focus session could not be saved — nothing is running. The log file may be locked.'] };
    }

    this.state = STATE_ACTIVE_FOCUS;
    this.focus = { start, end };
    this.sched.clear(T_INTERVAL);
    this.armFocusEnd(end);
    this.sched.clear(T_ENGAGEMENT);   // suspended during focus (SPEC §5.3)
    if (variantB) this.surface.toast(`Logged: ${wrap.category} - ${wrap.project}`);
    this.closePopup({ restartInterval: false });
    this.surface.hideShell();   // session started — dashboard recedes
    return { ok: true };
  }

  // Description: focus popup "Check in regularly" — variant A starts a normal
  //              block; variant B swaps to a check-in with typed values carried.
  // Inputs:  typed — { category, project, notes } | null
  // Outputs: { ok, error? }
  async focusCheckinRegularly(typed = null) {
    if (this.popup === null || this.popup.kind !== 'focus') return { ok: false };
    this.armEngagement();
    if (this.popup.variant === 'A') {
      return this.startLogging();
    }
    this.replacePopup({ kind: 'checkin', context: CTX_INTERVAL, prefill: typed }, true);
    return { ok: true };
  }

  // Description: focus popup dismissed — nothing happens, prior state holds.
  //              Closing the live page does NOT end the session (SPEC §8.4).
  // Inputs: none  Outputs: none
  focusDismiss() {
    if (this.popup === null || this.popup.kind !== 'focus') return;
    if (this.state !== STATE_ACTIVE_FOCUS) this.armEngagement();
    this.closePopup({ restartInterval: this.state !== STATE_ACTIVE_FOCUS });
  }

  // Description: "End session" / "End focus early" — ends via the interrupt
  //              path: opens the FOCUS_INTERRUPT check-in for details (SPEC §8.4).
  // Inputs: none  Outputs: none
  focusEndEarly() {
    if (this.state !== STATE_ACTIVE_FOCUS) return;
    this.replacePopup({ kind: 'checkin', context: CTX_FOCUS_INTERRUPT }, true);
  }

  // Description: a popup's native close route (Alt+F4, system menu) — behaves
  //              as that popup's dismissal. FOCUS_END stays put (not dismissable).
  // Inputs: none  Outputs: none
  popupNativeDismiss() {
    if (this.popup === null) return;
    if (this.popup.kind === 'checkin') this.checkinDismiss();
    else if (this.popup.kind === 'start') this.startPopupDismiss('skip');
    else this.focusDismiss();
  }

  // ── manual entry ──────────────────────────────────────────────────────────

  // Description: validate everything at once and append a `manual` row to the
  //              chosen date. Never touches the open row or the state (SPEC §5.5).
  // Inputs:  form — { date, start, end, category, project, notes }
  // Outputs: { ok, errors? }
  async manualSave(form) {
    const errors = [];
    const date = String(form.date ?? '').trim();
    const start = String(form.start ?? '').trim();
    const end = String(form.end ?? '').trim();
    const category = String(form.category ?? '').trim();
    const project = String(form.project ?? '').trim();
    const notes = String(form.notes ?? '');
    if (!isValidDate(date)) errors.push('Date must be a real date (YYYY-MM-DD).');
    if (!isValidHHMM(start)) errors.push('Start must be a valid HH:MM time.');
    if (!isValidHHMM(end)) errors.push('End must be a valid HH:MM time.');
    if (isValidHHMM(start) && isValidHHMM(end) &&
      hhmmToMinutes(end) <= hhmmToMinutes(start)) {
      errors.push('End must be strictly after start.');
    }
    if (category === '') errors.push('Category is required.');
    this.userAction();
    if (errors.length > 0) return { ok: false, errors };

    this.settings.addToLibrary('category', category);
    if (project !== '') this.settings.addToLibrary('project', project);
    try {
      await this.log.appendRow(date, {
        start, end, kind: KIND_MANUAL, category, project, notes
      });
    } catch {
      return { ok: false, errors: ['Save failed — the log file for that date may be locked. Nothing was written.'] };
    }
    this.surface.toast(`Logged: ${category}${project ? ' - ' + project : ''}`);
    this.surface.refresh();
    return { ok: true };
  }

  // ── settings + misc user actions ──────────────────────────────────────────

  // Description: interval chip changed — save immediately; re-arm from now with
  //              the new period if the timer is running (SPEC §11).
  // Inputs:  minutes
  // Outputs: the stored value
  intervalChange(minutes) {
    const stored = this.settings.setInterval(minutes);
    if (this.sched.isArmed(T_INTERVAL)) this.armIntervalIfEligible();
    this.userAction();
    return stored;
  }

  // Description: move where logs are stored. Existing history is deliberately
  //              NOT moved — the app never touches the user's old files (§4.5);
  //              it simply reads and writes the new folder from now on. An open
  //              block is the one exception: its row is carried across so it
  //              stays closable, preserving "at most one open row" (§4.2).
  //              Refused up front if the folder can't be written to.
  // Inputs:  newRoot — absolute directory path
  // Outputs: { ok, error?, unchanged? }
  async changeLogRoot(newRoot) {
    const chosen = String(newRoot ?? '').trim();
    if (chosen === '') return { ok: false, error: 'No folder was chosen.' };
    if (chosen === this.log.root) return { ok: true, unchanged: true };
    if (!probeRootWritable(chosen)) {
      return { ok: false, error: 'That folder can’t be written to. Pick another, or check its permissions.' };
    }

    const oldRoot = this.log.root;
    // Capture the open block (if any) BEFORE the store forgets where it lives.
    const carryDate = this.openRowDate;
    const carryRow = carryDate === null ? null : this.log.findOpenRow(carryDate)?.row ?? null;

    this.log.setRoot(chosen);
    if (carryRow !== null) {
      try {
        await this.log.appendRow(carryDate, carryRow);
      } catch {
        this.log.setRoot(oldRoot);   // nothing was moved; stay exactly as we were
        return { ok: false, error: 'The open block couldn’t be written to that folder. Nothing was changed.' };
      }
      try {
        await new LogStore(oldRoot).deleteOpenRow(carryDate);
      } catch {
        // The block is safe in the new folder; the old file kept a stray open
        // row the app will never touch again. Say so rather than hide it.
        this.surface.notifyError(
          `Logs now save to ${chosen}, but the old folder kept an unfinished row — delete that last line by hand if you want it gone.`);
      }
    }

    this.settings.setLogRoot(chosen);
    this.userAction();
    return { ok: true };
  }

  // Description: flip the theme everywhere and save.
  // Inputs: none  Outputs: none
  themeToggle() {
    this.settings.setTheme(this.settings.data.theme === 'dark' ? 'light' : 'dark');
    this.userAction();
  }

  // Description: any explicit user action — resets engagement; leaving the
  //              PAUSED lull resumes scheduling (SPEC §5.3).
  // Inputs: none  Outputs: none
  userAction() {
    if (this.paused) {
      this.paused = false;
      this.armIntervalIfEligible();
    }
    this.armEngagement();
    this.surface.refresh();
  }

  // ── shortcut ──────────────────────────────────────────────────────────────

  // Description: floating shortcut activated (double-click) — SPEC §7 table.
  //              With any popup open it is a no-op (never stack).
  // Inputs: none  Outputs: none
  shortcutActivate() {
    if (this.popup !== null) return;
    if (this.paused) { this.userAction(); return; }
    if (this.state === STATE_INACTIVE) {
      this.armEngagement();
      this.openPopup({ kind: 'start' }, true);
    } else if (this.state === STATE_ACTIVE_NORMAL) {
      this.armEngagement();
      this.openPopup({ kind: 'checkin', context: CTX_OFF_CYCLE }, true);
    } else {
      // Focus keeps running until Submit or timeout (SPEC §5.4).
      this.openPopup({ kind: 'checkin', context: CTX_FOCUS_INTERRUPT }, true);
    }
  }

  // ── quit ──────────────────────────────────────────────────────────────────

  // Description: quit requested (sidebar Quit / window close) — SPEC §5.1.
  // Inputs: none  Outputs: Promise<void>
  async quitRequest() {
    if (this.state === STATE_INACTIVE) {
      const confirmed = await this.surface.confirmQuit();
      if (confirmed) this.quitApp();
      return;
    }
    // An open row exists → the EXIT_PROMPT check-in decides its fate.
    this.replacePopup({ kind: 'checkin', context: CTX_EXIT_PROMPT }, true);
  }

  // ── timer fire handlers ───────────────────────────────────────────────────

  // Description: interval timer fired — check-in when ACTIVE_NORMAL, start-
  //              logging popup when INACTIVE (SPEC §6). Popup open = no-op.
  // Inputs: none  Outputs: none
  onIntervalFired() {
    if (this.popup !== null || this.paused) return;
    if (this.state === STATE_ACTIVE_NORMAL) {
      this.openPopup({ kind: 'checkin', context: CTX_INTERVAL }, true);
    } else if (this.state === STATE_INACTIVE) {
      this.openPopup({ kind: 'start' }, true);
    }
  }

  // Description: focus-end timer reached the chosen end (SPEC §5.4). If a
  //              popup is open (e.g. the interrupt check-in) this is a no-op;
  //              checkinDismiss re-fires it — unless it's the focus live page,
  //              which is closed in favour of the FOCUS_END check-in.
  // Inputs: none  Outputs: none
  onFocusEndFired() {
    if (this.state !== STATE_ACTIVE_FOCUS) return;
    if (this.popup !== null) {
      if (this.popup.kind === 'focus') {
        this.replacePopup({ kind: 'checkin', context: CTX_FOCUS_END }, true);
      }
      return;
    }
    this.openPopup({ kind: 'checkin', context: CTX_FOCUS_END }, true);
  }

  // Description: popup countdown expired — the context's timeout path (SPEC §7).
  //              Timeouts are system events: they NEVER reset engagement.
  // Inputs: none  Outputs: Promise<void>
  async onPopupTimeout() {
    if (this.popup === null) return;
    const { kind, context } = this.popup;

    if (kind === 'start') {
      // As Skip, but engagement is not reset.
      this.closePopup();
      return;
    }
    if (kind !== 'checkin') return;   // focus form popups have no timeout path

    if (context === CTX_INTERVAL || context === CTX_OFF_CYCLE) {
      try {
        await this.closeOpenRow({ notes: TIMED_OUT_NOTE });
        await this.writeOpenRow(KIND_NORMAL);
      } catch {
        // Leave whatever state the log is really in; the next cycle retries.
        this.surface.notifyError('A check-in timed out but the log file couldn’t be written — it may be locked.');
      }
      this.closePopup();   // engagement deliberately untouched
      return;
    }

    if (context === CTX_FOCUS_END || context === CTX_FOCUS_INTERRUPT) {
      this.sched.clear(T_FOCUS_END);
      this.focus = null;
      try {
        await this.closeOpenRow({ notes: TIMED_OUT_NOTE });
      } catch {
        this.surface.notifyError('The focus session ended but the log file couldn’t be written — it may be locked.');
      }
      this.state = STATE_INACTIVE;
      this.armEngagement();   // engagement resumes fresh after focus (SPEC §5.4)
      this.closePopup();
      return;
    }

    if (context === CTX_EXIT_PROMPT) {
      try {
        await this.closeOpenRow({ notes: TIMED_OUT_NOTE });
      } catch {
        // Exit anyway — the row stays open on disk, honest for next launch.
      }
      this.quitApp();
    }
  }

  // Description: engagement fired — 1 h with no user action. Discard the open
  //              row, go INACTIVE, stop scheduling popups (PAUSED lull).
  // Inputs: none  Outputs: Promise<void>
  async onEngagementFired() {
    try {
      await this.deleteOpenRow();
    } catch {
      // Even if the delete failed, stop inventing work.
    }
    this.state = STATE_INACTIVE;
    this.focus = null;
    this.paused = true;
    this.sched.clear(T_INTERVAL);
    this.sched.clear(T_FOCUS_END);
    if (this.popup !== null) this.closePopup({ restartInterval: false });
    this.surface.refresh();
  }

  // ── snapshot ──────────────────────────────────────────────────────────────

  // Description: the full view-model every window renders from. Colours come
  //              from the settings maps (lazily assigned, persistent).
  // Inputs: none
  // Outputs: plain serializable object
  getState() {
    const { hhmm, dateStr } = this.nowParts();
    const todayRows = this.log.readDay(dateStr);
    const openRow = this.openRowDate !== null
      ? this.log.findOpenRow(this.openRowDate)?.row ?? null
      : null;
    const s = this.settings.data;
    const colorMaps = {
      category: Object.fromEntries(
        [...new Set([...s.categories, ...todayRows.map((r) => r.category)])]
          .filter((n) => n !== '')
          .map((n) => [n, this.settings.colorFor('category', n)])),
      project: Object.fromEntries(
        s.projects.map((n) => [n, this.settings.colorFor('project', n)]))
    };
    return {
      state: this.state,
      paused: this.paused,
      lastActivity: this.lastActivityHHMM ?? hhmm,
      theme: s.theme,
      now: hhmm,
      today: dateStr,
      openRow,
      openRowDate: this.openRowDate,
      openRowElapsedMin: openRow ? elapsedMinutes(openRow.start, hhmm) : 0,
      focus: this.focus,
      focusEndsAtMs: this.sched.deadline(T_FOCUS_END),
      nextFireMs: this.sched.deadline(T_INTERVAL),
      popup: this.popup === null ? null : {
        kind: this.popup.kind,
        context: this.popup.context ?? null,
        variant: this.popup.variant ?? null,
        prefill: this.popup.prefill ?? null,
        deadlineMs: this.sched.deadline(T_POPUP)
      },
      intervalMinutes: s.intervalMinutes,
      popupTimeoutSec: s.popupTimeoutSec,
      logRoot: this.log.root,
      logRootIsDefault: s.logRoot === null,
      categories: s.categories,
      projects: s.projects,
      colors: colorMaps,
      todayRows
    };
  }
}
