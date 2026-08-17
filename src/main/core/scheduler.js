// scheduler.js
// Description: named one-shot timers over an injectable timer factory, plus the
//              single source of truth for "when does the next popup fire?"
//              (FUNCTIONAL_SPEC §6). The core arms/clears timers by name; every
//              surface derives its countdown from `deadline(name)` — the UI
//              never recomputes schedules independently.
// Inputs:  timer factory { set(fn, ms) → id, clear(id) }, clock () → epoch ms
// Outputs: armed callbacks; deadlines in epoch ms
// Created: 2026-08-17

// Timer names. Each timer's trigger and reset conditions are documented where
// the core arms it (CLAUDE.md §6.4).
export const T_INTERVAL = 'interval';       // fires check-in / start-logging popups
export const T_POPUP = 'popup';             // the 60 s popup countdown
export const T_FOCUS_END = 'focusEnd';      // fires the FOCUS_END check-in
export const T_ENGAGEMENT = 'engagement';   // the 1-hour dead-man's switch

export class Scheduler {
  // Description: create a scheduler over injectable time primitives.
  // Inputs:  timers — { set, clear }; now — () => epoch ms
  // Outputs: none
  constructor(timers, now) {
    this.timers = timers;
    this.now = now;
    this.armed = new Map();   // name → { id, deadline }
  }

  // Description: arm (or re-arm) a named one-shot timer from now.
  // Inputs:  name; ms — delay; fn — callback
  // Outputs: none
  arm(name, ms, fn) {
    this.clear(name);
    const id = this.timers.set(() => {
      this.armed.delete(name);
      return fn();   // returned so async handlers can be awaited (tests, fakes)
    }, ms);
    this.armed.set(name, { id, deadline: this.now() + ms });
  }

  // Description: cancel a named timer if armed.
  // Inputs:  name
  // Outputs: none
  clear(name) {
    const entry = this.armed.get(name);
    if (entry) {
      this.timers.clear(entry.id);
      this.armed.delete(name);
    }
  }

  // Description: is a named timer currently armed?
  // Inputs:  name
  // Outputs: boolean
  isArmed(name) {
    return this.armed.has(name);
  }

  // Description: the epoch-ms deadline of a named timer — the one answer to
  //              "when does the next X fire?".
  // Inputs:  name
  // Outputs: epoch ms, or null when not armed
  deadline(name) {
    const entry = this.armed.get(name);
    return entry ? entry.deadline : null;
  }
}
