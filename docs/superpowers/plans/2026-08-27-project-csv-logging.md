# Per-Project CSV Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional second logging format that mirrors every completed entry into
`AppLog/Projects/<Category>/<Project>.csv`, alongside the unchanged daily log.

**Architecture:** The daily CSV stays the system of record and is always written. A pure module
(`project_file.js`) owns name sanitization and the 4-column row shape; `LogStore` stays the only thing that
builds paths and fires the mirror from exactly two methods, gated by one completeness predicate. A mirror
failure never throws — it returns a result the core turns into a warning toast.

**Tech Stack:** Plain JavaScript (ESM) + JSDoc, `node:test`, Electron main process, React 18 renderer.
No new dependencies.

**Design doc:** `docs/superpowers/specs/2026-08-27-project-csv-logging-design.md`

**Branch:** `project-csv-logging` (already created; the design doc is committed on it)

---

## Read this first (repo conventions you must follow)

- **CLAUDE.md §6.1:** every source file starts with a header block — Filename · Description · Inputs ·
  Outputs · Created.
- **CLAUDE.md §6.2:** every function gets a `// Description: / // Inputs: / // Outputs:` block before it.
  Use `none` where there are none.
- **CLAUDE.md §6.3:** no hard-coded literals. Every string, number, and folder name lives in
  `src/shared/constants.js`. A raw `'Projects'` in a function body is a bug.
- **CLAUDE.md §6.3:** one return per function, with a carve-out for early exits on validation or write
  failure.
- **CLAUDE.md §6.4:** reference the spec where a block implements a stated rule, e.g. `// SPEC §3.1`.
- Comments in this codebase explain **why**, not what. Match the existing tone — see `log_store.js`.
- Run tests with `npm test` (which is `node --test tests/`). There is no watch mode; run the whole suite.
- The apostrophe in user-facing strings is the typographic `’`, not `'`. Match the existing messages.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/shared/constants.js` | Modify | All new named constants |
| `src/main/log/project_file.js` | **Create** | Pure: sanitize a name, shape a project row, the completeness predicate. No filesystem. |
| `src/main/log/log_store.js` | Modify | Builds the project path, fires the mirror, owns the on/off flag |
| `src/main/settings/settings_store.js` | Modify | `logFormat` load/normalise/save |
| `src/main/core/core.js` | Modify | Surfaces the mirror result as a toast; `logFormatChange` |
| `src/main/ipc.js` | Modify | `log-format-change` route |
| `src/main/main.js` | Modify | Injects the setting into `LogStore` at startup |
| `src/renderer/pane-dashboard.jsx` | Modify | LOG FORMAT chips inside `LogLocationPanel` |
| `tests/project_file.test.js` | **Create** | The pure module |
| `tests/project_log.test.js` | **Create** | The mirror through `LogStore`, against real temp dirs |
| `tests/settings_derive.test.js` | Modify | `logFormat` normalisation |
| `tests/core.test.js` | Modify | Toast text on mirror success and failure |
| `FUNCTIONAL_SPEC.md` | Modify | §3.1, §3.2, §8.2, §13 |
| `UPDATES.md` | Modify | One new entry, newest on top |

---

# PHASE 1 — the pure format layer

No app behaviour changes. Gate: `npm test` green.

## Task 1: Constants

**Files:**
- Modify: `src/shared/constants.js`

- [ ] **Step 1: Add the project-log constants**

Insert directly after the `LEGACY_CSVS_DIR_NAME` / `SETTINGS_FILE_NAME` lines (i.e. inside the existing
"Log file contract" block, before `MONTH_NAMES`):

```javascript
// ── Project log mirror (SPEC §3.1 — the optional second format) ─────────────
// A per-project CSV under AppLog/Projects/<Category>/<Project>.csv. Four
// columns: the category and project are the folder and file name, so they are
// not repeated inside the file.
export const PROJECTS_DIR_NAME = 'Projects';
export const PROJECT_LOG_COLUMNS = ['date', 'start_time', 'end_time', 'additional_notes'];
export const PROJECT_LOG_HEADER_LINE = PROJECT_LOG_COLUMNS.join(',');

// Characters Windows forbids in a file name, plus control characters. Used ONLY
// with String.replace — never with .test(), which would carry lastIndex between
// calls on a /g regex and return alternating answers.
export const ILLEGAL_PATH_CHARS_RE = /[\\/:*?"<>|\x00-\x1f]/g;
export const PATH_NAME_REPLACEMENT = '-';
// Reserved device names: a file called CON.csv is still CON to Windows.
export const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];
export const RESERVED_NAME_PREFIX = '_';

// Mirror outcomes. A failure is an object; success and skip are these strings,
// so callers can tell "nothing to do" from "should have worked and didn't".
export const MIRROR_OK = 'ok';
export const MIRROR_SKIPPED = 'skipped';
export const MIRROR_REASON_UNWRITABLE_NAME = 'unwritable-name';
export const MIRROR_REASON_WRITE_FAILED = 'write-failed';
```

- [ ] **Step 2: Add the log-format setting constants**

Insert in the "Settings defaults (SPEC §3.2)" block, directly above `DEFAULT_CATEGORIES`:

```javascript
// Which files an entry is written to. Daily is always written either way; the
// choice is whether the project mirror is written as well (SPEC §3.2).
export const LOG_FORMAT_DAILY = 'daily';
export const LOG_FORMAT_DAILY_PLUS_PROJECT = 'daily+project';
export const DEFAULT_LOG_FORMAT = LOG_FORMAT_DAILY;
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm test`
Expected: PASS — 60 tests, same as before. Constants alone change no behaviour.

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants.js
git commit -m "Add project-log and log-format constants"
```

---

## Task 2: `project_file.js` — sanitization, the row shape, the predicate

**Files:**
- Create: `src/main/log/project_file.js`
- Test: `tests/project_file.test.js`
- Modify: `FUNCTIONAL_SPEC.md` (§3.1)

- [ ] **Step 1: Write the failing tests**

Create `tests/project_file.test.js`:

```javascript
// project_file.test.js
// Description: verifies the pure project-log helpers — the sanitization rules
//              that turn a free-text category or project into a writable file
//              name, the 4-column row shape, and the completeness predicate
//              that decides whether a row is mirrored at all (SPEC §3.1).
// Inputs:  none
// Outputs: node:test results
// Created: 2026-08-27

import test from 'node:test';
import assert from 'node:assert/strict';
import { isMirrorable, projectRowFields, sanitizePathName } from '../src/main/log/project_file.js';
import { serializeLine } from '../src/main/log/csv.js';
import { parseCsv } from '../src/main/log/csv.js';
import { KIND_NORMAL, PROJECT_LOG_HEADER_LINE } from '../src/shared/constants.js';

const row = (over = {}) => ({
  start: '09:00', end: '10:30', kind: KIND_NORMAL,
  category: 'School', project: 'Capstone', notes: '', ...over
});

// ── sanitization (SPEC §3.1) ────────────────────────────────────────────────

test('sanitize: a clean name is unchanged', () => {
  assert.equal(sanitizePathName('Capstone'), 'Capstone');
  assert.equal(sanitizePathName('Thermo Lab'), 'Thermo Lab');
});

test('sanitize: every Windows-illegal character becomes a dash', () => {
  const cases = [
    ['Thermo Lab: Part 2', 'Thermo Lab- Part 2'],
    ['R&D / Ops', 'R&D - Ops'],
    ['back\\slash', 'back-slash'],
    ['star*', 'star-'],
    ['what?', 'what-'],
    ['say "hi"', 'say -hi-'],
    ['a<b>c', 'a-b-c'],
    ['pipe|d', 'pipe-d']
  ];
  for (const [input, expected] of cases) {
    assert.equal(sanitizePathName(input), expected, `input: ${input}`);
  }
});

test('sanitize: control characters become dashes', () => {
  assert.equal(sanitizePathName('a\x00b\x1fc'), 'a-b-c');
});

test('sanitize: trailing dots and surrounding whitespace are trimmed', () => {
  assert.equal(sanitizePathName('Notes.'), 'Notes');
  assert.equal(sanitizePathName('Notes...'), 'Notes');
  assert.equal(sanitizePathName('  Trim me  '), 'Trim me');
  assert.equal(sanitizePathName('Trailing space '), 'Trailing space');
});

test('sanitize: reserved device names gain a prefix, keeping their case', () => {
  assert.equal(sanitizePathName('CON'), '_CON');
  assert.equal(sanitizePathName('con'), '_con');
  assert.equal(sanitizePathName('COM1'), '_COM1');
  assert.equal(sanitizePathName('LPT9'), '_LPT9');
  assert.equal(sanitizePathName('CON.'), '_CON');
  // Not reserved: only the exact names are.
  assert.equal(sanitizePathName('CONTEXT'), 'CONTEXT');
});

test('sanitize: a name with no writable form returns empty', () => {
  assert.equal(sanitizePathName('...'), '');
  assert.equal(sanitizePathName('   '), '');
  assert.equal(sanitizePathName(''), '');
  assert.equal(sanitizePathName(null), '');
  assert.equal(sanitizePathName(undefined), '');
});

test('sanitize: separators are replaced, not dropped — no path traversal', () => {
  // A separator becomes a dash rather than vanishing, so no name can climb out
  // of Projects/. '..' on its own trims to empty and is refused outright.
  assert.equal(sanitizePathName('..'), '');
  assert.equal(sanitizePathName('../secrets'), '..-secrets');
  assert.equal(sanitizePathName('..\\secrets'), '..-secrets');
});

// ── the completeness predicate (SPEC §4 of the design) ──────────────────────

test('mirrorable: a fully attributed closed row is mirrored', () => {
  assert.equal(isMirrorable(row()), true);
});

test('mirrorable: an open row is never mirrored', () => {
  assert.equal(isMirrorable(row({ end: '' })), false);
});

test('mirrorable: a row with no category or no project is never mirrored', () => {
  assert.equal(isMirrorable(row({ category: '' })), false);
  assert.equal(isMirrorable(row({ project: '' })), false);
  assert.equal(isMirrorable(row({ category: '', project: '' })), false);
});

// ── the row shape ───────────────────────────────────────────────────────────

test('row fields: date first, then times, then notes — category/project omitted', () => {
  assert.deepEqual(
    projectRowFields('2026-08-27', row({ notes: 'wrote the plan' })),
    ['2026-08-27', '09:00', '10:30', 'wrote the plan']
  );
});

test('row fields: an empty note is a literal empty field', () => {
  const line = serializeLine(projectRowFields('2026-08-27', row()));
  assert.equal(line, '2026-08-27,09:00,10:30,');
});

test('row fields: notes with commas, quotes and newlines round-trip', () => {
  const notes = 'read "the spec", then\nwrote tests';
  const line = serializeLine(projectRowFields('2026-08-27', row({ notes })));
  const [fields] = parseCsv(line);
  assert.equal(fields[3], notes);
});

test('the header line is exactly the four agreed columns', () => {
  assert.equal(PROJECT_LOG_HEADER_LINE, 'date,start_time,end_time,additional_notes');
});
```

**Why `'../secrets'` → `'..-secrets'`:** a dot is not an illegal character, so `..` survives; the `/` becomes
`-`; and trailing-dot trimming only touches the *end* of the string, so the leading dots stay. The result
contains no separator, which is the property that matters — it cannot escape `Projects/`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/main/log/project_file.js'`

- [ ] **Step 3: Write the implementation**

Create `src/main/log/project_file.js`:

```javascript
// project_file.js
// Description: the pure half of the project-log mirror (SPEC §3.1) — turns a
//              free-text category or project into a writable file name, shapes
//              a daily row into the project file's four columns, and answers
//              whether a row is complete enough to mirror at all. Deliberately
//              knows nothing about folders or the filesystem: LogStore stays
//              the only thing that builds a path (CLAUDE.md §5.1).
// Inputs:  category / project names as free text; row objects
//          {start, end, kind, category, project, notes}; dates as 'YYYY-MM-DD'
// Outputs: sanitized name strings; arrays of 4 fields; booleans
// Created: 2026-08-27

import {
  ILLEGAL_PATH_CHARS_RE, PATH_NAME_REPLACEMENT, RESERVED_NAME_PREFIX,
  WINDOWS_RESERVED_NAMES
} from '../../shared/constants.js';

// Description: a free-text name as a file or folder name Windows will accept.
//              Names stay unrestricted everywhere else in the app and in the
//              daily log — sanitizing here, at the one place a path is built,
//              is what keeps the two from having to agree (SPEC §3.1).
//              Replace, then trim, then check reserved: 'CON.' must still be
//              caught. Separators are replaced rather than dropped, so no name
//              can climb out of the Projects folder.
// Inputs:  name — any string (null/undefined tolerated)
// Outputs: a writable name, or '' when the name has no writable form
export function sanitizePathName(name) {
  const replaced = String(name ?? '').replace(ILLEGAL_PATH_CHARS_RE, PATH_NAME_REPLACEMENT);
  // Windows silently drops trailing dots and spaces, so a name ending in them
  // would resolve to a different file than the one we think we wrote.
  const trimmed = replaced.trim().replace(/[. ]+$/, '');
  let safe = trimmed;
  if (WINDOWS_RESERVED_NAMES.includes(trimmed.toUpperCase())) {
    safe = RESERVED_NAME_PREFIX + trimmed;
  }
  return safe;
}

// Description: is this row complete enough to belong in a project file? This
//              one predicate replaces every per-event special case: an open row
//              has no end, a timed-out row has no category or project, and a
//              deleted row never reaches here (design doc §4).
// Inputs:  row — row object
// Outputs: boolean
export function isMirrorable(row) {
  return row.end !== '' && row.category !== '' && row.project !== '';
}

// Description: a daily row as the project file's four ordered fields. The
//              category and project are the folder and file name, so they are
//              not repeated inside the file; the kind has no column at all —
//              the project file is a mirror for reading, not a second source of
//              truth (design doc §8.1).
// Inputs:  dateStr — 'YYYY-MM-DD', the date of the daily file the row lives in
//          row — row object
// Outputs: array of 4 strings
export function projectRowFields(dateStr, row) {
  return [dateStr, row.start, row.end, row.notes].map((v) => v ?? '');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. If the `../secrets` assertion fails, read the actual value from the failure output, confirm
it contains no `/` or `\`, and assert that exact value.

- [ ] **Step 5: Document the format in the spec**

In `FUNCTIONAL_SPEC.md` §3.1, after the "Operations the log layer must support" table, add:

```markdown
**The optional project mirror.** When the log format setting (§3.2) is `daily+project`, every *completed*
entry is additionally appended to a per-project file:

```
AppLog/Projects/<Category>/<Project>.csv
```

- Header row, exactly: `date,start_time,end_time,additional_notes`. The category and project are the folder
  and file name, so they are not columns; there is no `mode` column.
- `date` is the date of the daily file the row lives in, so a block spanning midnight files under its start
  date, exactly as the daily log does.
- Same conventions as the daily file: RFC 4180 quoting, CRLF, UTF-8, literal empty fields.
- Rows are appended in write order and never re-sorted, so a manual back-fill lands after later-dated rows.
- A row is mirrored **only when complete** — it has an end time, a category, and a project. Open rows,
  timeout-closed rows (which carry `window timed out` and no details), skipped rows, and manual entries with
  a blank project therefore never appear in a project file.
- Category and project names stay unrestricted. When the path is built, `\ / : * ? " < > |` and control
  characters become `-`, trailing dots and spaces are trimmed, and Windows reserved names (`CON`, `COM1`, …)
  gain a `_` prefix. Two names that sanitize identically share a file; the daily log keeps the exact names.
- **The daily log is always written regardless of this setting**, and remains the system of record. The
  mirror is never read back by the app.
```

- [ ] **Step 6: Commit**

```bash
git add src/main/log/project_file.js tests/project_file.test.js FUNCTIONAL_SPEC.md
git commit -m "Add pure project-file helpers: sanitization, row shape, completeness predicate"
```

**PHASE 1 GATE — stop here and report.** `npm test` must be green with the new tests included, and the app's
behaviour must be entirely unchanged (nothing imports `project_file.js` yet).

---

# PHASE 2 — the mirror and the setting

Gate: `npm test` green, including a case for every row of the design's §4 table.

## Task 3: `LogStore` — the flag and the path

**Files:**
- Modify: `src/main/log/log_store.js`
- Test: `tests/project_log.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/project_log.test.js`:

```javascript
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

const open = (over = {}) => ({
  start: '09:00', end: '', kind: KIND_NORMAL, category: '', project: '', notes: '', ...over
});
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `store.setProjectMirror is not a function`

- [ ] **Step 3: Add the flag and the path builder**

In `src/main/log/log_store.js`, extend the import from constants (add to the existing import block):

```javascript
import {
  APPLOG_DIR_NAME, LEGACY_CSVS_DIR_NAME, LOG_COLUMNS, LOG_HEADER_LINE,
  LOG_LINE_ENDING, MIRROR_OK, MIRROR_REASON_UNWRITABLE_NAME,
  MIRROR_REASON_WRITE_FAILED, MIRROR_SKIPPED, MONTH_NAMES,
  PROJECT_LOG_HEADER_LINE, PROJECTS_DIR_NAME, WRITE_PROBE_FILE_NAME,
  WRITE_RETRY_ATTEMPTS, WRITE_RETRY_BACKOFF_MS
} from '../../shared/constants.js';
```

Add a second import line below the existing `csv.js` import:

```javascript
import { isMirrorable, projectRowFields, sanitizePathName } from './project_file.js';
```

Change the constructor to default the flag off (a store is daily-only until told otherwise):

```javascript
  constructor(root, sleep = defaultSleep) {
    this.sleep = sleep;
    this.projectMirror = false;   // off until main.js injects the setting
    this.setRoot(root);
  }
```

Add this method directly after `setRoot`:

```javascript
  // Description: turn the project mirror on or off. Injected by main.js from
  //              the logFormat setting, the same way the root is — the log
  //              layer must not read settings itself (CLAUDE.md §5.1).
  // Inputs:  enabled — boolean
  // Outputs: none
  setProjectMirror(enabled) {
    this.projectMirror = enabled === true;
  }
```

Add this method directly after `legacyDayFilePath`, inside the paths section:

```javascript
  // Description: the project-mirror path for a category/project pair. Null when
  //              either name has no writable form, which is a reportable
  //              failure rather than a silent skip (SPEC §3.1).
  // Inputs:  category, project — the free-text names
  // Outputs: absolute file path, or null
  projectFilePath(category, project) {
    const categoryDir = sanitizePathName(category);
    const projectName = sanitizePathName(project);
    let file = null;
    if (categoryDir !== '' && projectName !== '') {
      file = path.join(this.appLogDir, PROJECTS_DIR_NAME, categoryDir, `${projectName}.csv`);
    }
    return file;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all four new path tests, plus the existing suite unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/main/log/log_store.js tests/project_log.test.js
git commit -m "Add project mirror flag and path builder to LogStore"
```

---

## Task 4: `LogStore` — fire the mirror

**Files:**
- Modify: `src/main/log/log_store.js`
- Test: `tests/project_log.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/project_log.test.js`:

```javascript
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

// ── what is NOT mirrored (design doc §4, every row of the table) ────────────

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `res.mirror` is undefined (`appendRow` currently returns nothing).

- [ ] **Step 3: Add the mirror method**

In `src/main/log/log_store.js`, add this at the end of the writes section, directly after `rewriteDay` and
before `withRetry`:

```javascript
  // Description: write the project-mirror copy of a completed row (SPEC §3.1).
  //              NEVER throws: the daily row is already safe on disk by the time
  //              this runs, and a failed mirror must not undo or hide a saved
  //              entry (CLAUDE.md §4.4). The caller reports the failure instead.
  // Inputs:  dateStr — 'YYYY-MM-DD'; row — the completed row object
  // Outputs: Promise<MIRROR_OK | MIRROR_SKIPPED | { failedName, reason }>
  async mirrorToProject(dateStr, row) {
    if (!this.projectMirror || !isMirrorable(row)) return MIRROR_SKIPPED;
    const file = this.projectFilePath(row.category, row.project);
    if (file === null) {
      return {
        failedName: `${row.category} / ${row.project}`,
        reason: MIRROR_REASON_UNWRITABLE_NAME
      };
    }
    const line = serializeLine(projectRowFields(dateStr, row)) + LOG_LINE_ENDING;
    let outcome = MIRROR_OK;
    try {
      if (fs.existsSync(file)) {
        await this.withRetry(() => fs.appendFileSync(file, line, 'utf8'));
      } else {
        const body = PROJECT_LOG_HEADER_LINE + LOG_LINE_ENDING + line;
        await this.withRetry(() => {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, body, 'utf8');
        });
      }
    } catch {
      outcome = { failedName: path.basename(file), reason: MIRROR_REASON_WRITE_FAILED };
    }
    return outcome;
  }
```

- [ ] **Step 4: Wire it into `appendRow`**

Replace the whole existing `appendRow` method with this. Note it also removes the duplicated
`serializeLine(rowToFields(row))` that used to appear in both branches:

```javascript
  // Description: append a row to a day's file, creating file + header (and the
  //              folder tree) if the day has no file yet, then mirror it to the
  //              project file if it is complete and the mirror is on.
  // Inputs:  dateStr — 'YYYY-MM-DD'; row — row object
  // Outputs: Promise<{ mirror }>; throws LogWriteError if the DAILY write fails
  async appendRow(dateStr, row) {
    const existing = this.existingDayFile(dateStr);
    const line = serializeLine(rowToFields(row)) + LOG_LINE_ENDING;
    if (existing !== null) {
      await this.withRetry(() => fs.appendFileSync(existing, line, 'utf8'));
    } else {
      const file = this.dayFilePath(dateStr);
      const body = LOG_HEADER_LINE + LOG_LINE_ENDING + line;
      await this.withRetry(() => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body, 'utf8');
      });
    }
    return { mirror: await this.mirrorToProject(dateStr, row) };
  }
```

- [ ] **Step 5: Wire it into `updateOpenRow`**

Replace the whole existing `updateOpenRow` method:

```javascript
  // Description: patch the open row of a day (set end time and optionally the
  //              detail fields; the kind is set at open and never modified by
  //              this method unless explicitly passed, which callers must not
  //              do — invariant CLAUDE.md §4.3). A row that is complete after
  //              the patch is mirrored to its project file.
  // Inputs:  dateStr — 'YYYY-MM-DD'
  //          patch — { end, category?, project?, notes? }
  // Outputs: Promise<{ mirror }>; throws Error if no open row; LogWriteError on I/O
  async updateOpenRow(dateStr, patch) {
    const open = this.findOpenRow(dateStr);
    if (open === null) throw new Error(`no open row on ${dateStr}`);
    const rows = this.readDay(dateStr);
    const merged = {
      ...rows[open.index],
      end: patch.end,
      category: patch.category ?? rows[open.index].category,
      project: patch.project ?? rows[open.index].project,
      notes: patch.notes ?? rows[open.index].notes
    };
    rows[open.index] = merged;
    await this.rewriteDay(dateStr, rows);
    return { mirror: await this.mirrorToProject(dateStr, merged) };
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — the whole suite, including all of `project_log.test.js`. The existing `log_store.test.js`
and `core.test.js` must still pass untouched: they ignore the new return value.

- [ ] **Step 7: Commit**

```bash
git add src/main/log/log_store.js tests/project_log.test.js
git commit -m "Mirror completed rows to project CSVs from appendRow and updateOpenRow"
```

---

## Task 5: The `logFormat` setting

**Files:**
- Modify: `src/main/settings/settings_store.js`
- Test: `tests/settings_derive.test.js`
- Modify: `FUNCTIONAL_SPEC.md` (§3.2)

- [ ] **Step 1: Write the failing tests**

Append to `tests/settings_derive.test.js`. It already imports `fs`, `os`, `path` and `SettingsStore`; the
only import change needed is its constants line, which becomes:

```javascript
import { COLOR_PALETTE, LOG_FORMAT_DAILY, LOG_FORMAT_DAILY_PLUS_PROJECT } from '../src/shared/constants.js';
```

Then append:

```javascript
// ── log format (SPEC §3.2) ──────────────────────────────────────────────────

test('log format defaults to daily-only', () => {
  const s = new SettingsStore(fs.mkdtempSync(path.join(os.tmpdir(), 'logit-fmt-')));
  assert.equal(s.data.logFormat, LOG_FORMAT_DAILY);
});

test('an unknown log format normalises to daily rather than disabling logging', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logit-fmt-'));
  fs.writeFileSync(path.join(root, 'settings.json'),
    JSON.stringify({ logFormat: 'project-only' }), 'utf8');
  const s = new SettingsStore(root);
  assert.equal(s.data.logFormat, LOG_FORMAT_DAILY);
});

test('setting the log format persists across a reload', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logit-fmt-'));
  const s = new SettingsStore(root);
  assert.equal(s.setLogFormat(LOG_FORMAT_DAILY_PLUS_PROJECT), LOG_FORMAT_DAILY_PLUS_PROJECT);
  assert.equal(new SettingsStore(root).data.logFormat, LOG_FORMAT_DAILY_PLUS_PROJECT);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `s.data.logFormat` is undefined.

- [ ] **Step 3: Implement**

In `src/main/settings/settings_store.js`, add to the constants import:

```javascript
  DEFAULT_LOG_FORMAT, LOG_FORMAT_DAILY_PLUS_PROJECT,
```

In `load()`, add this key to the `data` object, directly after the `logRoot` key:

```javascript
      // Which files an entry is written to. Anything unrecognised falls back to
      // daily rather than to a format that might write nothing (SPEC §3.2).
      logFormat: raw.logFormat === LOG_FORMAT_DAILY_PLUS_PROJECT
        ? LOG_FORMAT_DAILY_PLUS_PROJECT : DEFAULT_LOG_FORMAT,
```

Add this method directly after `setLogRoot`:

```javascript
  // Description: choose whether the project mirror is written alongside the
  //              daily log. The daily log is written either way (SPEC §3.1).
  // Inputs:  format — 'daily' | 'daily+project'
  // Outputs: the stored (normalised) value
  setLogFormat(format) {
    this.data.logFormat = format === LOG_FORMAT_DAILY_PLUS_PROJECT
      ? LOG_FORMAT_DAILY_PLUS_PROJECT : DEFAULT_LOG_FORMAT;
    this.persist();
    return this.data.logFormat;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Document the setting in the spec**

In `FUNCTIONAL_SPEC.md` §3.2, add a row to the settings table directly below the `Log folder` row:

```markdown
| Log format | `daily` \| `daily+project` | `daily` | *(added 2026-08-27)* Whether completed entries are also mirrored to `AppLog/Projects/<Category>/<Project>.csv` (§3.1). The daily log is written either way. Unrecognised values fall back to `daily` |
```

- [ ] **Step 6: Commit**

```bash
git add src/main/settings/settings_store.js tests/settings_derive.test.js FUNCTIONAL_SPEC.md
git commit -m "Add the logFormat setting"
```

**PHASE 2 GATE — stop here and report.** `npm test` green. The mirror works end to end at the log layer, but
nothing in the app turns it on yet: the UI and the failure warning arrive in Phase 3.

---

# PHASE 3 — surfacing

Gate: the manual checks at the end of this phase, run against the real app.

## Task 6: Core — the warning toast and the setting handler

**Files:**
- Modify: `src/main/core/core.js`
- Test: `tests/core.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/core.test.js` (add `LOG_FORMAT_DAILY_PLUS_PROJECT`, `MIRROR_OK` to its constants import):

```javascript
// ── project mirror surfacing (design doc §6) ────────────────────────────────

test('submit toasts as usual when the project mirror succeeds', async () => {
  const { core, time, settings, log, surface } = makeCore();
  core.logFormatChange(LOG_FORMAT_DAILY_PLUS_PROJECT);
  assert.equal(settings.data.logFormat, LOG_FORMAT_DAILY_PLUS_PROJECT);
  assert.equal(log.projectMirror, true);
  await core.startLogging();
  await time.advance(20 * MIN);
  await core.checkinSubmit({ category: 'Work', project: 'LogIT', notes: '' });
  assert.deepEqual(surface.last('toast'), ['toast', 'Logged: Work - LogIT']);
});

test('a failed project mirror warns in the toast and never opens the shell', async () => {
  const { core, time, log, surface, root, today } = makeCore();
  core.logFormatChange(LOG_FORMAT_DAILY_PLUS_PROJECT);
  // A file where the category folder must go makes the mirror write fail.
  const projects = path.join(root, 'AppLog', 'Projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'Work'), 'in the way', 'utf8');

  await core.startLogging();
  await time.advance(20 * MIN);
  const res = await core.checkinSubmit({ category: 'Work', project: 'LogIT', notes: 'kept' });
  assert.equal(res.ok, true);
  assert.deepEqual(surface.last('toast'), ['toast', 'Saved — but LogIT.csv couldn’t be updated.']);
  assert.equal(surface.last('notifyError'), undefined);
  assert.equal(surface.calls.some((c) => c[0] === 'showShell'), false);
  // The entry is saved and the cycle continues exactly as normal.
  const rows = log.readDay(today);
  assert.equal(rows[0].notes, 'kept');
  assert.equal(rows[0].end, '14:20');
  assert.equal(rows.length, 2);          // a fresh open row was still opened
  assert.equal(core.state, STATE_ACTIVE_NORMAL);
});

test('a failed project mirror on a manual entry warns in the toast', async () => {
  const { core, log, root, surface } = makeCore();
  core.logFormatChange(LOG_FORMAT_DAILY_PLUS_PROJECT);
  const projects = path.join(root, 'AppLog', 'Projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(path.join(projects, 'School'), 'in the way', 'utf8');

  const res = await core.manualSave({
    date: '2026-05-19', start: '09:00', end: '10:00',
    category: 'School', project: 'Capstone', notes: 'back-filled'
  });
  assert.equal(res.ok, true);
  assert.deepEqual(surface.last('toast'),
    ['toast', 'Saved — but Capstone.csv couldn’t be updated.']);
  // The back-filled row is in the daily file for that date regardless.
  const rows = log.readDay('2026-05-19');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notes, 'back-filled');
});

test('the log format reaches the state snapshot for the dashboard', () => {
  const { core } = makeCore();
  assert.equal(core.getState().logFormat, LOG_FORMAT_DAILY);
  core.logFormatChange(LOG_FORMAT_DAILY_PLUS_PROJECT);
  assert.equal(core.getState().logFormat, LOG_FORMAT_DAILY_PLUS_PROJECT);
});
```

Add `LOG_FORMAT_DAILY`, `LOG_FORMAT_DAILY_PLUS_PROJECT` and `MIRROR_OK` to the constants import at the top of
`tests/core.test.js`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `core.logFormatChange is not a function`

- [ ] **Step 3: Add the toast helper**

In `src/main/core/core.js`, add `LOG_FORMAT_DAILY_PLUS_PROJECT` to the constants import, and add this
module-level helper at the bottom of the file, after the class:

```javascript
// Description: the toast text for a saved entry. The mirror is a convenience,
//              so its failure replaces the confirmation rather than joining it —
//              the user is never told "Logged" and "couldn't save" at once. The
//              shell is deliberately NOT opened: the likeliest cause is the
//              project file being open in Excel for hours, which would throw the
//              dashboard on screen at every check-in (design doc §6).
// Inputs:  successText — the normal confirmation
//          mirror — MIRROR_OK | MIRROR_SKIPPED | { failedName, reason }
// Outputs: string
function savedToastText(successText, mirror) {
  let text = successText;
  if (mirror !== null && typeof mirror === 'object') {
    text = `Saved — but ${mirror.failedName} couldn’t be updated.`;
  }
  return text;
}
```

- [ ] **Step 4: Return the mirror result from `closeOpenRow`**

Replace the existing `closeOpenRow`:

```javascript
  // Description: close the open row in the file where it lives (which may be
  //              yesterday's, for a block spanning midnight — GOTCHAS).
  // Inputs:  patch — { category?, project?, notes? }; end = now
  // Outputs: Promise<mirror result> — passed to savedToastText by the caller
  async closeOpenRow(patch = {}) {
    const { hhmm } = this.nowParts();
    const result = await this.log.updateOpenRow(this.openRowDate, { end: hhmm, ...patch });
    this.openRowDate = null;
    return result.mirror;
  }
```

- [ ] **Step 5: Use it in `checkinSubmit`**

In `checkinSubmit`, change the close call to capture the result. Replace:

```javascript
    try {
      await this.closeOpenRow({ category, project, notes });
    } catch {
```

with:

```javascript
    let mirror = null;
    try {
      mirror = await this.closeOpenRow({ category, project, notes });
    } catch {
```

Then replace the success toast line:

```javascript
      this.surface.toast(`Logged: ${category} - ${project}`);
```

with:

```javascript
      this.surface.toast(savedToastText(`Logged: ${category} - ${project}`, mirror));
```

- [ ] **Step 6: Use it in `focusBegin` and `manualSave`**

In `focusBegin`, replace:

```javascript
      try {
        await this.closeOpenRow(wrap);
      } catch {
```

with:

```javascript
      try {
        wrapMirror = await this.closeOpenRow(wrap);
      } catch {
```

The variable must be declared in the function's scope, not inside the block. **`focusBegin` contains two
separate `if (variantB) {` blocks** — the first validates and builds `wrap`, the second closes the row — so
do not anchor on that line. Instead declare it beside the existing `wrap` declaration, replacing:

```javascript
    let wrap = null;
```

with:

```javascript
    let wrap = null;
    let wrapMirror = null;
```

Then replace the variant-B toast:

```javascript
    if (variantB) this.surface.toast(`Logged: ${wrap.category} - ${wrap.project}`);
```

with:

```javascript
    if (variantB) {
      this.surface.toast(savedToastText(`Logged: ${wrap.category} - ${wrap.project}`, wrapMirror));
    }
```

**Declare `let wrapMirror = null;` outside the `if (variantB)` block** (just above it), so it is still in
scope at the toast line.

In `manualSave`, replace:

```javascript
    try {
      await this.log.appendRow(date, {
        start, end, kind: KIND_MANUAL, category, project, notes
      });
    } catch {
      return { ok: false, errors: ['Save failed — the log file for that date may be locked. Nothing was written.'] };
    }
    this.surface.toast(`Logged: ${category}${project ? ' - ' + project : ''}`);
```

with:

```javascript
    let mirror = null;
    try {
      const written = await this.log.appendRow(date, {
        start, end, kind: KIND_MANUAL, category, project, notes
      });
      mirror = written.mirror;
    } catch {
      return { ok: false, errors: ['Save failed — the log file for that date may be locked. Nothing was written.'] };
    }
    this.surface.toast(
      savedToastText(`Logged: ${category}${project ? ' - ' + project : ''}`, mirror));
```

- [ ] **Step 7: Add the setting handler and the state field**

Add this method directly after `intervalChange`:

```javascript
  // Description: switch the log format. The daily log is unaffected either way;
  //              this only turns the project mirror on or off, and the log layer
  //              is told directly rather than reading settings itself (§5.1).
  // Inputs:  format — 'daily' | 'daily+project'
  // Outputs: the stored value
  logFormatChange(format) {
    const stored = this.settings.setLogFormat(format);
    this.log.setProjectMirror(stored === LOG_FORMAT_DAILY_PLUS_PROJECT);
    this.userAction();
    return stored;
  }
```

In `getState()`, add one field directly after `logRootIsDefault`:

```javascript
      logFormat: s.logFormat,
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — the whole suite. Every pre-existing `core.test.js` assertion about toast text must still
pass: with the mirror off, `savedToastText` returns the success text unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/main/core/core.js tests/core.test.js
git commit -m "Surface project-mirror failures as a warning toast; add logFormatChange"
```

---

## Task 7: Wire it up — IPC and startup

**Files:**
- Modify: `src/main/ipc.js`
- Modify: `src/main/main.js`

- [ ] **Step 1: Add the IPC route**

In `src/main/ipc.js`, add one case directly below the `interval-change` case:

```javascript
      case 'log-format-change':    return core.logFormatChange(payload.format);
```

- [ ] **Step 2: Inject the setting at startup**

In `src/main/main.js`, add to the constants import (the file currently imports none — add this line with the
other imports):

```javascript
import { LOG_FORMAT_DAILY_PLUS_PROJECT } from '../shared/constants.js';
```

Then, directly after `const log = new LogStore(settings.logRoot);`, add:

```javascript
    // The log layer never reads settings itself (CLAUDE.md §5.1), so the format
    // is handed to it here, the same way the root is.
    log.setProjectMirror(settings.data.logFormat === LOG_FORMAT_DAILY_PLUS_PROJECT);
```

- [ ] **Step 3: Verify the suite still passes**

Run: `npm test`
Expected: PASS. (These two files have no unit tests; the check is that nothing regressed.)

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.js src/main/main.js
git commit -m "Wire the log-format setting through IPC and startup"
```

---

## Task 8: The dashboard control

**Files:**
- Modify: `src/renderer/pane-dashboard.jsx`

- [ ] **Step 1: Extend the panel's props**

`LogLocationPanel` is rendered in both dashboard looks (idle and active), so putting the chips inside it puts
them in both with one change.

In `src/renderer/pane-dashboard.jsx`, add `LOG_FORMAT_DAILY, LOG_FORMAT_DAILY_PLUS_PROJECT` to the
constants import, and add `Segmented` to the widgets import (it already exists — do not write a new widget).

- [ ] **Step 2: Add the chips to the panel**

Replace the `LogLocationPanel` signature and its comment block:

```javascript
// Description: the log-format chips and the log-folder field (SPEC §8.2) —
//              together they answer "where does my data go", so they read as one
//              group. Old files are never moved and project files are never
//              backfilled, so both hints say so plainly rather than letting
//              history seem to vanish.
// Inputs:  root — current path; isDefault — whether it's the untouched default
//          format — 'daily' | 'daily+project'
// Outputs: element
function LogLocationPanel({ root, isDefault, format }) {
```

Then, inside the panel's outer `<div>`, directly above the existing
`<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>`, insert:

```jsx
      <div style={{ marginBottom: 14 }}>
        <Label>LOG FORMAT</Label>
        <div style={{ marginTop: 6 }}>
          <Segmented
            value={format}
            onChange={(f) => window.logit.send('log-format-change', { format: f })}
            options={[
              { value: LOG_FORMAT_DAILY, label: 'Daily' },
              { value: LOG_FORMAT_DAILY_PLUS_PROJECT, label: 'Daily + Project' }
            ]}
          />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.45 }}>
          {format === LOG_FORMAT_DAILY_PLUS_PROJECT ? (
            <>Finished entries are also appended to{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {'Projects\\<Category>\\<Project>.csv'}
              </span>.
              Entries logged before you turned this on stay only in the daily files.</>
          ) : (
            <>Entries go to the daily <span style={{ fontFamily: 'var(--font-mono)' }}>.csv</span> only.
              Add project files to also keep one CSV per project, grouped by category.</>
          )}
        </div>
      </div>
```

- [ ] **Step 3: Pass the prop at both call sites**

There are exactly two `<LogLocationPanel .../>` usages. Change both from:

```jsx
        <LogLocationPanel root={state.logRoot} isDefault={state.logRootIsDefault} />
```

to:

```jsx
        <LogLocationPanel root={state.logRoot} isDefault={state.logRootIsDefault}
          format={state.logFormat} />
```

- [ ] **Step 4: Verify the renderer builds**

Run: `npm run build:renderer`
Expected: `vite build` completes with no errors. A JSX syntax error fails here.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pane-dashboard.jsx
git commit -m "Add the LOG FORMAT chips to the dashboard"
```

---

## Task 9: Documentation

**Files:**
- Modify: `FUNCTIONAL_SPEC.md` (§8.2, §13)
- Modify: `UPDATES.md`

- [ ] **Step 1: Document the dashboard control**

In `FUNCTIONAL_SPEC.md` §8.2, in the paragraph describing the log-folder field, add before it:

```markdown
- **LOG FORMAT chips:** `Daily` / `Daily + Project`, shown above the log folder field in both dashboard
  looks. Switching to `Daily + Project` starts mirroring completed entries to
  `AppLog/Projects/<Category>/<Project>.csv` from that moment; existing history is never backfilled, and the
  hint says so. Switching back stops the mirror; existing project files are left alone.
```

- [ ] **Step 2: Add acceptance-checklist items**

In `FUNCTIONAL_SPEC.md` §13, add:

```markdown
- [ ] With `Daily + Project` set, a check-in Submit writes both the daily row and a row in
      `Projects/<Category>/<Project>.csv`, with matching times.
- [ ] A second entry in the same project appends; the header appears once.
- [ ] A popup timeout, a Skip, and a manual entry with a blank project write no project row.
- [ ] With `Daily` set, no project file is created or touched.
- [ ] With the project CSV open in Excel, a check-in still saves: the popup closes, the toast names the file
      that couldn't be updated, and the dashboard does NOT open.
- [ ] A category containing `:` produces a folder with `-`, and the daily row keeps the exact typed name.
```

- [ ] **Step 3: Add the UPDATES entry**

At the top of `UPDATES.md`, directly below the intro and the `---`, insert (and remove `(newest)` from the
2026-08-17 heading below it):

```markdown
## 2026-08-27 (newest) — optional per-project CSVs alongside the daily log

**Change.** A second, optional logging format. With `LOG FORMAT` set to `Daily + Project` on the dashboard,
every *completed* entry is also appended to `AppLog/Projects/<Category>/<Project>.csv` — four columns,
`date,start_time,end_time,additional_notes`, with the category and project carried by the folder and file
name. `FUNCTIONAL_SPEC.md` §3.1, §3.2, §8.2 and §13 updated.

**The daily log is always written, and there is no project-only mode.** A project CSV cannot hold an open
row — the project isn't known until the block *closes* — so switching daily writes off would mean relocating
the open block into a new state file, rewriting the `ACTIVE ⟺ one open row exists` invariant (CLAUDE.md
§4.2), and giving every pane a second read path. Roughly three times the work, to delete files the user
already keeps. The mirror is additive and is never read back by the app.

**Three decisions worth recording:**

- **One completeness predicate, not per-event special cases.** A row is mirrored exactly when
  `end`, `category`, and `project` are all non-empty. That single rule delivers every required behaviour on
  its own: open rows, timeout-closed rows (no details), skipped rows, and manual entries with a blank
  project all fall out as non-mirrored without a line of special-casing. It lives in two `LogStore` methods
  — `appendRow` and `updateOpenRow` — and nowhere else.
- **A mirror failure warns in the toast, never via `notifyError`.** `notifyError` calls `showShell()`, and
  the likeliest cause of a mirror failure is the user having that project's CSV open in Excel for hours —
  which would throw the dashboard on screen at *every* check-in, against the 2026-08-17 "only the shortcut
  is on screen" decision. Nothing is lost when a mirror fails (the daily log has the entry), so the toast is
  the proportionate channel; it replaces the "Logged" confirmation rather than joining it.
- **Names are sanitized at the path, not restricted at the keyboard.** Categories and projects stay free
  text everywhere and in the daily log; `\ / : * ? " < > |` become `-` only when a path is built. Two names
  that sanitize alike share a file — accepted, versus a persisted name→filename map in settings.

**Accepted limits.** A project CSV has no `mode` column, so it cannot distinguish focus from normal work;
analytics keep reading daily files. There is no backfill and no reconciliation — toggle the setting or lose
one mirror write to a locked file, and that project file is permanently missing those rows with nothing that
notices. The daily log is complete in every case.

**Invalidates:** nothing. The frozen six-column daily format, the folder tree, and every read path are
unchanged.
```

- [ ] **Step 4: Commit**

```bash
git add FUNCTIONAL_SPEC.md UPDATES.md
git commit -m "Document per-project CSV logging in the spec and UPDATES"
```

---

## PHASE 3 GATE — manual verification against the real app

Run: `npm start`

- [ ] Dashboard shows `LOG FORMAT` above `LOG FOLDER`, with `Daily` selected.
- [ ] Click `Daily + Project`. Start logging, wait for a check-in (or use `Log activity`), submit with
      category `Work`, project `LogIT`. Confirm on disk:
      `Documents\LogIT\AppLog\<year>\<MM-Month>\<date>.csv` has the closed row, **and**
      `Documents\LogIT\AppLog\Projects\Work\LogIT.csv` has a matching `date,start,end,notes` row under the
      header.
- [ ] Submit a second entry to the same project: it appends, header appears once.
- [ ] Open `Projects\Work\LogIT.csv` in Excel and leave it open. Submit another entry. Expect: the popup
      closes, the toast reads `Saved — but LogIT.csv couldn’t be updated.`, **the dashboard does not open**,
      and the daily file has the row. Close Excel.
- [ ] Let a check-in time out (don't touch it for 60 s). Expect: the daily row closes with
      `window timed out`, and no new project row anywhere.
- [ ] Switch back to `Daily`. Submit an entry: no new project row; the existing project files are untouched.
- [ ] Switch to `Daily + Project` and submit with category `Ops: Q3`. Expect a folder named `Ops- Q3`, and
      the daily CSV still holding the exact text `Ops: Q3`.
- [ ] Restart the app: `LOG FORMAT` still shows your last choice.

Report results. File anything surprising in `GOTCHAS.md` in the same change.

---

## Final step: merge

- [ ] Run `npm test` one last time; confirm the count and that all pass.
- [ ] Use the superpowers:finishing-a-development-branch skill to merge `project-csv-logging` into `main`.
