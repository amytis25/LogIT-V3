# Per-project CSV logging — design

**Date:** 2026-08-27
**Status:** approved, not implemented
**Touches:** `FUNCTIONAL_SPEC.md` §3.1, §3.2, §8.2, §13 · `UPDATES.md` · `src/shared/constants.js` ·
`src/main/log/` · `src/main/settings/settings_store.js` · `src/main/core/core.js` · `src/main/ipc.js` ·
the dashboard pane · `tests/`

---

## 1. What this adds

A second, optional logging format: a **project-log mirror**. When enabled, every *completed* entry is
additionally appended to a per-project CSV, filed in a folder named for its category.

```
AppLog/
  2026/
    08-August/
      2026-08-27.csv                  ← the daily log, unchanged, ALWAYS written
  Projects/
    School/
      Capstone.csv
      Thermo Lab.csv
    Work/
      LogIT.csv
```

The user picks between two modes from the dashboard: **Daily** (today's behaviour) or **Daily + Project**.

## 2. What this deliberately does NOT do

Recorded because each was considered and rejected, not overlooked.

- **It does not change the daily log.** The six-column frozen contract (CLAUDE.md §4.1,
  `FUNCTIONAL_SPEC.md` §3.1) is untouched: same columns, same `HH:MM`, same empty-field convention, same
  folder tree, same legacy-layout reading.
- **There is no project-only mode.** A project CSV cannot hold an open row — the project isn't known until
  the block *closes* — so switching daily writes off would mean relocating the open block into a new state
  file and rewriting the `ACTIVE ⟺ one open row exists` invariant (CLAUDE.md §4.2), plus a second read path
  under every pane. Roughly three times the work, to delete files the user already keeps. Rejected.
- **It changes nothing on the read side.** The NOW card, today's timeline, analytics, recent-manual-entries
  and the editor panes keep reading daily files only. `queries.js` is not touched.
- **No backfill.** Project files start empty and fill from the moment the setting is turned on. This follows
  the precedent set on 2026-08-17 for the log-folder move: the app does not rewrite or regenerate the user's
  history on a settings click.
- **No reconciliation, ever.** See §8.

## 3. The project file format

One file per project, inside a folder per category.

```
<logRoot>/AppLog/Projects/<Category>/<Project>.csv
```

- Header row, exactly: `date,start_time,end_time,additional_notes`
- Four columns per row, in that order:

| Column | Content | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | The date of the **daily file the row lives in** — i.e. the block's start date |
| `start_time` | `HH:MM`, 24-hour | Never empty |
| `end_time` | `HH:MM`, 24-hour | Never empty — an incomplete row is never mirrored (§4) |
| `additional_notes` | free text, or empty | Copied verbatim from the daily row |

- RFC 4180 quoting, `CRLF` endings, UTF-8 — identical conventions to the daily file, produced by the
  **existing** `serializeLine` in `src/main/log/csv.js`. No second copy of the quoting logic (CLAUDE.md §6.3).
- Category and project are not columns: they are the folder and the file name.
- A file is created (with its header) on first write to that project, never pre-created.
- Rows are appended in write order and never re-sorted. A manual back-fill for an earlier date therefore
  lands after later-dated rows. Appending never rewrites the file, so a project file holding months of
  history is never at risk from an interrupted write.
- **Midnight-spanning blocks** file under their start date, exactly as the daily log does.

### 3.1 Name sanitization

Category and project names stay unrestricted everywhere in the app and in the daily CSV. Sanitization
happens only when a path is built:

| Rule | Example |
|---|---|
| `\ / : * ? " < > \|` → `-` | `Thermo Lab: Part 2` → `Thermo Lab- Part 2` |
| Control characters → `-` | |
| Trailing dots and spaces trimmed | `Notes.` → `Notes` |
| Windows reserved names get a `_` prefix | `CON` → `_CON`, `COM1` → `_COM1` |
| Empty after sanitizing → **mirror failure**, not a silent skip | `///` → `` — reported per §6 |

A name consisting only of illegal characters has no writable file name. That is a mirror *failure*, reported
like any other (§6) — never a silent skip, which would drop attributed work with nothing said (CLAUDE.md §4.4).
The §4 skip rules are about rows that legitimately have nothing to file; this is a row that should have been
filed and couldn't be.

Two distinct names that sanitize to the same string share one file. This is accepted: it is rare, the daily
log retains the exact names, and the alternative (a persisted name→filename map in settings) adds permanent
state to prevent a cosmetic collision.

## 4. The completeness rule — the whole behaviour in one predicate

A row is mirrored to a project CSV **exactly when it is complete**:

```
mirror  ⟺  end !== ''  AND  category !== ''  AND  project !== ''
```

Nothing else needs a special case. The predicate produces every required outcome on its own:

| Event | Mirrored? | Why |
|---|---|---|
| Open row written (`writeOpenRow`) | no | `end` is empty |
| Check-in **Submit** (`closeOpenRow`) | **yes** | category + project are required fields (SPEC §10) |
| Popup **timeout** close | no | closes with no category/project, notes = `window timed out` |
| **Skip** / engagement delete | no | the row is deleted; it was never complete |
| Focus wrap-up, popup variant B | **yes** | category + project required there too |
| Focus row opened at session start | no | `end` is empty |
| **Manual** entry with a project | **yes** | complete on arrival |
| **Manual** entry, blank project | no | project is optional in manual entry (`core.js` requires only category) |
| Open row carried by `changeLogRoot` | no | `end` is empty |

Consequence worth stating: a project CSV contains only real, fully-attributed work. Timeout rows — the
evidence nobody was there — never appear in it.

## 5. Architecture

CLAUDE.md §5.1 makes the log layer the only thing that knows where files live, and GOTCHAS records the old
build drifting because four places rebuilt paths. So the mirror adds **no** second path owner.

```
  main.js            reads settings.logFormat, calls log.setProjectMirror(enabled)
                     — same injection pattern already used for logRoot (2026-08-17)
        │
  LogStore           OWNS the project path: appLogDir + Projects/ + sanitized names.
                     Mirrors from exactly two methods: appendRow, updateOpenRow.
                     Reuses withRetry (Excel locks a project file like any other).
        │
  project_file.js    NEW, pure: sanitize a name, build the header, row → 4 fields.
                     No filesystem, no paths of its own. Unit-testable in isolation.
```

`project_file.js` exists so `log_store.js` does not grow a second job (CLAUDE.md §6.5). It is pure data
transformation; every filesystem decision stays in `LogStore`.

### 5.1 Where the mirror fires

Only two methods, both of which can produce a complete row:

- `appendRow(dateStr, row)` — mirrors when `row` arrives complete (the manual-entry path).
- `updateOpenRow(dateStr, patch)` — mirrors, after the daily rewrite succeeds, when the patched row is
  complete (every check-in Submit and focus wrap-up).

`rewriteDay`, `deleteOpenRow`, `readDay`, `readRange` and `findOpenRow` are untouched.

### 5.2 New constants (`src/shared/constants.js`)

`PROJECTS_DIR_NAME`, `PROJECT_LOG_COLUMNS`, `PROJECT_LOG_HEADER_LINE`, `ILLEGAL_PATH_CHARS`,
`WINDOWS_RESERVED_NAMES`, `LOG_FORMAT_DAILY`, `LOG_FORMAT_DAILY_PLUS_PROJECT`, `DEFAULT_LOG_FORMAT`.
No raw literals at the use sites (CLAUDE.md §6.3).

## 6. Failure handling

The daily write is the contract; the mirror is a convenience. They are not equals, and the code says so.

```
  daily write ──✗──►  throws as it always has (LogWriteError).
                      Nothing changes: popup stays open, typed text preserved,
                      "nothing was saved" (CLAUDE.md §4.4). No mirror is attempted.

  daily write ──✓──►  mirror attempted (if enabled and the row is complete)
                          │
                          ├──✓── nothing to report
                          │
                          └──✗── NEVER throws. The entry IS saved.
                                 Popup closes normally; the success toast is
                                 replaced by a warning toast naming the file.
```

`appendRow` and `updateOpenRow` return `{ mirror: 'ok' | 'skipped' | { failedName, reason } }`. The return
value is currently ignored by every caller, so adding one breaks nothing. `Core` inspects it at its two real
call sites — `closeOpenRow` (used by `checkinSubmit` and `focusBegin`) and `manualSave` — and on failure
swaps the success toast for a warning that states plainly what was and was not written:

> Saved — but `Capstone.csv` couldn't be updated.

**Why a toast and not `surface.notifyError`.** `notifyError` calls `showShell()`. The likeliest cause of a
mirror failure is the user having that project's CSV open in Excel — which persists for hours, so the error
would fire on *every* check-in and throw the dashboard on screen every 20 minutes. That collides head-on with
the 2026-08-17 decision that while the interval timer runs, the only thing on screen is the floating shortcut.
The toast is the right channel here because nothing is lost and nothing needs acting on: the daily log — the
system of record — has the entry, and the mirror is explicitly a convenience (§8.2). The success toast is
replaced rather than accompanied, so the user is never told "Logged" and "couldn't save" at once.

This satisfies §4.4 (never claim a success that didn't happen) without the alternative's cost: an
all-or-nothing policy would have to delete the already-written daily row to allow a clean retry, adding a
destructive path to the one part of the app that has none.

## 7. Setting and UI

`settings.json` gains one key beside `logRoot`:

```json
"logFormat": "daily"            // or "daily+project"
```

- Default `"daily"` — existing installs keep behaving identically until the user opts in.
- Unknown or missing values normalise to `"daily"` on load, the same way an out-of-set interval snaps.
- `SettingsStore` gains `setLogFormat()`; `Core.getState()` gains `logFormat` so the dashboard can render it.
- New IPC event `log-format-change` → `core.logFormatChange(format)`, which saves the setting and calls
  `log.setProjectMirror(...)`.

Dashboard, directly above the existing `LOG FOLDER` field — both answer "where does my data go", so they
read as one group. Two chips, following the interval-chip pattern already in the pane:

```
  LOG FORMAT   [ Daily ]  [ Daily + Project ]
               Project files mirror completed entries into
               AppLog\Projects\<Category>\<Project>.csv

  LOG FOLDER   C:\Users\...\Documents\LogIT              [ Change ]
```

## 8. Accepted limits

Stated so they are known properties, not later surprises.

1. **A project CSV cannot distinguish focus from normal work.** Four columns leave no room for `mode`. The
   mirror is for reading a project's history, not a second source of truth; the focus-hours statistic and
   everything else in analytics keep reading daily files.
2. **There is no reconciliation and no duplicate detection.** Toggle the setting off and back on, or lose a
   single mirror write to a locked file, and that project file is permanently missing those rows with nothing
   in the app that notices. The daily log remains complete in every case. This is the accepted cost of "no
   backfill" and of never rewriting project files.
3. **Renaming or removing a category or project in the editors does not touch project files.** History is
   never rewritten (CLAUDE.md §4.5). Work logged under an old name stays in the old file; new work starts a
   new one.

## 9. Phases and gates

Each phase ends with a stop-and-check. Spec and `UPDATES.md` edits ship in the same phase as the behaviour
they describe (CLAUDE.md §7), never "later".

### Phase 1 — format layer
`project_file.js` + new constants + `tests/project_file.test.js`. No app behaviour changes.

**Gate:** `npm test` green, including:
- [ ] Every sanitization rule in §3.1, as a table-driven case list.
- [ ] A reserved name (`CON`) gains its `_` prefix; a name that is *only* illegal characters sanitizes to
      empty and is reported as a failure, not a skip.
- [ ] A note containing a comma, a quote, and a newline round-trips through `serializeLine` + `parseCsv`.
- [ ] The header line is exactly `date,start_time,end_time,additional_notes`.

### Phase 2 — mirror and setting
`LogStore` path building + mirror calls + `setProjectMirror`; `logFormat` in `SettingsStore`.

**Gate:** `npm test` green, including a case for **every row of the §4 table** against a temp directory:
- [ ] Check-in Submit writes both the daily row and `Projects/<Cat>/<Proj>.csv`, header first.
- [ ] A second entry in the same project appends; the header is not repeated.
- [ ] A timeout close, a Skip, an open row, and a blank-project manual entry write **no** project file.
- [ ] With the mirror off, `Projects/` is never created.
- [ ] A mirror failure returns `{ failedPath }`, does not throw, and leaves the daily row intact and correct.
- [ ] A manual back-fill for an earlier date appends at the end, out of date order.
- [ ] A block spanning midnight files under its start date.
- [ ] `changeLogRoot` with an open block carries it without creating a project file.

### Phase 3 — surfacing
Core reads the mirror result and warns; IPC event; dashboard chips; `getState` field. Spec §3.1/§3.2/§8.2/§13
and an `UPDATES.md` entry.

**Gate:** run the real app —
- [ ] Set Daily + Project, complete a check-in: the daily row and the project row both exist on disk, with
      matching times.
- [ ] Open the project CSV in Excel, complete another check-in: the entry is saved, the popup closes, the
      warning toast names that file, and **the dashboard does not open**. The daily file has the row.
- [ ] Switch back to Daily, complete a check-in: no new project row.
- [ ] A category containing `:` produces a folder with `-` and the daily row keeps the exact typed name.
