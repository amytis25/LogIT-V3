// pane-dashboard.jsx
// Description: the dashboard pane, both looks (SPEC §8.2) — idle (greeting,
//              start/focus CTAs, interval chips, 7-day panel) and active (NOW
//              card with live elapsed + next check-in countdown, today's
//              timeline). The focus look swaps the NOW card to warm rust.
// Inputs:  state snapshot; analytics query for the 7-day panel
// Outputs: <DashboardPane>
// Created: 2026-08-17

import React from 'react';
import {
  DASHBOARD_TIMELINE_MAX, FALLBACK_COLOR, STATE_ACTIVE_FOCUS, STATE_INACTIVE
} from '../shared/constants.js';
import {
  durationMinutes, formatCountdown, formatElapsed, wrappedSpanMinutes
} from '../shared/derive.js';
import { Icon } from './icons.jsx';
import { shortDateLine } from './shell.jsx';
import { hexAlpha, warmPalette } from './theme.jsx';
import {
  Btn, EngagementPausedPill, ErrorBanner, IntervalChips, Label, useTick
} from './widgets.jsx';

// Description: elapsed seconds since an 'HH:MM' start (today, or yesterday if
//              start is later than now).
// Inputs:  startHHMM
// Outputs: seconds
function elapsedSecondsSince(startHHMM) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(Number(startHHMM.slice(0, 2)), Number(startHHMM.slice(3, 5)), 0, 0);
  let diff = (now.getTime() - start.getTime()) / 1000;
  if (diff < 0) diff += 24 * 3600;
  return Math.floor(diff);
}

// Description: the 7-day stacked-bar sparkline from an analytics rollup.
// Inputs:  data — analytics query result; height
// Outputs: element
export function SparkBars({ data, height = 56 }) {
  if (!data) return <div style={{ height }} />;
  const max = Math.max(...data.days.map((d) => d.totalHours), 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.days.map((d, i) => {
        const isToday = i === data.days.length - 1;
        const letter = new Date(d.date + 'T00:00:00')
          .toLocaleDateString('en-US', { weekday: 'short' })[0];
        return (
          <div key={d.date} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, height: '100%'
          }}>
            <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%', height: `${(d.totalHours / max) * 100}%`,
                display: 'flex', flexDirection: 'column-reverse',
                borderRadius: 3, overflow: 'hidden', minHeight: 3,
                background: d.totalHours === 0 ? 'var(--line)' : 'transparent'
              }}>
                {Object.entries(d.byCategory).map(([cat, h]) => (
                  <div key={cat} style={{
                    height: `${(h / d.totalHours) * 100}%`,
                    background: data.colors[cat] ?? FALLBACK_COLOR
                  }} />
                ))}
              </div>
            </div>
            <div style={{
              fontSize: 9.5, fontFamily: 'var(--font-mono)',
              color: isToday ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: isToday ? 600 : 400, letterSpacing: '0.06em'
            }}>{letter}</div>
          </div>
        );
      })}
    </div>
  );
}

// Description: 7-day panel + interval chips column (shared by both looks).
// Inputs:  spark — analytics data; interval; compact — smaller spark
// Outputs: element
function RightColumn({ spark, interval, compact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: 12, background: 'var(--panel-alt)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>LAST 7 DAYS</Label>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
            {spark ? `${spark.totalHours.toFixed(1)}h` : ''}
          </span>
        </div>
        <div style={{ marginTop: 8 }}><SparkBars data={spark} height={compact ? 50 : 64} /></div>
      </div>
      <div style={{
        padding: 12, background: 'var(--panel-alt)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)'
      }}>
        <Label>CHECK IN EVERY</Label>
        <div style={{ marginTop: 8 }}>
          <IntervalChips value={interval} onChange={(m) => window.logit.send('interval-change', { minutes: m })} />
        </div>
      </div>
    </div>
  );
}

// Description: today's timeline — the 8 most recent entries; the open row
//              shows an empty end (SPEC §8.2).
// Inputs:  rows, colors
// Outputs: element
function Timeline({ rows, colors }) {
  const shown = rows.slice(-DASHBOARD_TIMELINE_MAX);
  if (shown.length === 0) {
    return <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>No entries yet today.</div>;
  }
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {shown.map((e, i) => {
        const mins = durationMinutes(e);
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '76px 4px 1fr auto',
            alignItems: 'center', gap: 8, padding: '6px 4px',
            borderRadius: 'var(--radius-sm)'
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
              {e.start}–{e.end || '··:··'}
            </span>
            <span style={{
              height: 18, width: 3, borderRadius: 2,
              background: colors[e.category] ?? FALLBACK_COLOR
            }} />
            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {e.category || (e.end === '' ? 'open block' : '—')}
              </span>
              {e.project && (
                <span style={{
                  fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0
                }}>· {e.project}</span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {e.end === '' ? '' : `${mins}m`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Description: the dashboard pane root — picks the look from the state.
// Inputs:  state; shellError + onDismissError — the shell-level error banner
// Outputs: element
export function DashboardPane({ state, shellError, onDismissError }) {
  useTick(true);   // this pane always shows a live number somewhere
  const [spark, setSpark] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    window.logit.query('analytics', { days: 7 }).then((d) => { if (alive) setSpark(d); });
    return () => { alive = false; };
  }, [state.todayRows.length, state.state]);

  const closedRows = state.todayRows.filter((r) => r.end !== '');
  const todayH = state.todayRows.reduce((s, r) => s + durationMinutes(r), 0) / 60;

  if (state.state === STATE_INACTIVE) {
    const hour = new Date().getHours();
    const greeting = state.paused ? 'Quiet for a while.'
      : hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
    const lastLogged = closedRows.at(-1)?.end;
    return (
      <div>
        <ErrorBanner message={shellError} onDismiss={onDismissError} />
        <Label>
          {closedRows.length === 0
            ? 'NOTHING LOGGED YET TODAY'
            : `${closedRows.length} ENTRIES TODAY · ${todayH.toFixed(1)}h · LAST LOGGED ${lastLogged}`}
        </Label>
        <div style={{
          marginTop: 4, fontFamily: 'var(--font-display)', fontWeight: 500,
          letterSpacing: '-0.015em', fontSize: 26, lineHeight: 1.1, color: 'var(--ink)'
        }}>{greeting}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink-2)' }}>
          {shortDateLine()}
          {state.paused && ` · auto-prompts off — no activity since ${state.lastActivity}`}
        </div>
        {state.paused && (
          <div style={{ marginTop: 14 }}>
            <EngagementPausedPill time={state.lastActivity} />
          </div>
        )}
        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button onClick={() => window.logit.send('start-logging')} style={{
            flex: 1, padding: '15px 18px',
            background: 'var(--accent)', color: 'var(--accent-ink)',
            border: 'none', borderRadius: 'var(--radius)',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: 'var(--shadow)'
          }}>
            <Icon name="play" size={15} />
            Start logging
          </button>
          <button onClick={() => window.logit.send('open-focus')} style={{
            padding: '15px 18px', background: 'var(--panel)', color: 'var(--ink)',
            border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8
          }}>
            <Icon name="focus" size={14} style={{ color: 'var(--accent)' }} />
            Focus mode
          </button>
        </div>
        <div style={{ marginTop: 18 }}>
          <Label>CHECK IN EVERY</Label>
          <div style={{ marginTop: 8 }}>
            <IntervalChips value={state.intervalMinutes}
              onChange={(m) => window.logit.send('interval-change', { minutes: m })} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
            {state.paused ? (
              <>Prompts are silent until you act. Pick an interval ready for when you resume — <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{state.intervalMinutes}m</span>.</>
            ) : (
              <>LogIT pings you every <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{state.intervalMinutes}m</span> to ask <em>what did you just do?</em> — closing the previous block and starting a new one.</>
            )}
          </div>
        </div>
        <div style={{
          marginTop: 18, padding: 14, background: 'var(--panel-alt)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>LAST 7 DAYS</Label>
            <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
              {spark ? `${spark.totalHours.toFixed(1)}h · avg ${spark.avgPerDay.toFixed(1)}h/d` : ''}
            </span>
          </div>
          <div style={{ marginTop: 10 }}><SparkBars data={spark} height={64} /></div>
        </div>
      </div>
    );
  }

  // ── active looks ──────────────────────────────────────────────────────────
  const focusLook = state.state === STATE_ACTIVE_FOCUS;
  const w = warmPalette(state.theme);
  const open = state.openRow;
  const nextIn = state.nextFireMs ? Math.max(0, (state.nextFireMs - Date.now()) / 1000) : null;
  const nextAt = state.nextFireMs
    ? new Date(state.nextFireMs).toTimeString().slice(0, 5)
    : '—';

  let focusRemaining = 0;
  let focusPct = 0;
  if (focusLook && state.focus) {
    focusRemaining = Math.max(0, (state.focusEndsAtMs - Date.now()) / 1000);
    const totalSec = wrappedSpanMinutes(state.focus.start, state.focus.end) * 60;
    focusPct = totalSec > 0 ? Math.min(100, 100 * (1 - focusRemaining / totalSec)) : 0;
  }

  return (
    <div>
      <ErrorBanner message={shellError} onDismiss={onDismissError} />
      {/* NOW card */}
      <div style={{
        padding: 14,
        background: focusLook ? w.softer : 'var(--accent-softer)',
        border: `1px solid ${focusLook ? w.line : 'var(--line)'}`,
        borderRadius: 'var(--radius)',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center'
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {focusLook
              ? <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em', color: w.base }}>NOW · FOCUS SESSION</span>
              : <Label>NOW · OPEN BLOCK</Label>}
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: focusLook ? w.base : 'var(--success)',
              boxShadow: `0 0 0 3px ${focusLook ? w.soft : hexAlpha('#3f8a5b', 0.18)}`, flex: 'none'
            }} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              letterSpacing: '-0.015em', fontSize: 22, lineHeight: 1, color: 'var(--ink)'
            }}>
              {focusLook && state.focus ? `${state.focus.start} → ${state.focus.end}` : `Started ${open?.start ?? ''}`}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
              {focusLook
                ? <>ends {formatCountdown(focusRemaining)}</>
                : open && `${formatElapsed(Math.floor(elapsedSecondsSince(open.start) / 60))} elapsed`}
            </span>
          </div>
          <div style={{
            marginTop: 8, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 7
          }}>
            <Icon name={focusLook ? 'focus' : 'clock'} size={11} />
            {focusLook
              ? 'Check-ins suppressed — details pending at session end'
              : `Details pending next check-in at ${nextAt}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none', minWidth: 110 }}>
          {focusLook ? (
            <>
              <Label style={{ color: w.base }}>REMAINING</Label>
              <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>
                {formatElapsed(Math.ceil(focusRemaining / 60))}
              </div>
              <div style={{ marginTop: 4, height: 3, background: w.soft, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${focusPct}%`, background: w.base }} />
              </div>
            </>
          ) : (
            <>
              <Label>NEXT CHECK-IN</Label>
              <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>
                {nextAt}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                {nextIn !== null ? formatCountdown(nextIn) : ''}
              </div>
            </>
          )}
        </div>
      </div>

      {/* below the NOW card */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>TODAY · {state.todayRows.length} ENTRIES</Label>
            <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
              {todayH.toFixed(1)}h
            </span>
          </div>
          <Timeline rows={state.todayRows} colors={state.colors.category} />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {!focusLook && (
              <>
                <Btn size="sm" kind="primary" icon="plus" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => window.logit.send('log-activity')}>
                  Log activity
                </Btn>
                <Btn size="sm" kind="secondary" icon="focus" onClick={() => window.logit.send('open-focus')}>
                  Focus mode
                </Btn>
              </>
            )}
            {focusLook && (
              <button onClick={() => window.logit.send('focus-end-early')} style={{
                flex: 1, justifyContent: 'center',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', background: 'transparent',
                border: `1px solid ${w.line}`, color: w.base,
                borderRadius: 'var(--radius)', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 500, cursor: 'pointer'
              }}>
                <Icon name="x" size={12} />
                End focus early
              </button>
            )}
          </div>
        </div>
        <RightColumn spark={spark} interval={state.intervalMinutes} compact />
      </div>
    </div>
  );
}
