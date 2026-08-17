// pane-manual.jsx
// Description: the manual entry pane (SPEC §8.6) — retroactive back-fill on
//              any date. Validates everything at once via the core; success
//              clears category/project/notes but keeps date and times so
//              consecutive back-fills are fast.
// Inputs:  state snapshot; manual-recent query
// Outputs: <ManualPane>
// Created: 2026-08-17

import React from 'react';
import { FALLBACK_COLOR } from '../shared/constants.js';
import { formatDurationShort, hhmmToMinutes, isValidHHMM } from '../shared/derive.js';
import { hexAlpha } from './theme.jsx';
import { Btn, Combo, ErrorBanner, Label, TextArea, TextField, Title, V2Field } from './widgets.jsx';

export function ManualPane({ state }) {
  const [date, setDate] = React.useState(state.today);
  const [start, setStart] = React.useState(state.now);
  const [end, setEnd] = React.useState('');
  const [cat, setCat] = React.useState('');
  const [proj, setProj] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState('');
  const [recent, setRecent] = React.useState([]);

  const loadRecent = React.useCallback(() => {
    window.logit.query('manual-recent').then(setRecent);
  }, []);
  React.useEffect(loadRecent, [loadRecent]);

  const duration = isValidHHMM(start) && isValidHHMM(end) &&
    hhmmToMinutes(end) > hhmmToMinutes(start)
    ? formatDurationShort(hhmmToMinutes(end) - hhmmToMinutes(start))
    : null;

  const save = async () => {
    const res = await window.logit.send('manual-save', { date, start, end, category: cat, project: proj, notes });
    if (!res.ok) {
      setError(res.errors.join('\n'));
      return;
    }
    setError('');
    setCat(''); setProj(''); setNotes('');   // keep date + times (SPEC §8.6)
    loadRecent();
  };

  const catOptions = state.categories.map((n) => ({ label: n, color: state.colors.category[n] }));
  const projOptions = state.projects.map((n) => ({ label: n, color: state.colors.project[n] }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <Title size={20}>Manual entry</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            Log an activity from earlier in the day or week.
          </div>
        </div>
        <Btn size="sm" kind="primary" icon="check" onClick={save}>Save entry</Btn>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError('')} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
            <V2Field label="DATE" mode={state.theme}>
              <TextField value={date} onChange={setDate} icon="calendar" mono />
            </V2Field>
            <V2Field label="START" mode={state.theme}>
              <TextField value={start} onChange={setStart} icon="clock" mono />
            </V2Field>
            <V2Field label="END" mode={state.theme}>
              <TextField value={end} onChange={setEnd} icon="clock" mono placeholder="HH:MM" />
            </V2Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <V2Field label="CATEGORY" required mode={state.theme}>
              <Combo value={cat} onChange={setCat} options={catOptions}
                placeholder="Pick a category…"
                dot={cat ? (state.colors.category[cat] ?? FALLBACK_COLOR) : undefined} icon="tag" />
            </V2Field>
            <V2Field label="PROJECT" mode={state.theme}>
              <Combo value={proj} onChange={setProj} options={projOptions}
                placeholder="Optional…"
                dot={proj ? (state.colors.project[proj] ?? FALLBACK_COLOR) : undefined} icon="folder" />
            </V2Field>
          </div>
          <V2Field label="NOTES" mode={state.theme}>
            <TextArea value={notes} onChange={setNotes} placeholder="What did you do?" rows={3} />
          </V2Field>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {duration
              ? <>Duration <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{duration}</span>{' · '}</>
              : null}
            saves with mode=manual
          </div>
        </div>

        <div style={{
          background: 'var(--panel-alt)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', overflow: 'hidden'
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
            <Label>RECENT MANUAL ENTRIES</Label>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {recent.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>
                No manual entries yet.
              </div>
            )}
            {recent.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '64px 1fr',
                gap: 8, padding: '8px 12px',
                borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none'
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                  {r.date.slice(5)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflowEllipsis: 'ellipsis'
                  }}>
                    {r.category}
                    {r.project && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {r.project}</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {r.start}–{r.end}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
