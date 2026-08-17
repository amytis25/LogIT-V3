// pane-editor.jsx
// Description: the Categories / Projects editor panes (SPEC §8.7) —
//              structurally identical: add row, per-item usage over 7 days,
//              remove (library only; logged rows are never touched).
// Inputs:  kind ('category' | 'project'), state snapshot; editor-usage query
// Outputs: <EditorPane>
// Created: 2026-08-17

import React from 'react';
import { Icon } from './icons.jsx';
import { Btn, Label, Title } from './widgets.jsx';

export function EditorPane({ kind, state }) {
  const isCat = kind === 'category';
  const [draft, setDraft] = React.useState('');
  const [usage, setUsage] = React.useState(null);
  const libraryLength = isCat ? state.categories.length : state.projects.length;

  React.useEffect(() => {
    let alive = true;
    window.logit.query('editor-usage', { kind }).then((d) => { if (alive) setUsage(d); });
    return () => { alive = false; };
  }, [kind, libraryLength, state.todayRows.length]);

  const add = () => {
    if (!draft.trim()) return;
    window.logit.send('library-add', { kind, name: draft.trim() });
    setDraft('');
  };

  const items = usage?.items ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Title size={20}>{isCat ? 'Categories' : 'Projects'}</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            {isCat
              ? 'Top-level buckets shown in every check-in.'
              : 'Optional grouping under categories.'} Changes apply immediately.
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)',
          background: 'var(--panel-alt)', border: '1px solid var(--line)',
          padding: '4px 8px', borderRadius: 999
        }}>
          {libraryLength} {isCat ? 'categories' : 'projects'}
        </span>
      </div>

      <div style={{
        background: 'var(--panel-alt)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderBottom: '1px solid var(--line)'
        }}>
          <Icon name="plus" size={13} style={{ color: 'var(--ink-3)' }} />
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={`Add ${isCat ? 'category' : 'project'}…`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)'
            }} />
          <Btn size="sm" kind={draft.trim() ? 'primary' : 'ghost'} disabled={!draft.trim()} onClick={add}>
            Add
          </Btn>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>
              No {isCat ? 'categories' : 'projects'} yet. Add one above.
            </div>
          )}
          {items.map((it, i) => (
            <div key={it.name} style={{
              display: 'grid', gridTemplateColumns: '18px 1fr 60px 110px 26px',
              gap: 10, padding: '8px 12px', alignItems: 'center',
              borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none'
            }}>
              <span style={{
                width: 12, height: 12, borderRadius: 4, background: it.color,
                border: '1px solid rgba(0,0,0,0.06)'
              }} />
              <span style={{
                fontSize: 12.5, color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>{it.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                {it.hours.toFixed(1)}h
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ width: `${it.pct}%`, height: '100%', background: it.color }} />
                </div>
                <span style={{
                  width: 32, textAlign: 'right', fontFamily: 'var(--font-mono)',
                  fontSize: 10.5, color: 'var(--ink-3)'
                }}>{it.pct.toFixed(0)}%</span>
              </div>
              <button onClick={() => window.logit.send('library-remove', { kind, name: it.name })}
                title={`Remove ${it.name} (logged history is untouched)`}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', padding: 4, borderRadius: 4, display: 'flex'
                }}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
