// windows.js
// Description: BrowserWindow management — the concrete `surface` port the core
//              drives. One shell, at most one popup (never two), the floating
//              shortcut, and the toast. Owns hide-shell-while-popup-shows and
//              shortcut clamping. Knows nothing about logging rules.
// Inputs:  core (attached after construction), preload path, renderer entry
// Outputs: windows on screen; 'state' / 'nav' / 'shell-error' / 'toast'
//          messages into renderers
// Created: 2026-08-17

import { BrowserWindow, dialog, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CTX_EXIT_PROMPT, CTX_FOCUS_END, CTX_FOCUS_INTERRUPT,
  POPUP_WIDTH, SHELL_HEIGHT, SHELL_MIN_HEIGHT, SHELL_MIN_WIDTH, SHELL_WIDTH,
  SHORTCUT_WINDOW_SIZE, TOAST_DURATION_MS
} from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_HTML = path.join(__dirname, '..', '..', 'dist', 'index.html');

// Popup content heights by descriptor (design handoff artboard sizes).
const POPUP_HEIGHTS = {
  start: 400,
  checkin: 560,
  checkinTall: 620,
  focusA: 440,
  focusB: 660,
  focusLive: 560
};

export class WindowManager {
  // Description: set up empty window slots; attachCore() wires the brain in.
  // Inputs: none  Outputs: none
  constructor() {
    this.core = null;
    this.shell = null;
    this.popup = null;
    this.shortcut = null;
    this.toastWin = null;
    this.toastTimer = null;
    this.shellWasVisible = false;
    this.tearingDownPopup = false;
    screen.on('display-metrics-changed', () => this.clampShortcut());
  }

  // Description: attach the core after construction (core needs this object as
  //              its surface; this object needs core's handlers for closes).
  // Inputs:  core — Core
  // Outputs: none
  attachCore(core) {
    this.core = core;
  }

  // ── window construction ───────────────────────────────────────────────────

  // Description: shared BrowserWindow options for every LogIT window.
  // Inputs:  extra — per-window overrides
  // Outputs: options object
  baseOptions(extra) {
    return {
      frame: false,
      show: false,
      backgroundColor: '#00000000',
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.cjs')
      },
      ...extra
    };
  }

  // Description: load the shared renderer bundle with a window-kind tag.
  // Inputs:  win — BrowserWindow; kind — 'shell'|'popup'|'shortcut'|'toast'
  // Outputs: Promise
  loadRenderer(win, kind) {
    return win.loadFile(RENDERER_HTML, { search: `win=${kind}` });
  }

  // Description: create + show the persistent shell (SPEC §8.1). Closing it is
  //              a quit request, not a hide — the core decides what happens.
  // Inputs: none  Outputs: none
  createShell() {
    this.shell = new BrowserWindow(this.baseOptions({
      width: SHELL_WIDTH, height: SHELL_HEIGHT,
      minWidth: SHELL_MIN_WIDTH, minHeight: SHELL_MIN_HEIGHT,
      center: true, resizable: true, transparent: false,
      backgroundColor: '#f1ece1'
    }));
    this.shell.on('close', (e) => {
      e.preventDefault();               // background app: the core owns quitting
      this.core.quitRequest();
    });
    this.shell.once('ready-to-show', () => this.shell.show());
    this.loadRenderer(this.shell, 'shell');
  }

  // Description: create + show the floating shortcut (SPEC §8.9) at the
  //              top-right of the primary screen, clamped on every show.
  // Inputs: none  Outputs: none
  createShortcut() {
    this.shortcut = new BrowserWindow(this.baseOptions({
      width: SHORTCUT_WINDOW_SIZE, height: SHORTCUT_WINDOW_SIZE,
      resizable: false, skipTaskbar: true, alwaysOnTop: true,
      hasShadow: false, fullscreenable: false, minimizable: false, maximizable: false
    }));
    this.shortcut.setAlwaysOnTop(true, 'screen-saver');
    const area = screen.getPrimaryDisplay().workArea;
    this.shortcut.setPosition(area.x + area.width - SHORTCUT_WINDOW_SIZE - 16, area.y + 16);
    this.shortcut.once('ready-to-show', () => { this.clampShortcut(); this.shortcut.showInactive(); });
    this.loadRenderer(this.shortcut, 'shortcut');
  }

  // Description: move the shortcut by a drag delta, clamped into the work area.
  // Inputs:  dx, dy — pixels
  // Outputs: none
  moveShortcutBy(dx, dy) {
    if (!this.shortcut) return;
    const [x, y] = this.shortcut.getPosition();
    this.shortcut.setPosition(...this.clampedShortcutPos(x + dx, y + dy));
  }

  // Description: clamp so the shortcut can never leave the visible area —
  //              on every show, not just creation (monitor unplugs, GOTCHAS).
  // Inputs: none  Outputs: none
  clampShortcut() {
    if (!this.shortcut || this.shortcut.isDestroyed()) return;
    const [x, y] = this.shortcut.getPosition();
    this.shortcut.setPosition(...this.clampedShortcutPos(x, y));
  }

  // Description: nearest in-bounds position for the shortcut window.
  // Inputs:  x, y — desired
  // Outputs: [x, y] clamped
  clampedShortcutPos(x, y) {
    const area = screen.getDisplayNearestPoint({ x, y }).workArea;
    const cx = Math.min(Math.max(x, area.x), area.x + area.width - SHORTCUT_WINDOW_SIZE);
    const cy = Math.min(Math.max(y, area.y), area.y + area.height - SHORTCUT_WINDOW_SIZE);
    return [Math.round(cx), Math.round(cy)];
  }

  // ── the popup slot (never more than one — CLAUDE §4.6) ────────────────────

  // Description: open the single popup window; hides the shell while the popup
  //              is in the foreground (SPEC §8.1).
  // Inputs:  heightKey — key into POPUP_HEIGHTS; dismissable — native close /
  //          Esc allowed (false only for FOCUS_END)
  // Outputs: none
  openPopupWindow(heightKey, dismissable) {
    if (this.popup !== null) return;
    if (this.shell && this.shell.isVisible() && !this.shell.isMinimized()) {
      this.shellWasVisible = true;
      this.shell.hide();
    } else {
      this.shellWasVisible = false;
    }
    this.popup = new BrowserWindow(this.baseOptions({
      width: POPUP_WIDTH + 24, height: POPUP_HEIGHTS[heightKey] + 24,
      resizable: false, skipTaskbar: true, alwaysOnTop: true,
      center: true, fullscreenable: false, minimizable: false, maximizable: false,
      closable: dismissable
    }));
    this.popup.setAlwaysOnTop(true, 'screen-saver');
    this.popup.on('close', (e) => {
      if (this.tearingDownPopup) return;     // the core is closing it properly
      e.preventDefault();
      this.core.popupNativeDismiss();        // Alt+F4 etc. behaves as dismiss
    });
    this.popup.once('ready-to-show', () => this.popup?.show());
    this.loadRenderer(this.popup, 'popup');
  }

  // ── the surface port the core drives ──────────────────────────────────────

  // Description: show the check-in popup for a context (SPEC §8.3).
  // Inputs:  context; prefill — carried typed values or null
  // Outputs: none
  showCheckin(context, prefill) {
    const tall = context === CTX_FOCUS_INTERRUPT || context === CTX_EXIT_PROMPT;
    this.openPopupWindow(tall ? 'checkinTall' : 'checkin', context !== CTX_FOCUS_END);
  }

  // Description: show the start-logging popup (SPEC §8.5).
  // Inputs: none  Outputs: none
  showStartLogging() {
    this.openPopupWindow('start', true);
  }

  // Description: show the focus popup — form variant A/B or the live page.
  // Inputs:  variant — 'A' | 'B' | 'live'
  // Outputs: none
  showFocus(variant) {
    const key = variant === 'live' ? 'focusLive' : variant === 'B' ? 'focusB' : 'focusA';
    this.openPopupWindow(key, true);
  }

  // Description: tear the popup window down and re-show the shell if it was
  //              visible before the popup appeared.
  // Inputs: none  Outputs: none
  closePopup() {
    if (this.popup === null) return;
    this.tearingDownPopup = true;
    this.popup.destroy();
    this.tearingDownPopup = false;
    this.popup = null;
    if (this.shellWasVisible && this.shell && !this.shell.isDestroyed()) {
      this.shell.show();
    }
  }

  // Description: bring the shell to front on a pane.
  // Inputs:  pane — sidebar pane id or undefined
  // Outputs: none
  showShell(pane) {
    if (!this.shell || this.shell.isDestroyed()) return;
    this.shellWasVisible = true;
    this.shell.show();
    this.shell.focus();
    if (pane) this.shell.webContents.send('nav', pane);
  }

  // Description: success toast (SPEC §8.10) — compact, self-dismissing, never
  //              takes input.
  // Inputs:  text
  // Outputs: none
  toast(text) {
    if (this.toastWin === null || this.toastWin.isDestroyed()) {
      this.toastWin = new BrowserWindow(this.baseOptions({
        width: 320, height: 72, resizable: false, skipTaskbar: true,
        alwaysOnTop: true, focusable: false, hasShadow: false,
        fullscreenable: false, minimizable: false, maximizable: false
      }));
      this.toastWin.setIgnoreMouseEvents(true);
      const area = screen.getPrimaryDisplay().workArea;
      this.toastWin.setPosition(
        area.x + area.width - 320 - 16,
        area.y + 16 + SHORTCUT_WINDOW_SIZE + 8);
      this.loadRenderer(this.toastWin, 'toast');
      this.toastWin.webContents.once('did-finish-load', () => this.sendToast(text));
    } else {
      this.sendToast(text);
    }
  }

  // Description: deliver toast text and (re)start its 3-second life.
  // Inputs:  text
  // Outputs: none
  sendToast(text) {
    this.toastWin.webContents.send('toast', text);
    this.toastWin.showInactive();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this.toastWin && !this.toastWin.isDestroyed()) this.toastWin.hide();
    }, TOAST_DURATION_MS);
  }

  // Description: show a failure the user must see in the shell's error banner.
  // Inputs:  text
  // Outputs: none
  notifyError(text) {
    this.showShell();
    this.shell.webContents.send('shell-error', text);
  }

  // Description: the modal exit confirmation — the one allowed modal (SPEC §1).
  // Inputs: none
  // Outputs: Promise<boolean> — true to quit
  async confirmQuit() {
    const { response } = await dialog.showMessageBox(this.shell, {
      type: 'question',
      message: 'Exit LogIT?',
      detail: 'The floating shortcut and check-ins stop until you open it again.',
      buttons: ['Exit LogIT', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });
    return response === 0;
  }

  // Description: broadcast the current state snapshot to every live window.
  // Inputs: none  Outputs: none
  refresh() {
    if (this.core === null) return;
    const state = this.core.getState();
    for (const win of [this.shell, this.popup, this.shortcut, this.toastWin]) {
      if (win && !win.isDestroyed()) win.webContents.send('state', state);
    }
  }
}
