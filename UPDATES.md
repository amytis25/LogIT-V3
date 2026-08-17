# UPDATES.md — decision log (repo root)

Reverse-chronological. Each entry = what changed, why, and what it invalidates. Newest on top.
This is the "what's true now" file; traps and dead ends live in `GOTCHAS.md`.

---

## 2026-08-17 (newest) — first user feedback: shell is on-demand; head-text leak hardened

**Change.**

- **The shell no longer sticks around once logging starts.** User decision after first real use:
  pressing Start logging (or Begin focus) hides the main window, and closing a popup no longer
  auto-restores it. The dashboard returns only via `View dashboard`, `Submit and view dashboard`,
  a save error, a cancelled quit, or app launch; the shortcut is the way back in.
  `FUNCTIONAL_SPEC.md §8.1` and the §7 rows are updated in this same change.
- **The `<head>` render leak is hardened away.** The user's screenshot showed the popup rendering the
  page title + reset CSS as visible text above the panel. Not reproducible under CDP inspection of the
  same packaged build (all windows parse standards-mode with an intact head), so the mechanism is
  unconfirmed — instead the possibility is removed: index.html now carries no inline `<style>` (reset
  lives in `src/renderer/reset.css`, bundled) and no markup before `<html>`. Worst case is now zero
  visible characters.
- **Countdown ring is DPI-proof:** the seconds label sits in flex flow with the ring absolutely
  positioned behind it, so display scaling can't separate them (user runs a scaled display; CDP
  screenshots render at logical resolution and hid this).

**Invalidates:** the §8.1 "re-shows when the popup closes" behaviour and the previous entry's claim
that the shell/popup hand-off was final.

**Open.** If the head-text block ever reappears (now it could only be blank space), grab it with
`--remote-debugging-port` per GOTCHAS and record the DOM; the root cause was never observed directly.

---

## 2026-08-17 — end-to-end build complete; Windows executables produced

**Change.** The full app exists and is packaged. All five phases of `docs/PLAN.md` are done:

- **Verified by automated tests (60 passing, `npm test`):** the frozen CSV contract both ways (quotes,
  commas, newlines, CRLF, literal empties), both folder layouts, open-row-by-empty-end scan, atomic
  rewrite + delete, locked-file retry; settings snapping / colour stability / library growth; every
  derived-number rule in SPEC §9; and the whole state machine — every row of the §7 event→effect table,
  all five check-in contexts, focus begin/end/interrupt/midnight-crossing, engagement (timeouts do NOT
  postpone it; focus suspends it; PAUSED resumes on user action), never-stack, restart-on-dealt-with,
  the §10 save-failure ladder (attempt counts, echo at 3, popup never closes), and all four quit paths.
- **Verified against the live app** (CDP-driven, results read from the actual files): start → check-in
  submit closes the row and opens a new one; libraries + colours grow and persist; Skip removes the open
  row; manual entry lands in a past date's file; toast fires; the shell, check-in popup, focus popup B,
  and shortcut render matching the design handoff (screenshots taken).
- **Packaged:** `release/LogIT Setup 3.0.0.exe` (installer) and `release/LogIT 3.0.0.exe` (portable),
  both launched and smoke-tested. Mac dmg builds from the same config by running `npm run dist` on a Mac.

**Not yet exercised by hand:** the interval popup appearing over other apps during a real workday, popup
timeout while genuinely away, engagement firing after a real hour, day rollover at midnight, and the
Excel-holds-the-file-locked banner flow (its logic is unit-tested; the real-Excel walk isn't). These are
the §13 checklist items that need a day of real use.

**Invalidates:** nothing; this completes the plan of record.

**Open.**
- **User: copy old `AppLog` into `Documents\LogIT\`** (note: Documents is OneDrive-redirected on this
  machine — the real path is `OneDrive\Documents\LogIT`). The legacy `CSVs/` layout is read in place.
- **User: walk FUNCTIONAL_SPEC §13 by hand** during a real day of use; file anything odd in GOTCHAS.
- **User (needs a Mac): run `npm run dist` on macOS** for the dmg.

---

## 2026-08-17 — stack chosen: Electron + React (plain JS); build begins

**Change.** The stack is decided and implementation starts, end to end, per the user's request to build
from planning through a runnable executable.

- **Runtime: Electron.** The app is a background multi-window desktop app (persistent shell, three
  always-on-top popups, a frameless floating shortcut, a toast) that must not quit when the last window
  closes, on Windows *and* macOS. Electron gives all of that first-class from one codebase.
- **Renderer: React 18 + Vite.** The design handoff is already React components; the visual layer ports
  near-verbatim. One renderer bundle serves every window (window kind chosen by query param).
- **Language: plain JavaScript (ESM) with JSDoc contract blocks** per CLAUDE.md §6.2. No TypeScript —
  consistent with §8's "don't suggest type-checker adoption".
- **Tests: `node:test`** (built-in runner, zero dependencies). Log layer, settings, derived numbers, and
  the whole state machine + scheduler run headless with an injected fake clock.
- **Packaging: electron-builder.** Windows NSIS installer + portable exe are built on this machine. The
  same config carries `mac` targets (dmg/zip); building the mac artifact requires running the same
  command on a Mac — cross-building mac binaries from Windows is not possible. Documented in README.
- **Data root: `Documents\LogIT\`** containing `AppLog\` and `settings.json`. Chosen over AppData because
  "the log is the product" — it must be visible, greppable, and survive reinstalls. The log layer and
  settings layer receive this root by injection; nothing else knows it.
- **Legacy data: read-both, no migration.** Both folder layouts (`.../MM-Month/YYYY-MM-DD.csv` and legacy
  `.../MM-Month/CSVs/YYYY-MM-DD.csv`) are read in place; the app never moves or rewrites old files. New
  writes always use the new layout. Spec §3.1 allows either approach; not touching user files is the
  deliberately conservative pick.

**Spec-vs-design conflicts resolved (spec wins per precedence §2):**

- Design shows a `5m` interval chip; spec allows exactly 10/15/20/30/45/60. Six chips built.
- Design labels EXIT_PROMPT "no countdown"; spec §7 gives it a 60 s timeout path. Timeout implemented and
  the ring shown, same as other contexts.
- Design's editor palette has 7 colours; spec §3.2 says a fixed palette of 8. Eight used.
- Design's start-logging popup copy says Skip "silences prompts for the next hour"; spec says Skip just
  restarts the interval. Copy corrected to match behaviour.
- §6 scheduler refinements (wall-clock alignment, early fire, grace period) deferred, as the spec allows.

**Invalidates:** the previous entry's "no source files until the stack is chosen" hold.

**Open.**
- **Old data move. Owner: user.** Real logs live in `../LogIT/AppLog` (legacy layout). Copy that `AppLog`
  folder into `Documents\LogIT\` and the rebuild reads it as-is. The app does not do this automatically.
- **Mac executable. Owner: user (needs a Mac).** `npm run dist` on macOS from this repo produces the dmg.

---

## 2026-08-17 — rebuild started; spec written; stack deliberately NOT chosen

**Change.** New folder, starting from behaviour rather than from the old code. Two things exist:

- `FUNCTIONAL_SPEC.md` — the complete behavioural spec, written from a full read of the old build plus the
  locked V2 logging design. Implementation-independent by design: no language, framework, or class names.
  Contains the state model, five ASM charts, the master event→effect table, per-surface detail, derived-number
  rules, edge cases, non-goals, and a hand-testable acceptance checklist.
- `design_handoff/` — the visual reference (v2.0 + v2.1 prototypes). Look and layout only.

**Why a rebuild rather than a refactor.** The old build reached ~7,500 lines for an app that appends rows to a
text file, with three dead modules, two duplicated classes, five boolean flags standing in for three states,
and four separate places that reconstructed log file paths. The logging behaviour it implements is also the
*superseded* one (see below), so a refactor would have meant rewriting the core anyway, inside a structure we
were leaving.

**The spec describes the V2 logging cycle, not the old build's.** Where they disagree, V2 wins. The full
side-by-side is `FUNCTIONAL_SPEC.md` Appendix B; the load-bearing differences:

- Details describe the block being **closed**, not the one being opened. New rows open empty.
- Skip **deletes** the open row; it no longer closes it in place.
- Timeout closes the open row with `window timed out` in notes. `mode=inactive` is never written again
  (old files still contain it and must keep parsing).
- The focus row is opened empty at session start and closed when the session actually ends — not written
  up-front with both times already filled.
- Five check-in contexts (INTERVAL / OFF_CYCLE / FOCUS_END / FOCUS_INTERRUPT / EXIT_PROMPT), each with
  different buttons and different timeout semantics.
- New: the 1-hour engagement timer, the start-logging popup, the exit prompt, required category+project.

**Invalidates:** the old build's `ARCHITECTURE.md` (a pre-refactor snapshot), its phase-status tables, and
any plan that treated v2.0 → v2.1 → v2.2 as sequential sessions on the old codebase. The v2.2 scheduler
refinements (wall-clock alignment, 30 s early fire, grace period) survive as rules in `FUNCTIONAL_SPEC.md §6`
and are safe to defer.

**Open.**
- **The stack is not chosen. Owner: user.** No source files until it is, and the choice gets its own entry
  here plus a `## Stack` section in `CLAUDE.md`. The old build's stack is one candidate, not the default.
- The log folder layout drops the `CVSs/` level (`AppLog/YYYY/MM-Month/YYYY-MM-DD.csv`). Whether the app
  migrates old files once on first launch or just reads both layouts is undecided — spec allows either.
- Nothing has been built or run. Every acceptance-checklist item is unverified.

---

## Template for new entries

```
## YYYY-MM-DD — <one-line summary>
**Change:** what.
**Why:** reason / what forced it.
**Invalidates:** what old code, doc, or assumption this kills.
**Open:** anything still unresolved + who owns it.
```
