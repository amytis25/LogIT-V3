// main.js
// Description: the app entry. Chooses the data root (Documents\LogIT — the
//              only place that knows it), instantiates the layers, wires the
//              core to the window manager, and owns app lifecycle: a background
//              app that does NOT quit when windows close — only the core's
//              quit paths end it.
// Inputs:  none (Electron app events)
// Outputs: a running LogIT
// Created: 2026-08-17

import { app } from 'electron';
import path from 'node:path';
import { Core } from './core/core.js';
import { registerIpc } from './ipc.js';
import { LogStore } from './log/log_store.js';
import { Queries } from './queries.js';
import { SettingsStore } from './settings/settings_store.js';
import { WindowManager } from './windows.js';

// Single instance — a second launch just focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let windows = null;
  let quitting = false;

  app.on('second-instance', () => windows?.showShell('dashboard'));

  // Background app: closing every window must not exit (GOTCHAS "Closing the
  // last window must not quit the app").
  app.on('window-all-closed', () => { /* stay alive; core owns quitting */ });

  app.whenReady().then(() => {
    // The data root: visible, greppable, survives reinstalls (UPDATES 2026-08-17).
    const dataRoot = path.join(app.getPath('documents'), 'LogIT');

    const log = new LogStore(dataRoot);
    const settings = new SettingsStore(dataRoot);
    windows = new WindowManager();
    const clock = () => Date.now();
    const core = new Core({
      log, settings, clock,
      timers: { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
      surface: windows,
      quitApp: () => { quitting = true; app.exit(0); }
    });
    windows.attachCore(core);
    const queries = new Queries({ log, settings, clock });
    registerIpc({ core, queries, windows });

    windows.createShell();
    windows.createShortcut();
    core.start();
  });

  // Cmd+Q / system shutdown: route through the same exit-prompt rules.
  app.on('before-quit', (e) => {
    if (!quitting) {
      e.preventDefault();
      windows?.core?.quitRequest();
    }
  });
}
