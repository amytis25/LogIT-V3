// pane-analytics.jsx
// Description: the read-only analytics pane (SPEC §8.8) — range selector,
//              four KPI tiles, one stacked bar per day with 0/half/max
//              gridlines, top-5 legend. Recomputes from the log on every range
//              change and every time the pane becomes visible; no cache.
// Inputs:  state snapshot; analytics query
// Outputs: <AnalyticsPane>
// Created: 2026-08-17

import React from 'react';
import { ANALYTICS_RANGES_DAYS, FALLBACK_COLOR } from '../shared/constants.js';
import { KpiTile, Label, Segmented, Title } from './widgets.jsx';

// Description: axis tick label — one decimal below 1 h, whole hours above.
// Inputs:  v — hours
// Outputs: string
function tickLabel(v) {
  return v < 1 ? `${v.toFixed(1)}h` : `${Math.round(v)}h`;
}

// Description: the stacked-bar chart with gridlines and weekday labels.
// Inputs:  data — analytics result; height
// Outputs: element
function Bars({ data, height = 160 }) {
  const max = Math.max(...data.days.map((d) => d.totalHours), 0.001);
  const yTicks = [0, max / 2, max];
  const many = data.days.length > 10;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, height }}>
      <div style={{
        display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
        width: 30, paddingBottom: 18, paddingTop: 4,
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', textAlign: 'right'
      }}>
        {yTicks.map((v, i) => <span key={i}>{tickLabel(v)}</span>)}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-end', gap: many ? 4 : 10,
        borderLeft: '1px solid var(--line)', paddingLeft: 12
      }}>
        {data.days.map((d, i) => {
          const isToday = i === data.days.length - 1;
          const letter = new Date(d.date + 'T00:00:00')
            .toLocaleDateString('en-US', { weekday: 'short' })[0];
          return (
            <div key={d.date} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, height: '100%', minWidth: 0
            }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', maxWidth: 42, margin: '0 auto',
                  height: `${(d.totalHours / max) * 100}%`,
                  display: 'flex', flexDirection: 'column-reverse',
                  borderRadius: 4, overflow: 'hidden', minHeight: 3,
                  background: d.totalHours === 0 ? 'var(--line)' : 'transparent'   // flat baseline stub
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
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: isToday ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: isToday ? 600 : 400, letterSpacing: '0.04em'
              }}>{letter}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsPane({ state }) {
  const [days, setDays] = React.useState(7);
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    window.logit.query('analytics', { days }).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [days, state.todayRows.length]);

  if (!data) return null;
  const legend = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Title size={20}>Analytics</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            Real numbers from your log · last {days} days
          </div>
        </div>
        <Segmented value={days} onChange={setDays}
          options={ANALYTICS_RANGES_DAYS.map((d) => ({ value: d, label: `${d}d` }))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <KpiTile value={`${data.totalHours.toFixed(1)}h`} label="Tracked" />
        <KpiTile value={`${data.avgPerDay.toFixed(1)}h`} label="Avg / day" />
        <KpiTile value={`${data.focusHours.toFixed(1)}h`} label="In focus" />
        <KpiTile value={data.top ? (data.top.name || '—') : '—'} label="Top"
          sub={data.top ? `${data.top.hours.toFixed(1)}h` : undefined} />
      </div>

      <div style={{
        padding: '12px 14px', background: 'var(--panel-alt)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
          <Label>HOURS BY CATEGORY · BY DAY</Label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {legend.map(([c]) => (
              <span key={c} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10.5, color: 'var(--ink-2)'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: data.colors[c] ?? FALLBACK_COLOR }} />
                {c || '(uncategorised)'}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}><Bars data={data} height={170} /></div>
      </div>
    </div>
  );
}
