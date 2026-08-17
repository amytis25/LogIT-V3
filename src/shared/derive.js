// derive.js
// Description: every derived number in the app, implemented once and shared by
//              main and renderer (FUNCTIONAL_SPEC §9). Durations, elapsed,
//              countdowns, rollups, and their display formats. Four screens
//              showing four different hour totals is the failure this prevents.
// Inputs:  'HH:MM' time strings, row objects, {date, rows} range arrays
// Outputs: numbers and formatted strings
// Created: 2026-08-17

import { KIND_FOCUS } from './constants.js';

// Description: is a string a valid 'HH:MM' 24-hour time?
// Inputs:  s — string
// Outputs: boolean
export function isValidHHMM(s) {
  if (!/^\d{2}:\d{2}$/.test(s ?? '')) return false;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Description: is a string a valid 'YYYY-MM-DD' calendar date?
// Inputs:  s — string
// Outputs: boolean
export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? '')) return false;
  const d = new Date(s + 'T00:00:00');
  return !Number.isNaN(d.getTime()) && s === toIso(d);
}

// Description: 'HH:MM' → minutes since midnight. Caller validates first.
// Inputs:  s — 'HH:MM'
// Outputs: number of minutes
export function hhmmToMinutes(s) {
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

// Description: minutes since midnight → 'HH:MM'.
// Inputs:  mins — 0..1439
// Outputs: 'HH:MM'
export function minutesToHHMM(mins) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(mins / 60))}:${p(mins % 60)}`;
}

// Description: duration of an entry in minutes (SPEC §9): 0 when start or end
//              is empty (open rows contribute nothing) and 0 when negative
//              (never subtract time — midnight-spanning rows).
// Inputs:  row — { start, end }
// Outputs: minutes >= 0
export function durationMinutes(row) {
  if (!row.start || !row.end) return 0;
  const diff = hhmmToMinutes(row.end) - hhmmToMinutes(row.start);
  return diff < 0 ? 0 : diff;
}

// Description: a day's total logged hours.
// Inputs:  rows — array of row objects
// Outputs: hours (float)
export function dayTotalHours(rows) {
  return rows.reduce((sum, r) => sum + durationMinutes(r), 0) / 60;
}

// Description: elapsed minutes of the open row. A start later than now means
//              the block began before midnight — treat start as yesterday.
// Inputs:  startHHMM, nowHHMM
// Outputs: minutes >= 0
export function elapsedMinutes(startHHMM, nowHHMM) {
  const diff = hhmmToMinutes(nowHHMM) - hhmmToMinutes(startHHMM);
  return diff < 0 ? diff + 24 * 60 : diff;
}

// Description: wrapped span from start to end for focus sessions — end at or
//              before start targets the next occurrence of that clock time.
// Inputs:  startHHMM, endHHMM
// Outputs: minutes > 0, or 0 when the two are equal (invalid session)
export function wrappedSpanMinutes(startHHMM, endHHMM) {
  const diff = hhmmToMinutes(endHHMM) - hhmmToMinutes(startHHMM);
  if (diff === 0) return 0;
  return diff < 0 ? diff + 24 * 60 : diff;
}

// Description: format elapsed time: 'Xh YYm', or 'Ym' under an hour (SPEC §9).
// Inputs:  mins — minutes
// Outputs: string
export function formatElapsed(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// Description: format a countdown: 'in Xm YYs', 'in Xh YYm' beyond an hour,
//              'now' at or below zero (SPEC §9).
// Inputs:  seconds — number
// Outputs: string
export function formatCountdown(seconds) {
  if (seconds <= 0) return 'now';
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `in ${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `in ${m}m ${String(s).padStart(2, '0')}s`;
}

// Description: format a duration hint like '1h 30m' for the focus form.
// Inputs:  mins — minutes
// Outputs: string
export function formatDurationShort(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h 00m`;
  return `${m}m`;
}

// Description: 'HH:MM:SS' clock for the focus live countdown.
// Inputs:  seconds
// Outputs: string
export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// Description: bucket a date range's rows by category (SPEC §9 rollups). Zero
//              days keep their slots. Rows with no category count under ''.
// Inputs:  range — array of { date, rows }
// Outputs: { days: [{date, totalHours, byCategory:{name:hours}}],
//            byCategory: {name: hours}, totalHours, focusHours }
export function rollup(range) {
  const days = [];
  const byCategory = {};
  let totalHours = 0;
  let focusHours = 0;
  for (const { date, rows } of range) {
    const dayBuckets = {};
    let dayTotal = 0;
    for (const r of rows) {
      const h = durationMinutes(r) / 60;
      if (h === 0) continue;
      dayTotal += h;
      dayBuckets[r.category] = (dayBuckets[r.category] || 0) + h;
      byCategory[r.category] = (byCategory[r.category] || 0) + h;
      if (r.kind === KIND_FOCUS) focusHours += h;
    }
    totalHours += dayTotal;
    days.push({ date, totalHours: dayTotal, byCategory: dayBuckets });
  }
  return { days, byCategory, totalHours, focusHours };
}

// Description: local ISO date for a Date (helper for isValidDate round-trip).
// Inputs:  d — Date
// Outputs: 'YYYY-MM-DD'
function toIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
