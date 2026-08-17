// settings_store.js
// Description: the settings layer — loads the single human-readable settings
//              file, snaps illegal intervals to the nearest allowed value on
//              load (and re-saves), saves immediately on every change, owns the
//              lazy-but-persistent colour assignment and the library growth
//              rule (FUNCTIONAL_SPEC §3.2).
// Inputs:  data root directory (injected)
// Outputs: settings object; <root>/settings.json on disk
// Created: 2026-08-17

import fs from 'node:fs';
import path from 'node:path';
import {
  ALLOWED_INTERVALS_MIN, COLOR_PALETTE, DEFAULT_CATEGORIES, DEFAULT_INTERVAL_MIN,
  DEFAULT_POPUP_TIMEOUT_SEC, DEFAULT_PROJECTS, DEFAULT_THEME, SETTINGS_FILE_NAME
} from '../../shared/constants.js';

export class SettingsStore {
  // Description: load (or default) settings from <root>/settings.json.
  // Inputs:  root — data root directory
  // Outputs: none (state on the instance)
  constructor(root) {
    this.file = path.join(root, SETTINGS_FILE_NAME);
    this.data = this.load();
  }

  // Description: read + normalise the settings file; snap the interval; save
  //              back if anything was normalised.
  // Inputs:  none
  // Outputs: settings data object
  load() {
    let raw = {};
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      raw = {};   // missing or corrupt file → defaults; first save recreates it
    }
    const data = {
      intervalMinutes: Number(raw.intervalMinutes) || DEFAULT_INTERVAL_MIN,
      popupTimeoutSec: Number(raw.popupTimeoutSec) || DEFAULT_POPUP_TIMEOUT_SEC,
      theme: raw.theme === 'dark' ? 'dark' : DEFAULT_THEME,
      categories: Array.isArray(raw.categories) && raw.categories.length > 0
        ? raw.categories.map(String) : [...DEFAULT_CATEGORIES],
      projects: Array.isArray(raw.projects) && raw.projects.length > 0
        ? raw.projects.map(String) : [...DEFAULT_PROJECTS],
      categoryColors: isPlainObject(raw.categoryColors) ? { ...raw.categoryColors } : {},
      projectColors: isPlainObject(raw.projectColors) ? { ...raw.projectColors } : {}
    };
    const snapped = snapInterval(data.intervalMinutes);
    const changed = snapped !== data.intervalMinutes;
    data.intervalMinutes = snapped;
    if (changed) this.persist(data);
    return data;
  }

  // Description: write settings to disk immediately (save-on-change contract).
  // Inputs:  data — optional explicit object (defaults to this.data)
  // Outputs: none
  persist(data = this.data) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  // Description: set the check-in interval; only the six allowed values stick.
  // Inputs:  minutes — number
  // Outputs: the stored (snapped) value
  setInterval(minutes) {
    this.data.intervalMinutes = snapInterval(Number(minutes));
    this.persist();
    return this.data.intervalMinutes;
  }

  // Description: set the theme and save.
  // Inputs:  theme — 'light' | 'dark'
  // Outputs: none
  setTheme(theme) {
    this.data.theme = theme === 'dark' ? 'dark' : 'light';
    this.persist();
  }

  // Description: colour for a category or project name. First display assigns
  //              the first palette colour not yet used in that map (cycling
  //              once all 8 are taken) and saves immediately, so a name keeps
  //              its colour forever. NOTE: this "read" can write to disk —
  //              known and accepted (GOTCHAS "Reading a colour writes...").
  // Inputs:  kind — 'category' | 'project'; name — string
  // Outputs: '#rrggbb' colour
  colorFor(kind, name) {
    const map = kind === 'project' ? this.data.projectColors : this.data.categoryColors;
    if (map[name]) return map[name];
    const used = new Set(Object.values(map));
    let color = COLOR_PALETTE.find((c) => !used.has(c));
    if (!color) color = COLOR_PALETTE[Object.keys(map).length % COLOR_PALETTE.length];
    map[name] = color;
    this.persist();
    return color;
  }

  // Description: library growth — add a name if absent (trimmed exact match;
  //              duplicates are a no-op). Libraries never auto-shrink.
  // Inputs:  kind — 'category' | 'project'; name — string
  // Outputs: true if added
  addToLibrary(kind, name) {
    const clean = String(name ?? '').trim();
    if (clean === '') return false;
    const list = kind === 'project' ? this.data.projects : this.data.categories;
    if (list.includes(clean)) return false;
    list.push(clean);
    this.persist();
    return true;
  }

  // Description: explicit removal from a library (editor panes only). Logged
  //              rows are never touched — history is never rewritten.
  // Inputs:  kind — 'category' | 'project'; name — string
  // Outputs: none
  removeFromLibrary(kind, name) {
    const list = kind === 'project' ? this.data.projects : this.data.categories;
    const i = list.indexOf(name);
    if (i >= 0) {
      list.splice(i, 1);
      this.persist();
    }
  }
}

// Description: nearest allowed interval; ties resolve to the smaller value.
// Inputs:  minutes — number
// Outputs: member of ALLOWED_INTERVALS_MIN
export function snapInterval(minutes) {
  if (ALLOWED_INTERVALS_MIN.includes(minutes)) return minutes;
  let best = ALLOWED_INTERVALS_MIN[0];
  for (const v of ALLOWED_INTERVALS_MIN) {
    if (Math.abs(v - minutes) < Math.abs(best - minutes)) best = v;
  }
  return best;
}

// Description: guard for JSON-object settings sub-maps.
// Inputs: v — any  Outputs: boolean
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
