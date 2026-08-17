// queries.js
// Description: read-only questions the panes ask (analytics rollups, recent
//              manual entries, editor usage). Every read goes through the log
//              layer and every number through derive — no pane rebuilds paths
//              or duration maths (CLAUDE.md §5.1, §5.3).
// Inputs:  { log: LogStore, settings: SettingsStore, clock }
// Outputs: plain serializable result objects
// Created: 2026-08-17

import { KIND_MANUAL, MANUAL_RECENT_DAYS, MANUAL_RECENT_MAX } from '../shared/constants.js';
import { durationMinutes, rollup } from '../shared/derive.js';
import { prevDate, toDateStr } from './log/log_store.js';

export class Queries {
  // Description: bind the query set to its data sources.
  // Inputs:  deps — { log, settings, clock }
  // Outputs: none
  constructor({ log, settings, clock }) {
    this.log = log;
    this.settings = settings;
    this.clock = clock;
  }

  // Description: today's local date string.
  // Inputs: none  Outputs: 'YYYY-MM-DD'
  todayStr() {
    return toDateStr(new Date(this.clock()));
  }

  // Description: the last-N-days range ending today (inclusive).
  // Inputs:  days — count
  // Outputs: array of { date, rows }
  rangeEndingToday(days) {
    const end = this.todayStr();
    let start = end;
    for (let i = 1; i < days; i++) start = prevDate(start);
    return this.log.readRange(start, end);
  }

  // Description: analytics rollup for a range (SPEC §8.8) plus per-day detail
  //              for the chart and the category colour map.
  // Inputs:  days — 7 | 14 | 30
  // Outputs: { days, byCategory, totalHours, focusHours, avgPerDay, top, colors }
  analytics(days) {
    const r = rollup(this.rangeEndingToday(days));
    const sorted = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]);
    const top = sorted[0] ?? null;
    const colors = Object.fromEntries(
      sorted.map(([name]) => [name, this.settings.colorFor('category', name || '')]));
    return {
      days: r.days,
      byCategory: r.byCategory,
      totalHours: r.totalHours,
      focusHours: r.focusHours,
      avgPerDay: r.totalHours / days,
      top: top ? { name: top[0], hours: top[1] } : null,
      colors
    };
  }

  // Description: recent manual entries — kind `manual`, last 14 days, newest
  //              first, at most 10 (SPEC §8.6).
  // Inputs: none
  // Outputs: array of { date, start, end, category, project }
  manualRecent() {
    const range = this.rangeEndingToday(MANUAL_RECENT_DAYS);
    const out = [];
    for (const { date, rows } of range) {
      for (const r of rows) {
        if (r.kind === KIND_MANUAL) {
          out.push({ date, start: r.start, end: r.end, category: r.category, project: r.project });
        }
      }
    }
    out.reverse();   // range walks oldest→newest; newest first for display
    return out.slice(0, MANUAL_RECENT_MAX);
  }

  // Description: per-name hours over the last 7 days for the editor panes
  //              (SPEC §8.7) — names currently in the library only.
  // Inputs:  kind — 'category' | 'project'
  // Outputs: { items: [{name, color, hours, pct}], total }
  editorUsage(kind) {
    const names = kind === 'project' ? this.settings.data.projects : this.settings.data.categories;
    const range = this.rangeEndingToday(7);
    const hoursByName = {};
    for (const { rows } of range) {
      for (const r of rows) {
        const key = kind === 'project' ? r.project : r.category;
        hoursByName[key] = (hoursByName[key] || 0) + durationMinutes(r) / 60;
      }
    }
    const items = names.map((name) => ({
      name,
      color: this.settings.colorFor(kind, name),
      hours: hoursByName[name] || 0
    }));
    const total = items.reduce((s, i) => s + i.hours, 0);
    for (const i of items) i.pct = total > 0 ? (i.hours / total) * 100 : 0;
    return { items, total };
  }
}
