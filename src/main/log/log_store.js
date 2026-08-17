// log_store.js
// Description: the log layer — THE ONLY code that knows where log files live or
//              how the daily-file folder tree is shaped (CLAUDE.md §5.1). Reads
//              both the current layout (AppLog/YYYY/MM-Month/YYYY-MM-DD.csv)
//              and the legacy one (.../MM-Month/CSVs/YYYY-MM-DD.csv); writes go
//              to whichever file already holds the day, else the current layout.
//              Every write retries on lock errors, and every in-place rewrite
//              goes through a temp file + rename so an interruption can never
//              truncate a day (GOTCHAS "Rewriting the whole file...").
// Inputs:  data root directory (injected); row objects
//          {start, end, kind, category, project, notes} with 'HH:MM' times and
//          empty-string empties; dates as 'YYYY-MM-DD' strings
// Outputs: row objects read back; files under <root>/AppLog
// Created: 2026-08-17

import fs from 'node:fs';
import path from 'node:path';
import {
  APPLOG_DIR_NAME, LEGACY_CSVS_DIR_NAME, LOG_COLUMNS, LOG_HEADER_LINE,
  LOG_LINE_ENDING, MONTH_NAMES, WRITE_RETRY_ATTEMPTS, WRITE_RETRY_BACKOFF_MS
} from '../../shared/constants.js';
import { parseCsv, serializeLine, serializeLines } from './csv.js';

// Error thrown upward when a write still fails after the silent retries.
export class LogWriteError extends Error {
  constructor(cause) {
    super('log write failed after retries');
    this.name = 'LogWriteError';
    this.cause = cause;
  }
}

export class LogStore {
  // Description: create a store rooted at a data directory.
  // Inputs:  root — directory that contains (or will contain) AppLog/
  //          sleep — optional injectable delay fn (ms) => Promise, for tests
  // Outputs: none
  constructor(root, sleep = defaultSleep) {
    this.appLogDir = path.join(root, APPLOG_DIR_NAME);
    this.sleep = sleep;
  }

  // ── paths (private) ───────────────────────────────────────────────────────

  // Description: current-layout path for a date.
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: absolute file path
  dayFilePath(dateStr) {
    const { year, monthDir } = dateDirs(dateStr);
    return path.join(this.appLogDir, year, monthDir, `${dateStr}.csv`);
  }

  // Description: legacy-layout path (extra CSVs/ level) for a date.
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: absolute file path
  legacyDayFilePath(dateStr) {
    const { year, monthDir } = dateDirs(dateStr);
    return path.join(this.appLogDir, year, monthDir, LEGACY_CSVS_DIR_NAME, `${dateStr}.csv`);
  }

  // Description: the file that holds a day's rows: existing current-layout file
  //              first, else existing legacy file, else null.
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: path or null
  existingDayFile(dateStr) {
    const current = this.dayFilePath(dateStr);
    if (fs.existsSync(current)) return current;
    const legacy = this.legacyDayFilePath(dateStr);
    if (fs.existsSync(legacy)) return legacy;
    return null;
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  // Description: all rows of a day in file order. A missing or empty file is a
  //              day with no entries, never an error (SPEC §11).
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: array of row objects
  readDay(dateStr) {
    const file = this.existingDayFile(dateStr);
    if (file === null) return [];
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      return [];
    }
    const lines = parseCsv(text);
    const rows = [];
    for (const fields of lines) {
      // Skip the header row and any malformed short line rather than crashing —
      // the log must keep parsing whatever years of history contain.
      if (fields[0] === LOG_COLUMNS[0]) continue;
      if (fields.length < LOG_COLUMNS.length) continue;
      rows.push({
        start: fields[0], end: fields[1], kind: fields[2],
        category: fields[3], project: fields[4], notes: fields[5]
      });
    }
    return rows;
  }

  // Description: rows across an inclusive date range, walking day by day.
  //              Missing days appear as empty arrays so charts keep their slots.
  // Inputs:  startDateStr, endDateStr — 'YYYY-MM-DD', start <= end
  // Outputs: array of { date, rows } in chronological order
  readRange(startDateStr, endDateStr) {
    const out = [];
    let d = startDateStr;
    // Walk by adding a one-day delta to a Date object — never arithmetic on the
    // day field (GOTCHAS "end.replace(day=start.day+1) is not tomorrow").
    while (d <= endDateStr) {
      out.push({ date: d, rows: this.readDay(d) });
      d = nextDate(d);
    }
    return out;
  }

  // Description: find the open row of a day by scanning for an empty end time.
  //              NEVER "the last line" — a manual back-fill can append a closed
  //              row after the open one (GOTCHAS, the single nastiest old bug).
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: { index, row } or null
  findOpenRow(dateStr) {
    const rows = this.readDay(dateStr);
    let found = null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].end === '') found = { index: i, row: rows[i] };
    }
    return found;
  }

  // ── writes ────────────────────────────────────────────────────────────────

  // Description: append a row to a day's file, creating file + header (and the
  //              folder tree) if the day has no file yet.
  // Inputs:  dateStr — 'YYYY-MM-DD'; row — row object
  // Outputs: Promise<void>; throws LogWriteError on persistent failure
  async appendRow(dateStr, row) {
    const existing = this.existingDayFile(dateStr);
    if (existing !== null) {
      const line = serializeLine(rowToFields(row)) + LOG_LINE_ENDING;
      await this.withRetry(() => fs.appendFileSync(existing, line, 'utf8'));
      return;
    }
    const file = this.dayFilePath(dateStr);
    const body = LOG_HEADER_LINE + LOG_LINE_ENDING +
      serializeLine(rowToFields(row)) + LOG_LINE_ENDING;
    await this.withRetry(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body, 'utf8');
    });
  }

  // Description: patch the open row of a day (set end time and optionally the
  //              detail fields; the kind is set at open and never modified by
  //              this method unless explicitly passed, which callers must not
  //              do — invariant CLAUDE.md §4.3).
  // Inputs:  dateStr — 'YYYY-MM-DD'
  //          patch — { end, category?, project?, notes? }
  // Outputs: Promise<void>; throws Error if no open row; LogWriteError on I/O
  async updateOpenRow(dateStr, patch) {
    const open = this.findOpenRow(dateStr);
    if (open === null) throw new Error(`no open row on ${dateStr}`);
    const rows = this.readDay(dateStr);
    rows[open.index] = {
      ...rows[open.index],
      end: patch.end,
      category: patch.category ?? rows[open.index].category,
      project: patch.project ?? rows[open.index].project,
      notes: patch.notes ?? rows[open.index].notes
    };
    await this.rewriteDay(dateStr, rows);
  }

  // Description: delete the open row entirely (Skip / engagement / exit-Skip —
  //              the app's only destructive operation).
  // Inputs:  dateStr — 'YYYY-MM-DD'
  // Outputs: Promise<void>; no-op if no open row
  async deleteOpenRow(dateStr) {
    const open = this.findOpenRow(dateStr);
    if (open === null) return;
    const rows = this.readDay(dateStr);
    rows.splice(open.index, 1);
    await this.rewriteDay(dateStr, rows);
  }

  // Description: rewrite a whole day atomically — temp file in the same dir,
  //              then rename over the original.
  // Inputs:  dateStr; rows — full replacement row list
  // Outputs: Promise<void>
  async rewriteDay(dateStr, rows) {
    const file = this.existingDayFile(dateStr) ?? this.dayFilePath(dateStr);
    const body = LOG_HEADER_LINE + LOG_LINE_ENDING +
      serializeLines(rows.map(rowToFields));
    const temp = file + '.tmp';
    await this.withRetry(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(temp, body, 'utf8');
      fs.renameSync(temp, file);
    });
  }

  // Description: run a write op, retrying on lock-style errors a few times with
  //              a short backoff (the file WILL be open in Excel — GOTCHAS).
  // Inputs:  op — synchronous function performing the write
  // Outputs: Promise<void>; throws LogWriteError after the last attempt
  async withRetry(op) {
    let lastError = null;
    for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt++) {
      try {
        op();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < WRITE_RETRY_ATTEMPTS) await this.sleep(WRITE_RETRY_BACKOFF_MS);
      }
    }
    throw new LogWriteError(lastError);
  }
}

// ── module helpers ──────────────────────────────────────────────────────────

// Description: year and month folder names for a date.
// Inputs:  dateStr — 'YYYY-MM-DD'
// Outputs: { year: 'YYYY', monthDir: 'MM-MonthName' }
function dateDirs(dateStr) {
  const year = dateStr.slice(0, 4);
  const monthNum = dateStr.slice(5, 7);
  const monthName = MONTH_NAMES[Number(monthNum) - 1];
  return { year, monthDir: `${monthNum}-${monthName}` };
}

// Description: the next calendar date, via a real one-day delta.
// Inputs:  dateStr — 'YYYY-MM-DD'
// Outputs: 'YYYY-MM-DD'
export function nextDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

// Description: the previous calendar date.
// Inputs:  dateStr — 'YYYY-MM-DD'
// Outputs: 'YYYY-MM-DD'
export function prevDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

// Description: format a Date's local calendar day as 'YYYY-MM-DD'.
// Inputs:  d — Date
// Outputs: 'YYYY-MM-DD'
export function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Description: row object → the six ordered fields of the frozen format.
// Inputs:  row object
// Outputs: array of 6 strings
function rowToFields(row) {
  return [row.start, row.end, row.kind, row.category, row.project, row.notes]
    .map((v) => v ?? '');
}

// Description: default backoff delay.
// Inputs:  ms — milliseconds
// Outputs: Promise resolved after ms
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
