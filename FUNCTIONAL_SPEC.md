# LogIT — Complete Functional Specification

> **Purpose of this document.** A from-scratch, implementation-independent description of
> everything LogIT does. Anyone (or any agent) should be able to rebuild the app in any
> language, on any UI toolkit, from this document alone, and get behaviourally identical
> software. No frameworks, libraries, languages, or file/class names from the old build
> appear here — only behaviour, data, and rules.
>
> **Baseline chosen.** Where the shipped build and the locked design disagree, this spec
> states the **locked design** (the V2 logging cycle). Everything the old build does
> differently is listed in [Appendix B](#appendix-b--differences-from-the-old-build) so
> nothing is silently dropped.

---

## Table of contents

1. [What the app is](#1-what-the-app-is)
2. [Vocabulary](#2-vocabulary)
3. [Data the app owns](#3-data-the-app-owns)
4. [The state model](#4-the-state-model)
5. [ASM charts](#5-asm-charts)
6. [Timers](#6-timers)
7. [Master event → effect table](#7-master-event--effect-table)
8. [Surfaces](#8-surfaces)
9. [Derived numbers](#9-derived-numbers)
10. [Validation, failure, and recovery](#10-validation-failure-and-recovery)
11. [Edge cases](#11-edge-cases)
12. [Non-goals](#12-non-goals)
13. [Acceptance checklist](#13-acceptance-checklist)
- [Appendix A — Suggested build order](#appendix-a--suggested-build-order)
- [Appendix B — Differences from the old build](#appendix-b--differences-from-the-old-build)

---

## 1. What the app is

A single-user, local-only desktop time logger. It runs all day in the background and
periodically asks one question: **"what were you just doing?"** The answer is appended
to a plain-text daily log the user owns outright.

Three ways time gets recorded:

| Path | Trigger | Character |
|---|---|---|
| **Interval check-ins** | App asks every *N* minutes | The default loop |
| **Focus sessions** | User declares a block of deep work with an end time | Check-ins suspended until it ends |
| **Manual entries** | User types in a past block after the fact | Retroactive repair, any date |

Plus a read-only **analytics** view and two small **library** editors (categories,
projects).

**Design principles that must survive the rebuild:**

1. **The log is the product.** Human-readable, local, greppable, openable in a
   spreadsheet. No database, no cloud, no account.
2. **Every popup asks about the block that is *closing*, not the one that is opening.**
   A block is opened empty and described at its end, when the user actually knows what
   they did.
3. **Never lose an entry silently.** A failed write is shown to the user with the exact
   text they typed, so they can re-enter it.
4. **The app must never lock the user in.** Every popup is dismissible; nothing is modal
   except the exit confirmation.
5. **Absence is data.** If the user walks away, the app must record that honestly rather
   than inventing work.

---

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Entry / row** | One line in the daily log: a time range plus what was done. |
| **Open row** | An entry with a start time and **no end time**. At most one exists at a time. It represents "the block currently in progress." |
| **Closing a row** | Writing the end time (and usually category/project/notes) into the open row. |
| **Kind** | Per-row flag describing how the row was created: `normal`, `focus`, or `manual`. Set when the row is *opened* and never changed afterwards. |
| **Block** | A closed row; a contiguous span of tracked time. |
| **Check-in** | The popup that closes the open row and opens a new one. |
| **Context** | Which situation caused a check-in popup to appear. Five of them; they change which buttons exist and what a timeout does. |
| **Focus session** | A block declared in advance with a scheduled end. Check-ins are suspended for its duration. |
| **Engagement timer** | The 1-hour dead-man's switch that detects the user walked away. |
| **Shell** | The main window: sidebar + content area. |
| **Shortcut** | The small always-on-top button floating over every other app. |

---

## 3. Data the app owns

### 3.1 The activity log (the contract)

**Layout:** one file per calendar day, grouped by year and month.

```
AppLog/
  2026/
    03-March/
      2026-03-23.csv
      2026-03-24.csv
    05-May/
      2026-05-02.csv
```

- Folder names: `YYYY` and `MM-MonthName` (zero-padded number, hyphen, full English
  month name).
- File name: `YYYY-MM-DD.csv`.
- A day's file is created on first write of that day, never pre-created.
- **Legacy layout compatibility:** older logs live one level deeper, inside a `CSVs/`
  subfolder (`AppLog/2026/03-March/CSVs/2026-03-23.csv`). The rebuild must either read
  both layouts or migrate once on first launch (move files up one level, remove the empty
  folder). File contents are identical in both layouts.

**File format — frozen. Any change is a breaking change.**

- Comma-separated, RFC 4180 quoting (quote a field only if it contains a comma or a
  quote; escape internal quotes by doubling them), UTF-8, `CRLF` line endings.
- One header row, exactly:
  `start_time,end_time,mode,category,project,additional_notes`
- Six columns per row, in that order:

| Column | Content | Notes |
|---|---|---|
| `start_time` | `HH:MM`, 24-hour | Never empty on a written row |
| `end_time` | `HH:MM`, or empty | Empty ⇒ this is the open row |
| `mode` | `normal` \| `focus` \| `manual` | The row's *kind*. Legacy files also contain `inactive` — must still parse |
| `category` | free text, or empty | |
| `project` | free text, or empty | |
| `additional_notes` | free text, or empty | Also carries the marker `window timed out` |

- Empty means a literal empty field (nothing between the commas), never `null`, `""`,
  or `-`.
- No seconds, no date component inside a row — the file name is the date.
- Rows are appended in chronological order. Editing an existing row means rewriting the
  whole file.

**Operations the log layer must support:**

| Operation | Behaviour |
|---|---|
| Append row | Add to the end of today's file, creating file + header if absent |
| Read last row of a day | Return the final data row, or nothing |
| Read all rows of a day | In file order |
| Read all rows across a date range | Walk day by day, skip missing days |
| Update the open row | Set end time, and optionally kind/category/project/notes |
| Delete the open row | Remove the last row entirely (used by Skip) |
| Append row to an arbitrary date | For manual entries on past days |

Every write must survive the file being temporarily locked by another program: retry
a small number of times with a short backoff before reporting failure upward.

### 3.2 Settings

A single small settings file, human-readable, saved immediately on every change.

| Setting | Values | Default | Notes |
|---|---|---|---|
| Check-in interval | one of **10, 15, 20, 30, 45, 60** minutes | 20 | Any stored value outside the set is snapped to the nearest allowed value on load and re-saved |
| Popup timeout | seconds | 60 | Applies to every popup countdown |
| Theme | `light` \| `dark` | `light` | Global; toggled from any window |
| Categories | ordered list of strings | Work, School, Homework, Club, Personal | User-editable |
| Projects | ordered list of strings | a small starter list | User-editable |
| Category colours | name → colour | assigned on demand | Persistent once assigned |
| Project colours | name → colour | assigned on demand | Separate map from categories |

**Colour assignment rule.** There is one fixed palette of 8 muted colours. The first time
a category (or project) name is displayed anywhere, it is assigned the first palette
colour not yet used *in that map*; if all 8 are taken, it cycles. The assignment is
written to settings immediately so a name keeps its colour forever. Categories and
projects draw from the same palette but hold independent maps, so a category and a
project may share a colour without conflict.

**Library growth rule.** Any category or project the user types into any form is added to
the corresponding library on submit if it isn't already there. Libraries never
auto-shrink; removal is explicit, in the editor panes.

---

## 4. The state model

The app is always in exactly one of **three** states. Focus is a flavour of ACTIVE, not a
separate top-level state.

```
                     Start logging  /  Begin focus
                   ──────────────────────────────────►
     ┌──────────────┐                              ┌──────────────────────────┐
     │              │  ◄─ Skip on check-in ──────  │        ACTIVE            │
     │   INACTIVE   │                              │   ┌──────────────────┐   │
     │              │  ◄─ engagement timeout ────  │   │  normal          │   │
     │  no open row │                              │   │  ── or ──        │   │
     │              │  ◄─ focus-end submit /       │   │  focus           │   │
     │              │     timeout ───────────────  │   └──────────────────┘   │
     │              │                              │      one open row        │
     └──────────────┘  ◄─ focus-interrupt ───────  └──────────────────────────┘
                          timeout                           │        ▲
                                                            │        │
                                            check-in submit / timeout │
                                            switch to focus ──────────┘
                                                     (loops)
```

**Invariant:** `state == ACTIVE` ⟺ exactly one open row exists in today's log.
`state == INACTIVE` ⟺ no open row exists. Every operation below preserves this.

### Per-state machinery

| | INACTIVE | ACTIVE (normal) | ACTIVE (focus) |
|---|---|---|---|
| Open row kind | none | `normal` | `focus` |
| Shell default pane | Dashboard (idle look) | Dashboard (active look) | Dashboard (active look) |
| Interval timer | running → **Start-logging popup** | running → **Check-in popup** (INTERVAL) | **stopped** |
| Focus-end timer | stopped | stopped | running → **Check-in popup** (FOCUS_END) |
| Engagement timer | running (1 h) | running (1 h) | **suspended** |
| Shortcut activation | opens Start-logging popup | opens Check-in popup (OFF_CYCLE) | opens Check-in popup (FOCUS_INTERRUPT); focus keeps running |
| Shortcut appearance | idle | progress ring → next check-in | warm accent, ring → focus end |

### The five check-in contexts

The check-in popup is one component with five firing contexts. Context decides which
buttons exist and what a timeout writes.

| Context | Fires when | Skip visible | Dismissible | Timeout writes |
|---|---|---|---|---|
| `INTERVAL` | interval timer, state ACTIVE-normal | yes | yes | close row + open new row |
| `OFF_CYCLE` | shortcut activated, state ACTIVE-normal | yes | yes | close row + open new row |
| `FOCUS_END` | focus-end timer reached | **no** | **no** | close focus row, **no** new row → INACTIVE |
| `FOCUS_INTERRUPT` | shortcut activated during focus | **no** | yes (leaves focus running) | close focus row, **no** new row → INACTIVE |
| `EXIT_PROMPT` | user quits with an open row | yes | yes (cancels the quit) | close row, no new row, then quit |

---

## 5. ASM charts

**Notation used below**

```
┌──────────────┐
│  STATE       │   state box — the app rests here, waiting for an event
└──────────────┘

  ─ action ─      action — executed while passing through, no rest

     ╱────╲
    ╱ test ╲      decision — branch on a condition
    ╲      ╱
     ╲────╱
```

Every action listed is atomic from the user's point of view: log write first, UI change
second, timer change last.

### 5.1 Launch and shutdown

```
        ┌───────────────────────────────────────────┐
        │ LAUNCH                                    │
        │  · load settings (snap interval to legal) │
        │  · migrate legacy log folders if present  │
        │  · show shell on Dashboard pane           │
        │  · show floating shortcut                 │
        └────────────────────┬──────────────────────┘
                             │
                      ╱──────┴───────╲
                     ╱ open row left   ╲
                    ╱  by a previous    ╲───yes───┐   Leave it exactly as
                    ╲  run in today's   ╱         │   it is. Do NOT close,
                     ╲  file?          ╱          │   fill, or delete it.
                      ╲──────┬────────╱           │
                             │no                  │
                             ▼                    ▼
                   ┌───────────────────────────────────┐
                   │ INACTIVE                          │
                   │  · interval timer running         │
                   │  · engagement timer running (1 h) │
                   └───────────────────────────────────┘


        ┌──────────────────┐
        │ QUIT REQUESTED   │  (sidebar Quit, or window close)
        └────────┬─────────┘
                 │
          ╱──────┴───────╲
         ╱  open row       ╲──no──►  ─ confirm "exit LogIT?" ─► [ TERMINATE ]
         ╲  exists?        ╱                  │
          ╲──────┬───────╱                    └─ cancelled ─► return to prior state
                 │yes
                 ▼
        ─ open Check-in popup, context = EXIT_PROMPT ─
                 │
                 ├── Submit  ─► close open row with details, no new row ─► TERMINATE
                 ├── Skip    ─► delete open row                         ─► TERMINATE
                 ├── Dismiss ─► cancel the quit, show Dashboard         ─► prior state
                 └── Timeout ─► close open row, notes = "window timed out" ─► TERMINATE
```

### 5.2 The main logging cycle

```
                        ┌────────────────────────────┐
                        │  INACTIVE                  │◄──────────────────┐
                        └─────────────┬──────────────┘                   │
                                      │                                  │
            ┌─────────────────────────┼──────────────────────┐           │
            │                         │                      │           │
    interval timer fires     "Start logging"          shortcut activated  │
            │                    pressed                     │           │
            ▼                         │                      ▼           │
  ─ show Start-logging popup ─        │        ─ show Start-logging popup ─
            │                         │                      │           │
      ╱─────┴──────╲                  │                ╱──────┴─────╲     │
     ╱   choice?    ╲                 │               ╱   choice?    ╲    │
     ╲              ╱                 │               ╲              ╱    │
      ╲─────┬──────╱                  │                ╲──────┬─────╱     │
   Skip /   │  Start                  │                       │           │
  timeout   │  logging                │                       │           │
      │     │                         │                       │           │
      │     └──────────┬──────────────┘                       │           │
      │                ▼                                      │           │
      │   ─ WRITE open row: start = now, kind = normal, ───────┘           │
      │     all detail fields empty ─                                      │
      │                │                                                   │
      │                ▼                                                   │
      │    ┌────────────────────────────┐                                  │
      │    │  ACTIVE (normal)           │                                  │
      │    │   · interval timer running │                                  │
      │    └─────────────┬──────────────┘                                  │
      │                  │                                                 │
      │       ┌──────────┼─────────────────┬───────────────────┐           │
      │  interval    shortcut          "Focus mode"       "Log activity"   │
      │  fires       activated          pressed            pressed         │
      │       │          │                  │                   │          │
      │       ▼          ▼                  ▼                   ▼          │
      │  ─ Check-in ─ Check-in ─      (see 5.4)            ─ Check-in ─    │
      │    INTERVAL    OFF_CYCLE                             OFF_CYCLE     │
      │       │          │                                      │          │
      │       └──────────┴───────────────┬──────────────────────┘          │
      │                                  ▼                                 │
      │                          ╱───────────────╲                         │
      │                         ╱   which action? ╲                        │
      │                         ╲                 ╱                        │
      │                          ╲───────┬───────╱                         │
      │        ┌─────────────┬───────────┼──────────┬─────────────┐        │
      │     Submit         Skip       Timeout    Dismiss     Focus mode    │
      │        │             │           │          │             │        │
      │        ▼             ▼           ▼          ▼             ▼        │
      │  ─ close open  ─ DELETE     ─ close open  ─ nothing   (see 5.4)    │
      │    row with      open row     row, notes    written                 │
      │    details       ─           = "window                              │
      │  ─ WRITE new     │            timed out"                            │
      │    open row      │          ─ WRITE new                             │
      │    (normal,      │            open row                              │
      │    empty) ─      │            (normal, empty) ─                     │
      │        │         │              │            │                      │
      │        │         └──────────────┼────────────┼──────────────────────┘
      │        │                        │            │
      │        └────────────────────────┴────────────┘
      │                     back to ACTIVE (normal),
      │                     interval timer restarted
      │
      └──────────────────────────────────────────────► stay INACTIVE,
                                                       interval timer restarted
```

**Two rules that are easy to get wrong:**

- **Submit closes one row and opens another.** The details typed describe the row being
  *closed*. The new row starts empty.
- **Skip deletes the open row entirely** — it does not close it. The time it covered
  becomes untracked, which is the honest record of "I don't want to say."

### 5.3 Engagement timer (dead-man's switch)

```
      ┌─────────────────────────────────────────────┐
      │  ENGAGEMENT TIMER — 1 hour, single shot     │
      └──────────────────────┬──────────────────────┘
                             │
            ╱────────────────┴─────────────────╲
           ╱  event observed                    ╲
           ╲                                    ╱
            ╲───────────────┬──────────────────╱
                            │
     ┌──────────────────────┼───────────────────────┬─────────────────┐
  any button press     popup timeout          entering focus     1 hour elapsed
  in any window /      (system event,                            with no reset
  shortcut activation   not the user)              │                  │
  / manual save             │                      ▼                  ▼
        │                   ▼               ─ SUSPEND timer ─   ─ delete the open
        ▼           ─ do NOT reset ─         (no countdown        row, if any ─
  ─ reset to 1 h ─          │                 while focus       ─ state → INACTIVE ─
        │                   │                 is running) ─     ─ stop scheduling
        ▼                   ▼                      │              popups ─
   keep running        keep running                ▼                  │
                                          on focus end, restart       ▼
                                          from a fresh 1 hour   ┌──────────────┐
                                                                │  PAUSED      │
                                                                │  (INACTIVE,  │
                                                                │  no popups)  │
                                                                └──────┬───────┘
                                                                       │
                                                            any user action
                                                                       │
                                                                       ▼
                                                            ─ resume scheduling,
                                                              reset engagement ─
```

Rationale: if the user leaves their desk with a block open, an hour later the app stops
inventing work and quietly discards the unfinished row. Timeouts of popups deliberately
do **not** count as engagement — they are exactly the signal that nobody is there.

### 5.4 Focus mode

```
            ┌───────────────────────────────────────────────┐
            │  "Focus mode" pressed  (dashboard, or from    │
            │   inside a check-in popup)                    │
            └───────────────────────┬───────────────────────┘
                                    │
                     ╱──────────────┴───────────────╲
                    ╱   is a row currently open?     ╲
                    ╲                                ╱
                     ╲──────────────┬───────────────╱
             no ──────┘                            └────── yes
              │                                             │
              ▼                                             ▼
   ┌───────────────────────┐                  ┌──────────────────────────────┐
   │ FOCUS POPUP — variant │                  │ FOCUS POPUP — variant B      │
   │ A (nothing open)      │                  │ (a row is open)              │
   │ fields:               │                  │ fields:                      │
   │   · current time (ro) │                  │   · category, project, notes │
   │   · end time (input)  │                  │     describing the block     │
   └───────────┬───────────┘                  │     about to close           │
               │                              │   · current time (ro)        │
               │                              │   · end time (input)         │
               │                              └───────────┬──────────────────┘
               │                                          │
    ┌──────────┼─────────────┐              ┌─────────────┼───────────────┐
 Begin    Check in      Dismissed        Begin       Check in         Dismissed
 focus    regularly                      focus       regularly
    │          │             │              │             │               │
    ▼          ▼             ▼              ▼             ▼               ▼
─ WRITE   ─ WRITE       nothing        ─ close open  ─ close focus   nothing
  open      open        happens;         row with      popup;         happens;
  row:      row:        stay             the typed     open Check-in  stay
  start=    start=      INACTIVE         details ─     popup          ACTIVE
  now,      now,                       ─ WRITE new     (INTERVAL),    (normal)
  kind=     kind=                        open row:     carrying the
  focus ─   normal ─                     start=now,    typed values
    │          │                         kind=focus ─  forward
    ▼          ▼                             │
[ACTIVE   [ACTIVE                            ▼
 focus]    normal]                      [ACTIVE focus]
```

Entering ACTIVE-focus always: stops the interval timer, starts the focus-end timer for
the chosen end time, and suspends the engagement timer.

**While focus is live:**

```
              ┌────────────────────────────────┐
              │  ACTIVE (focus)                │
              │   · focus-end timer running    │
              │   · check-ins suspended        │
              │   · engagement timer suspended │
              └───────────────┬────────────────┘
                              │
          ┌───────────────────┼────────────────────┐
   focus-end timer      shortcut activated    user re-opens the
   reaches the end      (interrupt)           focus window
          │                   │                    │
          ▼                   ▼                    ▼
   ─ Check-in popup,   ─ Check-in popup,     ─ show live view:
     FOCUS_END ─         FOCUS_INTERRUPT ─     countdown to end,
     · Skip hidden       · Skip hidden         progress bar, goal text,
     · not dismissible   · dismissible         "End session" button ─
     · focus already     · focus timer KEEPS         │
       over                running                   │
          │                   │                      │
          │            ┌──────┼───────┐              │
          │         Submit  Dismiss  Timeout         │
          │            │      │        │             │
          │            │      ▼        │       "End session"
          │            │  focus        │        pressed
          │            │  continues,   │             │
          │            │  unchanged    │             │
          │            │               │             │
          ▼            ▼               ▼             ▼
   ┌────────────────────────────────────────────────────────┐
   │ Submit  → close focus row with details (kind stays     │
   │           focus); open a new empty normal row;         │
   │           → ACTIVE (normal), interval timer restarts,  │
   │             engagement resumes from a fresh hour       │
   │ Timeout → close focus row, notes = "window timed out"; │
   │           NO new row;  → INACTIVE                      │
   └────────────────────────────────────────────────────────┘
```

**The distinction that matters:** in `FOCUS_END` the session is already over, so the
popup must be acted on — there is no dismiss. In `FOCUS_INTERRUPT` the session is still
running, so dismissing leaves it running untouched. In both, submitting or timing out
ends the session.

### 5.5 Manual entry (independent of all state)

```
   ┌──────────────────────────────────────────────────────────┐
   │  MANUAL ENTRY PANE                                       │
   │  date · start · end · category · project · notes         │
   └──────────────────────────┬───────────────────────────────┘
                              │ "Save entry"
                              ▼
                   ╱──────────────────────╲
                  ╱  all fields valid?     ╲──no──► show inline error listing
                  ╲                        ╱        every problem at once;
                   ╲──────────┬───────────╱         nothing is written
                              │yes
                              ▼
        ─ add unseen category / project to the libraries ─
        ─ APPEND row to the file for the chosen date:
            start, end, kind = manual, category, project, notes ─
                              │
                              ▼
        ─ clear category / project / notes; keep date and times ─
        ─ refresh the recent-entries list and the dashboard ─
        ─ reset the engagement timer ─
```

Manual entry never touches the open row, never changes state, and may target any date —
past, today, or (if the user insists) future.

---

## 6. Timers

| Timer | Period | Started by | Stopped/reset by | On fire |
|---|---|---|---|---|
| **Interval** | user's chosen interval (10–60 min) | entering/remaining ACTIVE-normal, or INACTIVE | entering focus; app quit | Show Check-in popup (ACTIVE) or Start-logging popup (INACTIVE) |
| **Popup countdown** | 60 s | showing any popup | any button press in that popup | Popup timeout path for its context |
| **Focus-end** | until the chosen end time | starting a focus session | focus ending by any path | Check-in popup, `FOCUS_END` |
| **Engagement** | 1 hour | launch; any user action | any user action (reset); focus start (suspend) | Discard open row → INACTIVE → PAUSED |
| **Live tick** | 1 s | any visible live element | that element hiding | Repaint elapsed time, countdowns, progress ring |

**Restart semantics.** The interval timer restarts when a popup is *dismissed or acted
on*, not when it appeared. So the next check-in is one full interval after the user
finished dealing with the last one.

**Scheduling refinement (optional, and separable — build the simple version first):**

- **Wall-clock alignment.** Fire on clean boundaries relative to the hour: with a 15-min
  interval, at :00, :15, :30, :45 rather than at arbitrary offsets.
- **Early fire.** Fire 30 seconds *before* the aligned boundary, so the user is answering
  at the boundary, not after it. Always applies.
- **Grace period.** If the user just logged manually, don't fire the next check-in
  immediately afterwards — skip to the following boundary. Applies only when the interval
  is ≥ 10 minutes.

### Next-check-in display

Any surface showing "next check-in" derives it from the same source of truth: the
scheduler's answer to *"given now, when does the next popup fire?"* Never recompute it
independently in the UI.

---

## 7. Master event → effect table

Every user-visible trigger, the log operations it performs, and the resulting state.
`now` = current time as `HH:MM`.

### From the Dashboard (shell)

| Trigger | Log operation | Result |
|---|---|---|
| Start logging (INACTIVE) | write open row: `start=now, kind=normal`, details empty | → ACTIVE-normal; interval timer starts; engagement reset; **shell hides** (§8.1) |
| Log activity (ACTIVE) | none | Check-in popup, `OFF_CYCLE` |
| Focus mode | none | Focus popup, variant A or B by whether a row is open |
| Interval chip changed | none | Save interval; re-arm interval timer if running |
| Sidebar navigation | none | Swap content pane; engagement reset |
| Quit | see ASM 5.1 | |

### Start-logging popup (interval fired while INACTIVE)

| Trigger | Log operation | Result |
|---|---|---|
| Start logging | write open row: `start=now, kind=normal`, empty | → ACTIVE-normal; interval restarts; engagement reset |
| Focus mode | none | close popup; open Focus popup variant A |
| View dashboard | none | close popup; show shell; interval restarts |
| Skip | none | stay INACTIVE; interval restarts; engagement reset |
| Timeout (60 s) | none | as Skip, but **engagement is not reset** |

### Check-in popup — `INTERVAL` and `OFF_CYCLE` (identical)

| Trigger | Log operation | Result |
|---|---|---|
| Submit | close open row: `end=now` + category/project/notes, kind unchanged · then write new open row `start=now, kind=normal`, empty | stay ACTIVE-normal; interval restarts; engagement reset |
| Skip | **delete** the open row | → INACTIVE; interval restarts; engagement reset |
| Focus mode | none | close popup; open Focus popup variant B with the typed values carried over |
| View dashboard / inner close / Esc | none | close popup; show shell; interval restarts; engagement reset |
| Timeout (60 s) | close open row: `end=now`, kind unchanged, `notes = "window timed out"`, no category/project · then write new open row `start=now, kind=normal`, empty | stay ACTIVE-normal; interval restarts; **engagement not reset** |

### Check-in popup — `FOCUS_END`

| Trigger | Log operation | Result |
|---|---|---|
| Submit | close focus row: `end=now` + details, kind stays `focus` · write new open row `start=now, kind=normal`, empty | → ACTIVE-normal; interval starts; engagement resumes from a fresh hour |
| Submit and view dashboard | same as Submit | same, plus shell shows Dashboard |
| Skip / Focus mode / dismiss / close | **hidden — the user must act** | n/a |
| Timeout (60 s) | close focus row: `end=now`, kind stays `focus`, `notes = "window timed out"` · **no new row** | → INACTIVE; engagement resumes fresh |

### Check-in popup — `FOCUS_INTERRUPT`

| Trigger | Log operation | Result |
|---|---|---|
| Submit | stop focus-end timer · close focus row with details, kind stays `focus` · write new open row `start=now, kind=normal`, empty | → ACTIVE-normal; interval starts; engagement resumes fresh |
| Skip / Focus mode | **hidden** | n/a |
| View dashboard / close / Esc | none | popup closes; **focus continues untouched**, timer still running, engagement still suspended |
| Timeout (60 s) | stop focus-end timer · close focus row, kind stays `focus`, `notes = "window timed out"` · **no new row** | → INACTIVE; engagement resumes fresh |

### Check-in popup — `EXIT_PROMPT`

| Trigger | Log operation | Result |
|---|---|---|
| Submit | close open row with details, kind unchanged · **no new row** | app exits |
| Skip | delete the open row | app exits |
| View dashboard / close | none | quit cancelled; Dashboard shown |
| Timeout (60 s) | close open row, `notes = "window timed out"` | app exits |

### Focus popup — variant A (nothing open)

| Trigger | Log operation | Result |
|---|---|---|
| Begin focus | write open row: `start=now, kind=focus`, empty | → ACTIVE-focus; focus-end timer armed; engagement **suspended**; shell hides |
| Check in regularly | write open row: `start=now, kind=normal`, empty | → ACTIVE-normal; interval starts; engagement reset |
| Dismissed | none | stay INACTIVE |

### Focus popup — variant B (a row is open)

| Trigger | Log operation | Result |
|---|---|---|
| Begin focus | close open row: `end=now` + details, kind unchanged · write new open row `start=now, kind=focus`, empty | → ACTIVE-focus; interval stops; focus-end timer armed; engagement suspended |
| Check in regularly | none yet | close focus popup; open Check-in popup (`INTERVAL`) with the typed values pre-filled |
| Dismissed | none | stay ACTIVE-normal, row untouched |

### Floating shortcut

| State when activated | Result |
|---|---|
| INACTIVE | Start-logging popup |
| ACTIVE-normal | Check-in popup, `OFF_CYCLE` |
| ACTIVE-focus | Check-in popup, `FOCUS_INTERRUPT` — **focus-end timer keeps running** |
| Any popup already open | no-op (never stack popups) |

### Summary of log writes

```
WRITE open row  ← Start logging (dashboard or start-logging popup)
                ← Focus popup A: "Begin focus" (kind=focus)
                ← Focus popup A: "Check in regularly" (kind=normal)
                ← Focus popup B: "Begin focus", after closing the previous row
                ← Check-in Submit  (INTERVAL / OFF_CYCLE / FOCUS_END / FOCUS_INTERRUPT)
                ← Check-in Timeout (INTERVAL / OFF_CYCLE only)

CLOSE open row  ← Check-in Submit  (any context) — details filled, kind preserved
                ← Check-in Timeout (any context) — notes = "window timed out",
                                                   kind preserved, no category/project
                ← Focus popup B "Begin focus"
                ← Exit prompt Submit / Timeout

DELETE open row ← Check-in Skip (INTERVAL / OFF_CYCLE only)
                ← Exit prompt Skip
                ← Engagement timer firing

APPEND any date ← Manual entry save (kind=manual)
```

---

## 8. Surfaces

### 8.1 Shell window

One persistent main window, roughly 880×600, minimum ~740×480, resizable, centred on
first show.

**Title bar:** logo badge · title + subtitle (both change per pane) · light/dark toggle.

| Pane | Title | Subtitle |
|---|---|---|
| Dashboard | LogIT | ready when you are |
| Manual entry | Manual entry | retroactive logging |
| Analytics | Analytics | last 7 days |
| Categories | Categories | activity buckets |
| Projects | Projects | optional groupings |

**Sidebar:** five navigation items in order — Dashboard, Manual entry, Analytics,
Categories, Projects — each with an icon; the selected one is visually distinct. Below a
divider, a visually de-emphasised **Quit**. Focus mode is deliberately *not* in the
sidebar; it is a button on the Dashboard.

**Theme toggle** appears in the title bar of every window including popups. Flipping it
anywhere flips it everywhere immediately and saves the choice.

**The shell is on-demand, not persistent-on-screen** *(revised 2026-08-17, user decision —
supersedes the original "re-shows when the popup closes" rule)*. It hides when a popup takes
the foreground **and when a session starts** (Start logging, Begin focus), and it does **not**
come back on its own when a popup closes. It returns only when explicitly summoned: `View
dashboard` in any popup, `Submit and view dashboard`, a save error the user must see, a
cancelled quit, or launching the app. The floating shortcut is the always-available way back.

### 8.2 Dashboard pane

Two looks, chosen by whether a row is open.

**Idle look (INACTIVE):**

- Status line: `NOTHING LOGGED YET TODAY`, or `N ENTRIES TODAY · H.Hh · last logged HH:MM`.
- Greeting sized as a heading: "Good morning." before 12:00, "Good afternoon." before
  17:00, "Good evening." after.
- Date line: short weekday · day · short month.
- **Start logging** (primary, wide) and **Focus mode** (secondary) buttons.
- `CHECK IN EVERY` — the interval chips (10/15/20/30/45/60), current one selected;
  choosing one saves immediately.
- One-line hint naming the current interval.
- `LAST 7 DAYS` panel: a mini stacked-bar sparkline, one bar per day, segments coloured
  by category, today's label bold; header shows `total h · avg h/d`.

**Active look (a row is open):**

- **NOW card:** `NOW` tag; a category-coloured dot; category name; project name; and
  `started HH:MM · Xh YYm elapsed`, ticking every second. On the right,
  `NEXT CHECK-IN`, the wall-clock time, and a live `in Xm YYs` countdown.
- **Today's timeline:** header `TODAY · N ENTRIES` and total hours; the 8 most recent
  entries, each as `HH:MM–HH:MM` · colour bar · category · project · duration in
  minutes. The open row shows an empty end. Empty state: "No entries yet today."
- **Log activity** (primary) and **Focus mode** buttons.
- Right column: the same 7-day sparkline panel, plus the interval chips panel.

Both looks refresh whenever the log changes (any submit, skip, timeout, manual save) and
whenever the pane becomes visible.

### 8.3 Check-in popup

Fixed width ~400 px, centred, always on top, **not modal** — the user can ignore it.

| Element | Behaviour |
|---|---|
| Title | "What are you up to?" with a subtitle showing the context and the current time |
| Countdown ring | 28 px circular ring, 60 → 0, arc shrinks clockwise, remaining seconds in the centre; firing it takes the context's timeout path |
| Error banner | Hidden until a save fails; amber, dismissible, wraps long text |
| `CATEGORY` | Type-ahead combo over the category library; free text allowed; starts empty |
| `PROJECT` | Same, over projects |
| `WHAT WAS DONE` | Multi-line notes, optional, placeholder invites a one-liner |
| Switch to focus mode | Dashed inline button; carries the typed values into the focus popup |
| Footer | `View dashboard` (left) · `Skip` · `Submit` (primary). Skip is hidden in the two focus contexts |

**Field rules:** Submit requires both category and project. If either is empty, show an
inline error naming the missing field and do not write anything. Notes are optional. Any
new category/project typed is added to the library on submit.

The popup never closes itself on Submit — the controller closes it only after the write
succeeds, so a failure leaves the user's text on screen.

Pressing Esc or the system close button dismisses the popup and opens **nothing** — the
shell appears only via the explicit `View dashboard` / `Cancel exit` buttons *(revised
2026-08-17, user decision: while the timer runs, nothing is on screen but the shortcut)*.
Dismissal is disabled in `FOCUS_END`. Log effects of dismissal are unchanged per §7.

### 8.4 Focus popup

Same width and framing. Two pages inside one window.

**Form page**

| Field | Behaviour |
|---|---|
| `START` | Pre-filled with now, editable, `HH:MM` |
| `END` | Empty, `HH:MM`, required to begin |
| Duration hint | Live "Duration 1h 30m" as the two times change; blank when invalid |
| `CATEGORY` / `PROJECT` | Present in variant B (describing the block being closed); absent in variant A |
| Notes | Backward-looking: what was accomplished in the block being closed. (Variant A has none — there's nothing to close.) |
| Info line | "Periodic check-ins pause until HH:MM." |
| Footer | duration readout · `Check in regularly` · `Begin focus` (primary) |

**Live page** — shown when the user re-opens the window during a running session:

- `POPUPS SUPPRESSED` label.
- Large `HH:MM:SS` countdown to the scheduled end, ticking every second.
- `ends at HH:MM`.
- Progress bar with `start · elapsed · percent · end` beneath it.
- A card repeating what the session is for.
- Footer: `End session`, which ends focus immediately (equivalent to a
  `FOCUS_INTERRUPT` submit path).

Closing the live page (Esc, close button) does **not** end the session.

### 8.5 Start-logging popup

Minimal popup shown when the interval fires while INACTIVE. Content: current time,
a short prompt, and four actions — `Start logging`, `Focus mode`, `View dashboard`,
`Skip` — plus the same 60 s countdown ring. See §7 for effects.

### 8.6 Manual entry pane

Two columns.

**Left — the form:**

| Field | Default | Validation |
|---|---|---|
| `DATE` | today, `YYYY-MM-DD` | must parse as a real date |
| `START` | now, `HH:MM` | 00:00–23:59 |
| `END` | empty, `HH:MM` | 00:00–23:59, and strictly after start |
| `CATEGORY` | empty | **required** |
| `PROJECT` | empty | optional |
| `NOTES` | empty | optional |

A live footer shows the computed duration and states that the row saves with kind
`manual`. `Save entry` validates everything at once and lists every problem in a single
inline error. On success it clears category/project/notes but keeps date and times, so
consecutive back-fills are fast.

**Right — recent manual entries:** up to 10 rows with kind `manual` from the last 14
days, newest first, each showing `MM-DD`, `category · project`, and the time range.
Scrollable. Empty state: "No manual entries yet."

### 8.7 Categories and Projects panes

Structurally identical; one manages categories, the other projects.

- Header: name, one-line description ("Top-level buckets shown in every check-in." /
  "Optional grouping under categories."), and a pill showing the count.
- Add row at the top: a text field plus an **Add** button that is disabled until the
  field is non-empty; Enter also commits. Adding a duplicate is a no-op.
- One row per item: colour dot · name (truncated if long) · hours logged in the last 7
  days · proportional usage bar · percentage of that 7-day total · remove button.
- Removing an item takes it out of the library. **It does not touch any logged rows** —
  history is never rewritten, so past entries keep their category name.
- Changes take effect immediately everywhere (combos, colours, dashboards).
- Empty state: "No categories yet. Add one above."

### 8.8 Analytics pane

- Range selector: `7d` / `14d` / `30d`, defaulting to 7.
- KPI tiles, four across:

| Tile | Value |
|---|---|
| Tracked | total logged hours in range |
| Avg / day | tracked ÷ number of days in range (not ÷ days with data) |
| In focus | hours from rows with kind `focus` |
| Top | category with the most hours, with its hour count as a subtitle |

- Chart: one stacked bar per day, segments coloured by category, y-axis gridlines at 0 /
  half / max (labelled with one decimal below 1 h, whole hours above), x-axis labelled
  with the weekday initial, today bold. Days with no data draw a flat baseline stub.
- Legend: the five categories with the most hours in range, each as a colour dot plus name.
- Everything recomputes from the log files on every range change and every time the pane
  becomes visible. There is no cache to invalidate.

### 8.9 Floating shortcut

- Small always-on-top square (~84 px, generously rounded), showing the app logo,
  positioned at the top-right of the primary screen by default.
- Draggable anywhere; clamped so it can never leave the screen.
- **Double-click** activates it (single clicks and drags must not trigger logging).
- A thin progress ring just outside the square shows time until the next scheduled event.
- Four visual states, each with its own tooltip:

| State | Ring | Tooltip |
|---|---|---|
| normal (ACTIVE) | progress toward the next check-in, accent colour | "Tap to check in" |
| focus | progress toward the focus end, warm accent, plus a focus badge | "Focus active — tap to interrupt" |
| inactive | dim, no progress | "No open block — tap to start logging" |
| paused (engagement fired) | dim dashed ring, whole button faded | "Paused — tap to resume" |

### 8.10 Success toast

After any successful save, a compact self-dismissing confirmation appears, naming what
was logged (`Logged: Category - Project`), and disappears after 3 seconds. It never
blocks input and never requires acknowledgement.

---

## 9. Derived numbers

Every computed figure in the app follows these rules. They must be implemented once and
shared, not re-derived per screen.

**Duration of an entry (minutes)**

```
if start or end is empty        → 0   (open rows and unclosed rows contribute nothing)
otherwise                       → (end_hour*60 + end_min) − (start_hour*60 + start_min)
if the result is negative       → 0   (never subtract time)
```

**Day total (hours)** = sum of all entry durations that day ÷ 60. Overlaps are not
detected or corrected; the log is treated as authoritative.

**Elapsed time of the open row** = now − start. If start is later than now (the block
began before midnight), treat start as belonging to yesterday. Format `Xh YYm`, or `Ym`
under an hour.

**Countdown to next check-in** = next scheduled fire − now, shown as `in Xm YYs`, or
`in Xh YYm` beyond an hour, or `now` at zero.

**7-day / 14-day / 30-day rollups** — walk backwards day by day from today inclusive,
read each day's file (missing files count as a zero day), and bucket durations by
category. Zero days must appear in charts as empty slots, not be skipped.

**Category usage in the editor panes** — hours per name over the last 7 days, and each
name's percentage of the sum over the names currently in the library.

**Rows that must not break any calculation:** open rows (no end), timed-out rows (no
category/project), legacy rows with kind `inactive`, rows whose category was later
removed from the library, and rows with free-text categories that were never in the
library at all.

---

## 10. Validation, failure, and recovery

### Input validation

| Form | Rule |
|---|---|
| Check-in Submit | category **and** project required; notes optional |
| Focus begin | end time required and must parse as `HH:MM`; end must be after start |
| Manual save | date parses; start and end are valid times; end after start; category required |
| Interval | only the six allowed values are selectable; a stored illegal value snaps to the nearest legal one |

Errors are shown inline, next to or above the form, naming the specific problem. Nothing
is written until the whole form is valid. A validation failure never closes the window
and never loses typed text.

### Save failure

The log file can be locked by a spreadsheet program. Handle it like this:

1. On a write failure, retry a few times immediately with a short backoff.
2. If it still fails, the window stays open and shows an amber banner:
   *"Save failed (attempt N of 3). Close any app that has the log file open, then submit
   again."*
3. Each further press of Submit is another attempt.
4. After the third failed attempt, show a final banner stating clearly that the entry was
   **NOT** saved, and **echo the user's exact input back to them** (category, project,
   notes; for focus, also the time range) so they can re-enter it manually.
5. Never close the window, never discard the text, never claim success.

If a focus session fails to save, the app must not pretend the session is running: it
falls back to INACTIVE and the shortcut returns to its idle look.

### Confirmations

Quitting always asks for confirmation. Deleting a category or project does not — it's a
library change, not a data change, and history is untouched.

---

## 11. Edge cases

| Situation | Required behaviour |
|---|---|
| **Midnight crossing** | Times are stored without dates, so a block that starts at 23:45 and ends at 00:10 spans two files. Duration maths must not produce a negative or crash; treat a start later than the end as belonging to the previous day for display, and write the row into the day of its start. |
| **Focus end time already in the past** | Reject at validation ("End must be after start"); never arm a timer with a negative delay. |
| **Focus end time crosses midnight** | Allowed; the countdown targets the next occurrence of that clock time. |
| **App restarted with an open row from a previous run** | Leave the row exactly as it is. Do not auto-close, auto-fill, or delete it. Start fresh in INACTIVE. |
| **Two popups would open at once** | Never stack. If a popup is already open, additional triggers are no-ops. |
| **Log file missing or empty** | Treated as a day with no entries. Never an error. |
| **Log file locked** | See §10. |
| **Day rollover while the app runs** | Writes go to the file for the current date at the moment of writing. A block open across midnight closes in the new day's file if that's where its row lives; do not attempt to split it. |
| **Category removed while it's on the open row** | The open row keeps its text; the dashboard still renders it, falling back to a default colour if needed. |
| **User types a category that doesn't exist** | Accepted; added to the library on submit. |
| **Interval changed mid-cycle** | Save immediately and re-arm the timer from now with the new interval. |
| **Popup ignored for 60 s** | Take the context's timeout path. Timeouts never count as engagement. |
| **Screen resolution changed / shortcut off-screen** | Clamp the shortcut back into the visible area. |
| **Legacy rows with kind `inactive`** | Read and count normally; never write new ones. |

---

## 12. Non-goals

Explicitly out of scope. Do not add these while rebuilding.

- Accounts, login, sync, multi-device, multi-user, sharing.
- Any cloud service, telemetry, or crash reporting.
- A database. The plain daily files are the storage layer, permanently.
- Editing or deleting historical entries from inside the app (the user edits the files
  directly if they must). The only destructive operation is deleting the *open* row.
- Notifications outside the app's own popups; no system tray menu, no OS notification
  centre integration.
- Idle detection from OS activity, keyboard/mouse hooks, or app-usage tracking. The
  engagement timer is the only inactivity mechanism, and it observes only in-app actions.
- Export formats, report generation, or an API.
- Themes beyond light and dark. No colour picker, no custom palettes.
- Intervals outside the six allowed values. Long sessions are what focus mode is for.

---

## 13. Acceptance checklist

The rebuild is functionally complete when all of these pass by hand:

**Logging cycle**
- [ ] Start logging writes a row with a start time and empty end and details.
- [ ] Check-in Submit closes that row with the typed details and opens a new empty one.
- [ ] Check-in Skip removes the open row entirely and leaves no replacement.
- [ ] Check-in timeout closes the row with `window timed out` in notes and opens a new one.
- [ ] Submitting with a blank category or project shows an error and writes nothing.
- [ ] Dismissing a check-in writes nothing and leaves the open row untouched.

**Focus**
- [ ] Beginning focus from idle writes a `focus` row and suppresses check-ins.
- [ ] Beginning focus with a block open closes that block first, then opens the focus row.
- [ ] The focus row's kind stays `focus` when it is finally closed.
- [ ] Activating the shortcut during focus opens the interrupt popup and the session keeps
      running until Submit or timeout.
- [ ] Dismissing the interrupt popup leaves the session running.
- [ ] The focus-end popup cannot be dismissed and has no Skip.

**Engagement**
- [ ] With an open row and no interaction for an hour, the open row disappears and popups stop.
- [ ] Popup timeouts do not postpone that hour.
- [ ] An hour of focus does not trigger it; the hour restarts when focus ends.

**Manual and libraries**
- [ ] A manual entry for a past date lands in that date's file with kind `manual`.
- [ ] A manual entry with an end before its start is rejected with a visible message.
- [ ] Adding a category makes it available in every combo immediately.
- [ ] Removing a category does not alter any logged row.
- [ ] A category keeps the same colour across restarts.

**Reading**
- [ ] Analytics totals match hand-computed totals from the raw files.
- [ ] A file containing legacy `inactive` rows renders without error.
- [ ] Days with no file appear as empty slots in the charts.
- [ ] The dashboard's elapsed time and countdown update every second and stop when hidden.

**Resilience**
- [ ] With the day's file locked by another program, three Submit presses produce
      attempt-count banners and a final banner echoing the typed text; nothing is lost.
- [ ] Restarting with an open row from a previous run leaves that row untouched.
- [ ] Quitting with an open row prompts, and each choice does what §7 says.

---

## Appendix A — Suggested build order

Each step should be independently verifiable before the next begins.

1. **Log layer.** Read/append/close/delete on daily files, both folder layouts, locking
   retries. Verifiable with a handful of files and no UI at all.
2. **Settings layer.** Load, snap illegal intervals, save on change, colour assignment.
3. **Scheduler and state machine, headless.** The three states, five contexts, and all
   four timers, driven by injected fake time. This is where the real complexity lives —
   test it exhaustively before drawing a single pixel.
4. **Shell + Dashboard.** Both looks, live tick, the real logging cycle end to end.
5. **Check-in popup**, all five contexts.
6. **Focus popup**, both variants and the live page.
7. **Start-logging popup.**
8. **Manual entry pane.**
9. **Categories / Projects panes.**
10. **Analytics pane.**
11. **Floating shortcut**, four states and the progress ring.
12. **Polish:** theme toggle across every surface, toast, error banners, the acceptance
    checklist end to end.

Steps 1–3 carry the behaviour. Steps 4–11 are presentation over an already-correct core;
if the state machine is right, none of them can corrupt the log.

---

## Appendix B — Differences from the old build

The shipped build predates the locked logging design. This spec describes the target;
here is what the old build did instead, so nothing is lost in translation.

| Area | Old build | This spec |
|---|---|---|
| When details are collected | The check-in popup's details described the block *about to open*; a row was written with its category/project already filled and an empty end time | Details describe the block being **closed**; new rows always open empty |
| Timeout behaviour | Wrote a new row with kind `inactive` and category `Break / Inactive` | Closes the open row with `window timed out` in notes; kind `inactive` is never written again |
| Skip | Closed the open row's end time and left it in place | **Deletes** the open row |
| Focus session row | Written up-front with both start *and* end already filled, before the session ran | Opened empty at start, closed when the session actually ends |
| Focus field | Forward-looking `GOAL` ("what's the win?") | Backward-looking notes about the block just completed; the goal field is dropped |
| Focus interrupt | Activating the shortcut during focus ended the session immediately | Opens an interrupt popup; the session ends only on Submit or timeout |
| Engagement timer | Did not exist — an abandoned session ran forever | 1-hour dead-man's switch, suspended during focus |
| Popup contexts | One popup with one behaviour | Five contexts with different buttons and timeout semantics |
| Start-logging popup | Did not exist; the interval timer did nothing while idle | Fires while INACTIVE |
| Exit with an open row | Silently stamped the end time and quit | Prompts with the `EXIT_PROMPT` context |
| Required fields | None on check-in | Category and project both required |
| Shortcut states | Two (normal, focus), colour-swap only | Four, with a progress ring |
| Log folder layout | `AppLog/YYYY/MM-Month/CSVs/YYYY-MM-DD.csv` | `CSVs/` level removed; old layout still readable |
| Interval options | Included values outside the allowed set in places | Exactly 10/15/20/30/45/60 everywhere |

Two further notes for the rebuild:

- **The old build read files by rebuilding paths in four separate places** (dashboard,
  analytics, editors, manual entry) rather than going through the log layer. Route every
  read through one component this time; the date-range walk is the only thing that should
  know the folder shape.
- **Interval-scheduling refinements** (wall-clock alignment, 30-second early fire, grace
  period after a manual log) were designed but never built. §6 states the rules; they are
  safe to defer, and safe to add later without touching the state machine.
