# UPDATES.md — decision log (repo root)

Reverse-chronological. Each entry = what changed, why, and what it invalidates. Newest on top.
This is the "what's true now" file; traps and dead ends live in `GOTCHAS.md`.

---

## 2026-08-17 (newest) — rebuild started; spec written; stack deliberately NOT chosen

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
