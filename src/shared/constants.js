// constants.js
// Description: the one home for every named constant in LogIT. A raw `60` or
//              `"HH:MM"` anywhere else in the codebase is a bug (CLAUDE.md §6.3).
// Inputs:  none
// Outputs: named constant exports, importable from main and renderer alike
// Created: 2026-08-17

// ── Log file contract (FROZEN — FUNCTIONAL_SPEC §3.1) ───────────────────────
export const LOG_COLUMNS = [
  'start_time', 'end_time', 'mode', 'category', 'project', 'additional_notes'
];
export const LOG_HEADER_LINE = LOG_COLUMNS.join(',');
export const LOG_LINE_ENDING = '\r\n';
export const APPLOG_DIR_NAME = 'AppLog';
// Written and deleted to prove a chosen log folder is writable before adopting it.
export const WRITE_PROBE_FILE_NAME = '.logit-write-test';
export const LEGACY_CSVS_DIR_NAME = 'CSVs';       // old layout: .../MM-Month/CSVs/date.csv
export const SETTINGS_FILE_NAME = 'settings.json';
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ── Row kinds (SPEC §2; `inactive` is legacy read-only) ─────────────────────
export const KIND_NORMAL = 'normal';
export const KIND_FOCUS = 'focus';
export const KIND_MANUAL = 'manual';
export const KIND_LEGACY_INACTIVE = 'inactive';   // parse forever, never write

// The marker a popup timeout writes into additional_notes (SPEC §7).
export const TIMED_OUT_NOTE = 'window timed out';

// ── Timers (SPEC §6) ────────────────────────────────────────────────────────
export const ALLOWED_INTERVALS_MIN = [10, 15, 20, 30, 45, 60];
export const DEFAULT_INTERVAL_MIN = 20;
export const DEFAULT_POPUP_TIMEOUT_SEC = 60;
export const ENGAGEMENT_TIMEOUT_MS = 60 * 60 * 1000;   // the 1-hour dead-man's switch
export const LIVE_TICK_MS = 1000;
export const TOAST_DURATION_MS = 3000;

// ── Save-failure handling (SPEC §10) ────────────────────────────────────────
export const WRITE_RETRY_ATTEMPTS = 3;      // silent immediate retries per write call
export const WRITE_RETRY_BACKOFF_MS = 150;
export const SUBMIT_MAX_ATTEMPTS = 3;       // visible attempts before the final echo banner

// ── Check-in contexts (SPEC §4) ─────────────────────────────────────────────
export const CTX_INTERVAL = 'INTERVAL';
export const CTX_OFF_CYCLE = 'OFF_CYCLE';
export const CTX_FOCUS_END = 'FOCUS_END';
export const CTX_FOCUS_INTERRUPT = 'FOCUS_INTERRUPT';
export const CTX_EXIT_PROMPT = 'EXIT_PROMPT';

// ── States ──────────────────────────────────────────────────────────────────
export const STATE_INACTIVE = 'INACTIVE';
export const STATE_ACTIVE_NORMAL = 'ACTIVE_NORMAL';
export const STATE_ACTIVE_FOCUS = 'ACTIVE_FOCUS';

// ── Settings defaults (SPEC §3.2) ───────────────────────────────────────────
export const DEFAULT_CATEGORIES = ['Work', 'School', 'Homework', 'Club', 'Personal'];
export const DEFAULT_PROJECTS = ['General'];
export const DEFAULT_THEME = 'light';

// The fixed palette of 8 muted colours (SPEC §3.2). First-unused-then-cycle.
export const COLOR_PALETTE = [
  '#5d7a5b', '#a05a2c', '#3a5a7a', '#7a3a5a',
  '#c8a23b', '#3a8a85', '#8a6b3a', '#6a5a8a'
];
export const FALLBACK_COLOR = '#a89a83';   // rows whose name has no assignment yet, paint-safe

// ── Surface geometry (design handoff) ───────────────────────────────────────
export const SHELL_WIDTH = 880;
export const SHELL_HEIGHT = 600;
export const SHELL_MIN_WIDTH = 740;
export const SHELL_MIN_HEIGHT = 480;
export const POPUP_WIDTH = 400;
// Halved 2026-08-17 (user): the shortcut sits over other apps all day, so it
// stays out of the way. Every other shortcut dimension derives from this.
export const SHORTCUT_SIZE = 42;
export const SHORTCUT_WINDOW_SIZE = 56;   // button + ring padding + drop shadow

// ── Analytics ranges (SPEC §8.8) ────────────────────────────────────────────
export const ANALYTICS_RANGES_DAYS = [7, 14, 30];
export const MANUAL_RECENT_DAYS = 14;      // recent-manual-entries lookback (SPEC §8.6)
export const MANUAL_RECENT_MAX = 10;
export const DASHBOARD_TIMELINE_MAX = 8;   // most recent entries shown (SPEC §8.2)
