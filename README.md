# LogIT

A single-user, local-only desktop time logger. It runs all day in the background and periodically asks
**"what were you just doing?"** — the answer is appended to a plain-text daily CSV you own outright.
No account, no cloud, no database. The log is the product.

Behaviour is specified in `FUNCTIONAL_SPEC.md`; working rules in `CLAUDE.md`; decisions in `UPDATES.md`.

## Your data

Everything lives in **`Documents\LogIT\`** (on Windows this may resolve to `OneDrive\Documents\LogIT\`
when Documents is OneDrive-redirected):

```
Documents\LogIT\
  settings.json                     interval, theme, libraries, colours
  AppLog\2026\08-August\2026-08-17.csv    one file per day, plain CSV
```

The files are plain UTF-8 CSV — greppable, Excel-openable, yours. The app never deletes a closed row.

**Migrating from the old build:** copy the old `AppLog` folder (from the old LogIT directory) into
`Documents\LogIT\`. The legacy layout with the extra `CSVs\` subfolder is read in place — no
conversion happens, and new days are written in the flat layout.

## Running from source

```
npm install
npm test          # headless suites: log layer, settings, derived numbers, state machine
npm start         # build the renderer and launch the app
```

## Building executables

```
npm run dist
```

- **On Windows** this produces `release\LogIT Setup 3.0.0.exe` (installer) and
  `release\LogIT 3.0.0.exe` (portable — single file, no install).
- **On macOS** the same command produces `release\LogIT-3.0.0.dmg`. Mac binaries can only be built on
  a Mac — cross-building from Windows is not possible. Clone the repo on the Mac, `npm install`,
  `npm run dist`.

## Layout

```
src/main/       Electron main process: core state machine, scheduler, log layer,
                settings, window manager — no UI knowledge, tested headless
src/shared/     constants and derived-number maths, shared by main + renderer
src/preload/    the narrow IPC bridge exposed to windows
src/renderer/   React UI: shell + panes, three popups, floating shortcut, toast
tests/          node:test suites (run with `npm test`)
```
