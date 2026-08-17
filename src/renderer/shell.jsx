// shell.jsx
// Description: the persistent main window (SPEC §8.1) — custom title bar
//              (drag region, theme toggle, close-as-quit), five-item sidebar
//              with a de-emphasised Quit, and the pane switch.
// Inputs:  state snapshot, window.logit bridge
// Outputs: <Shell> component
// Created: 2026-08-17

import React from 'react';
import { Icon } from './icons.jsx';
import { AnalyticsPane } from './pane-analytics.jsx';
import { DashboardPane } from './pane-dashboard.jsx';
import { EditorPane } from './pane-editor.jsx';
import { ManualPane } from './pane-manual.jsx';
import { STATE_ACTIVE_FOCUS, STATE_INACTIVE } from '../shared/constants.js';

const NAV = [
  { id: 'dashboard', icon: 'clock', label: 'Dashboard' },
  { id: 'manual', icon: 'pencil', label: 'Manual entry' },
  { id: 'analytics', icon: 'chart', label: 'Analytics' },
  { id: 'categories', icon: 'tag', label: 'Categories' },
  { id: 'projects', icon: 'folder', label: 'Projects' }
];

const SECTION_META = {
  manual: { title: 'Manual entry', subtitle: 'retroactive logging' },
  analytics: { title: 'Analytics', subtitle: 'last 7 days' },
  categories: { title: 'Categories', subtitle: 'activity buckets' },
  projects: { title: 'Projects', subtitle: 'optional groupings' }
};

// Description: short date line like 'Tue · May 20'.
// Inputs: none  Outputs: string
export function shortDateLine() {
  const d = new Date();
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wd} · ${mo} ${d.getDate()}`;
}

export const ModeToggle = ({ mode }) => (
  <button
    title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
    onClick={() => window.logit.send('theme-toggle')}
    style={{
      width: 28, height: 24, border: '1px solid var(--line)',
      background: 'var(--panel)', color: 'var(--ink-2)',
      cursor: 'pointer', borderRadius: 'var(--radius-sm)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flex: 'none', WebkitAppRegion: 'no-drag'
    }}>
    <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={13} />
  </button>
);

export const CloseBtn = ({ onClick }) => (
  <button title="Close" onClick={onClick} style={{
    width: 24, height: 24, border: 'none', background: 'transparent',
    cursor: 'pointer', color: 'var(--ink-3)', borderRadius: 'var(--radius-sm)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flex: 'none', WebkitAppRegion: 'no-drag'
  }}>
    <Icon name="x" size={13} />
  </button>
);

// Description: shared window chrome — logo · title/subtitle · toggle · close.
// Inputs:  title, subtitle, right, mode, onClose, badge
// Outputs: title bar element (a drag region)
export const TitleBar = ({ title, subtitle, right, mode, onClose, badge }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', borderBottom: '1px solid var(--line)',
    background: 'var(--panel-alt)', flex: 'none', WebkitAppRegion: 'drag'
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 6,
      background: 'var(--accent)', color: 'var(--accent-ink)',
      '--logo-hands': 'var(--accent)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'
    }}>
      <Icon name="logo" size={16} />
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          letterSpacing: '-0.015em', fontSize: 14, color: 'var(--ink)', lineHeight: 1.1
        }}>{title}</span>
        {badge}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{subtitle}</div>
      )}
    </div>
    <span style={{ WebkitAppRegion: 'no-drag', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {right}
      <ModeToggle mode={mode} />
      {onClose && <CloseBtn onClick={onClose} />}
    </span>
  </div>
);

// Description: the shell — sidebar + swapped pane; every nav click counts as
//              user engagement.
// Inputs:  state — snapshot
// Outputs: element
export function Shell({ state }) {
  const [pane, setPane] = React.useState('dashboard');
  const [shellError, setShellError] = React.useState('');
  React.useEffect(() => {
    window.logit.onNav((p) => setPane(p));
    window.logit.onShellError((text) => setShellError(text));
  }, []);

  const dashMeta = state.state === STATE_INACTIVE
    ? { title: 'LogIT', subtitle: state.paused ? 'paused · waiting for you' : 'ready when you are' }
    : {
      title: 'Today',
      subtitle: `${shortDateLine()} · live · ${state.state === STATE_ACTIVE_FOCUS ? 'focus session' : 'open block'}`
    };
  const meta = pane === 'dashboard' ? dashMeta : SECTION_META[pane];

  const nav = (id) => {
    setPane(id);
    window.logit.send('user-action');
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--ink)', overflow: 'hidden'
    }}>
      {/* X puts the window away and leaves the app running; only Quit exits. */}
      <TitleBar title={meta.title} subtitle={meta.subtitle} mode={state.theme}
        onClose={() => window.logit.send('hide-shell')} />
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        <aside style={{
          width: 180, flex: 'none', borderRight: '1px solid var(--line)',
          background: 'var(--panel-alt)', padding: '14px 10px',
          display: 'flex', flexDirection: 'column'
        }}>
          {NAV.map((n) => {
            const sel = n.id === pane;
            return (
              <button key={n.id} onClick={() => nav(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', marginBottom: 1,
                border: 'none', background: sel ? 'var(--panel)' : 'transparent',
                boxShadow: sel ? 'var(--shadow)' : 'none',
                color: sel ? 'var(--ink)' : 'var(--ink-2)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: sel ? 500 : 400,
                textAlign: 'left'
              }}>
                <Icon name={n.icon} size={14} style={{ color: sel ? 'var(--accent)' : 'var(--ink-3)' }} />
                <span style={{ flex: 1 }}>{n.label}</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ height: 1, background: 'var(--line)', margin: '8px 4px' }} />
          <button onClick={() => window.logit.send('quit-request')} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', border: 'none', background: 'transparent',
            color: 'var(--ink-3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12
          }}>
            <Icon name="x" size={13} />
            <span>Quit</span>
          </button>
        </aside>
        <main style={{ flex: 1, minWidth: 0, padding: '18px 22px', overflowY: 'auto' }}>
          {pane === 'dashboard' && (
            <DashboardPane state={state} shellError={shellError}
              onDismissError={() => setShellError('')} />
          )}
          {pane === 'manual' && <ManualPane state={state} />}
          {pane === 'analytics' && <AnalyticsPane state={state} />}
          {pane === 'categories' && <EditorPane kind="category" state={state} />}
          {pane === 'projects' && <EditorPane kind="project" state={state} />}
        </main>
      </div>
    </div>
  );
}
