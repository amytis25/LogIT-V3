# LogIT rebuild — implementation plan

Written 2026-08-17, when the stack was chosen (see UPDATES.md). Behaviour source: `FUNCTIONAL_SPEC.md`.
Visual source: `design_handoff/`. Phases follow the spec's Appendix A build order; each phase ends with a
verification gate before the next begins.

## Module map

```
src/shared/constants.js    every named constant: intervals, timer periods, palette (8), CSV header,
                           folder patterns, timeout marker text. No literals anywhere else.
src/shared/derive.js       duration / elapsed / countdown / rollups / formatting (spec §9). The ONLY
                           copy of this maths; imported by main and renderer alike.
src/main/log/csv.js        RFC 4180 parse + serialize, CRLF, quoting both ways.
src/main/log/log_store.js  the log layer. Owns folder layout (new + legacy read), append / read day /
                           read range / update open row / delete open row / append to date. Retries on
                           locked files. Open row found by empty end_time scan, never "last line".
src/main/settings/settings_store.js
                           load with interval snapping, save-on-change, colour assignment, library growth.
src/main/core/core.js      the one state machine (INACTIVE / ACTIVE_NORMAL / ACTIVE_FOCUS) + every event
                           handler from spec §7. Effects go through an injected `surface` port
                           (showCheckin(ctx), showStartLogging(), showFocus(variant), closePopup(),
                           toast(text), quit(), refresh()). No UI imports. Clock + timers injected.
src/main/core/scheduler.js the four timers (interval, popup countdown, focus-end, engagement) built on an
                           injectable timer factory; single source of "when does the next popup fire".
src/main/windows.js        BrowserWindow management: shell, popup (one at a time), shortcut, toast.
src/main/ipc.js            wires renderer events → core events; broadcasts state snapshots.
src/main/main.js           entry: data root (Documents\LogIT), instantiate layers, app lifecycle.
src/preload/preload.js     contextBridge: `logit.on(state)` + `logit.send(event, payload)` + sync init.
src/renderer/              React: theme, icons, widgets, shell + 5 panes, 3 popups, shortcut, toast.
```

## IPC surface (renderer → main), mirroring spec §7 triggers

`start-logging`, `log-activity`, `open-focus`, `checkin-submit {category, project, notes}`,
`checkin-skip`, `checkin-dismiss`, `checkin-switch-focus {typed}`, `focus-begin {start, end, wrap?}`,
`focus-checkin-regularly {typed?}`, `focus-dismiss`, `focus-end-early`, `manual-save {date, start, end,
category, project, notes}`, `interval-change {minutes}`, `theme-toggle`, `nav {pane}`, `library-add/remove
{kind, name}`, `shortcut-activate`, `shortcut-moved {x, y}`, `quit-request`, `quit-cancel`, `user-action`
(engagement reset on button presses / nav).

Main → renderer: one `state` snapshot broadcast (state, open row, today's rows, settings, next-fire time,
popup context + deadline, focus session, paused flag, ranges for analytics on demand via `query` calls).

## Phases and gates

1. **Scaffold + log layer + tests.** Gate: `npm test` green on CSV round-trips, both layouts, locked-file
   retry, open-row scan, delete-last-row, midnight/legacy rows.
2. **Settings + derive + tests.** Gate: snapping, colour stability, growth rules, §9 numbers all green.
3. **Core + scheduler headless + tests.** Gate: every row of the §7 event→effect table asserted, the four
   timers, engagement semantics (timeout ≠ engagement), never-stack, restart-on-dealt-with.
4. **Electron shell + renderer surfaces.** Gate: app runs; manual walk of the logging cycle writes correct
   rows to a scratch data root (verified against the files, not the screen).
5. **Package + acceptance.** Gate: Windows exe built; README documents the Mac build; UPDATES closed out.

## Deliberate deferrals

- §6 scheduling refinements (alignment, early fire, grace) — spec marks them separable.
- Mac artifact itself — requires macOS; config ships ready.
