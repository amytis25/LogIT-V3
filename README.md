# LogIT

A single-user, local-only desktop time logger. It runs quietly in the background and periodically
asks one question — **"what were you just doing?"** — and appends your answer to a plain-text daily
CSV that you own outright.

No account. No cloud. No database. No telemetry. **The log is the product**, and it is just files on
your disk.

Three ways time gets recorded:

| | |
|---|---|
| **Check-ins** | Every *N* minutes the app asks what you just did, closes that block and opens a new one |
| **Focus sessions** | Declare a block of deep work with an end time; check-ins go quiet until it ends |
| **Manual entries** | Back-fill any past date after the fact |

Plus a dashboard, 7/14/30-day analytics, and small editors for your category and project lists.

---

## Install (Windows)

Grab the latest from the [**Releases**](https://github.com/amytis25/LogIT-V3/releases) page:

- **`LogIT Setup <version>.exe`** — normal installer, adds a Start-menu entry.
- **`LogIT <version>.exe`** — portable single file; just run it, nothing is installed.

> **Windows will warn you the first time.** The download isn't code-signed (a signing certificate
> costs a few hundred dollars a year), so SmartScreen shows *"Windows protected your PC."* Click
> **More info → Run anyway**. If you'd rather not trust a stranger's binary, build it yourself from
> source below — it takes about two minutes.

**Using it:** the app starts on the dashboard. Press **Start logging** and the window gets out of
your way, leaving a small floating button in the corner of your screen. Double-click that button any
time to log what you just did. The **X** on any window just closes that window — only **Quit** in the
sidebar actually exits the app.

## Install (macOS)

There's no prebuilt Mac download, because Mac apps can only be built on a Mac. Building one takes
two commands:

```bash
git clone https://github.com/amytis25/LogIT-V3.git
cd LogIT-V3
npm install
npm run dist
```

This produces **`release/LogIT-<version>.dmg`** and a `release/mac/LogIT.app`. Open the `.dmg` and
drag LogIT to Applications.

Because the app isn't notarised by Apple, macOS will refuse to open it on the first try
(*"LogIT can't be opened because Apple cannot check it for malicious software"*). Right-click the
app → **Open** → **Open**, and macOS remembers the choice. You only do this once.

Requires [Node.js](https://nodejs.org) 18 or newer.

> **Honesty note:** LogIT is built and used daily on Windows. The macOS build is configured and the
> code has no Windows-specific logic in it, but nobody has actually run it on a Mac yet. If you are
> the first and something is off, please open an issue.

## Run from source (any platform)

```bash
npm install
npm test     # headless suites: log layer, settings, derived numbers, state machine
npm start    # build the renderer and launch the app
npm run dist # package installers/executables for the current platform
```

`npm run dist` on Windows gives you the installer and the portable `.exe`; on a Mac it gives you the
`.dmg`. Cross-building a Mac binary from Windows is not possible — that's an Apple restriction, not
a limitation of this project.

---

## Your data

Everything lives in **`Documents\LogIT\`** by default (on Windows this often resolves to
`OneDrive\Documents\LogIT\` when Documents is OneDrive-redirected):

```
Documents\LogIT\
  settings.json                             interval, theme, libraries, colours
  AppLog\2026\08-August\2026-08-17.csv      one file per day, plain CSV
```

Each row is `start_time,end_time,mode,category,project,additional_notes` with `HH:MM` times. Plain
UTF-8 CSV — greppable, Excel-openable, yours. The app never deletes a closed row; the only thing it
can ever remove is the single *unfinished* block.

**You can move the logs.** The dashboard has a **LOG FOLDER** field at the bottom — point it
anywhere (a synced folder, another drive). Existing files are deliberately *not* moved, so if you
want your history to follow, move the old `AppLog` folder yourself. `settings.json` always stays in
the default location.

**Migrating from an older LogIT:** copy the old `AppLog` folder into `Documents\LogIT\`. The legacy
layout with the extra `CSVs\` subfolder is read in place — nothing is converted or rewritten.

---

## How this was built — an honest AI disclaimer

The owner asked for this section to be here, and it should be, because you're deciding whether to
run a stranger's software.

**Written by Claude** (Anthropic's Claude Opus, across a single working session): essentially all of
the code that actually runs — roughly **5,600 lines** across `src/` (the state machine, scheduler,
log layer, settings, and every screen), `tests/` (~900 lines of headless tests), the icon generator,
and the build configuration. If there is a bug in this app, a language model wrote it.

**Specified, designed, directed and reviewed by [@amytis25](https://github.com/amytis25)** — the
parts that decide what the software actually *is*:

- The idea, and the product judgement throughout.
- **`FUNCTIONAL_SPEC.md`** — ~1,100 lines pinning down every behaviour, state, timer, popup context
  and edge case — plus **`CLAUDE.md`**, the engineering rules the model was held to. Both existed
  *before* any code was written. The implementation was built to the spec, not the other way round.
- The entire **visual design** (`design_handoff/`): layout, typography, colour, and every screen,
  prototyped ahead of implementation.
- Every correction, from running the real app in daily use: the dashboard must vanish once logging
  starts and only come back when asked; the **X** must close a window rather than quit the app; the
  floating button was twice the size it should be; the executable needed the app's own icon; the log
  folder had to be user-choosable.

So: a person specified it, designed it, used it daily, and corrected it in rounds against a running
build; a model did the typing. The judgement is hers, the typos are the model's.

The development history is all here if you want to read it — `UPDATES.md` records every decision and
why, and `GOTCHAS.md` records the traps (including a couple of genuinely embarrassing ones).

---

## Project layout

```
src/main/       Electron main process: the one state machine, scheduler, log layer,
                settings, window manager — no UI knowledge, tested headless
src/shared/     constants and derived-number maths, shared by main + renderer
src/preload/    the narrow IPC bridge exposed to windows
src/renderer/   React UI: shell + panes, three popups, floating shortcut, toast
tests/          node:test suites (npm test)
docs/PLAN.md    the phased implementation plan
design_handoff/ read-only visual reference the UI was built from
```

`FUNCTIONAL_SPEC.md` is the source of truth for behaviour; `CLAUDE.md` holds the working rules;
`UPDATES.md` is the decision log, newest first.

## Status

Working and in daily use, but it's a personal project shared with friends — not a supported product.
It has no auto-update, no crash reporting, and no way to phone home. If it breaks, your data is
still sitting there in plain CSV files, which was rather the point.

## License

[MIT](LICENSE) — use it, change it, share it, build your own thing from it. It comes with no
warranty of any kind.
