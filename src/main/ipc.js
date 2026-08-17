// ipc.js
// Description: the single bridge between renderers and the core. One 'event'
//              channel dispatches user triggers to core handlers (mirroring
//              SPEC §7); one 'query' channel serves read-only pane questions;
//              'state-sync' hands a fresh snapshot to a window that just loaded.
// Inputs:  { core, queries, windows } — wired in main.js
// Outputs: ipcMain handlers
// Created: 2026-08-17

import { ipcMain } from 'electron';

// Description: register every IPC route.
// Inputs:  deps — { core, queries, windows }
// Outputs: none
export function registerIpc({ core, queries, windows }) {
  ipcMain.on('state-sync', (e) => {
    e.returnValue = core.getState();
  });

  ipcMain.handle('event', async (e, { type, payload = {} }) => {
    switch (type) {
      case 'start-logging':        return core.startLogging();
      case 'log-activity':         return core.logActivity();
      case 'open-focus':           return core.openFocus(payload.prefill ?? null);
      case 'checkin-submit':       return core.checkinSubmit(payload, { andView: payload.andView === true });
      case 'checkin-skip':         return core.checkinSkip();
      case 'checkin-dismiss':      return core.checkinDismiss({ toShell: payload.toShell === true });
      case 'checkin-switch-focus': return core.checkinSwitchFocus(payload);
      case 'start-popup-dismiss':  return core.startPopupDismiss(payload.action);
      case 'focus-begin':          return core.focusBegin(payload);
      case 'focus-checkin-regularly': return core.focusCheckinRegularly(payload.typed ?? null);
      case 'focus-dismiss':        return core.focusDismiss();
      case 'focus-end-early':      return core.focusEndEarly();
      case 'manual-save':          return core.manualSave(payload);
      case 'interval-change':      return core.intervalChange(payload.minutes);
      case 'theme-toggle':         return core.themeToggle();
      case 'user-action':          return core.userAction();
      case 'shortcut-activate':    return core.shortcutActivate();
      case 'hide-shell':
        // Closing a pane is a button press, so it counts as engagement (§5.3).
        windows.hideShell();
        core.userAction();
        return { ok: true };
      case 'shortcut-move-by':     return windows.moveShortcutBy(payload.dx, payload.dy);
      case 'library-add':
        core.settings.addToLibrary(payload.kind, payload.name);
        core.userAction();
        return { ok: true };
      case 'library-remove':
        core.settings.removeFromLibrary(payload.kind, payload.name);
        core.userAction();
        return { ok: true };
      case 'quit-request':         return core.quitRequest();
      default:
        return { ok: false, error: `unknown event ${type}` };
    }
  });

  ipcMain.handle('query', (e, { type, payload = {} }) => {
    switch (type) {
      case 'analytics':     return queries.analytics(payload.days);
      case 'manual-recent': return queries.manualRecent();
      case 'editor-usage':  return queries.editorUsage(payload.kind);
      default:              return null;
    }
  });
}
