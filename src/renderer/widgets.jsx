// widgets.jsx
// Description: themed widget primitives ported from the design handoff — every
//              surface builds from these. Visual only: behaviour arrives as
//              props and callbacks.
// Inputs:  CSS variables from <Theme>
// Outputs: Btn, TextField, Combo, Label, Title, Segmented, ErrorBanner,
//          CountdownRing, V2Field, ContextBadge, EngagementPausedPill,
//          IntervalChips, KpiTile, useTick
// Created: 2026-08-17

import React from 'react';
import { ALLOWED_INTERVALS_MIN, LIVE_TICK_MS } from '../shared/constants.js';
import { Icon } from './icons.jsx';
import { dangerColor, warmPalette } from './theme.jsx';

// Description: 1 Hz re-render while `active` — started on show, stopped on
//              hide (a tick left running on a hidden pane is a leak, GOTCHAS).
// Inputs:  active — boolean
// Outputs: an increasing number (forces re-render)
export function useTick(active) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return tick;
}

export const Label = ({ children, style }) => (
  <div style={{
    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
    color: 'var(--ink-3)', ...style
  }}>{children}</div>
);

export const Title = ({ size = 24, children, style }) => (
  <h2 style={{
    fontFamily: 'var(--font-display)', fontWeight: 500,
    letterSpacing: '-0.015em', fontSize: size, lineHeight: 1.15,
    margin: 0, color: 'var(--ink)', ...style
  }}>{children}</h2>
);

export const Btn = ({ kind = 'ghost', size = 'md', icon, iconAfter, children, style, onClick, disabled }) => {
  const padY = size === 'sm' ? 6 : size === 'lg' ? 12 : 9;
  const padX = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fs = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;
  const kinds = {
    primary: { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' },
    secondary: { background: 'var(--panel)', color: 'var(--ink)', borderColor: 'var(--line-strong)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)', borderColor: 'transparent' }
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: `${padY}px ${padX}px`, fontFamily: 'inherit', fontSize: fs,
      fontWeight: 500, lineHeight: 1, borderRadius: 'var(--radius)',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      border: '1px solid transparent', whiteSpace: 'nowrap',
      transition: 'background 120ms, color 120ms, border-color 120ms',
      ...kinds[kind], ...style
    }}>
      {icon && <Icon name={icon} size={fs + 1} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={fs + 1} />}
    </button>
  );
};

export const TextField = ({ value, onChange, placeholder, icon, mono, readOnly, style }) => (
  <label style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius)', padding: '0 12px', height: 38,
    width: '100%', minWidth: 0,
    fontFamily: mono ? 'var(--font-mono)' : 'inherit', ...style
  }}>
    {icon && <Icon name={icon} size={14} style={{ color: 'var(--ink-3)' }} />}
    <input
      value={value} readOnly={readOnly}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={(e) => { e.currentTarget.parentElement.style.borderColor = 'var(--accent)'; }}
      onBlur={(e) => { e.currentTarget.parentElement.style.borderColor = 'var(--line)'; }}
      style={{
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, height: '100%', minWidth: 0
      }} />
  </label>
);

export const TextArea = ({ value, onChange, placeholder, rows = 2 }) => (
  <textarea
    value={value} onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder} rows={rows}
    style={{
      width: '100%', background: 'var(--panel-alt)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', padding: '10px 12px',
      fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)',
      outline: 'none', resize: 'none', lineHeight: 1.5
    }} />
);

// Description: searchable combo (dropdown + free text) over a library. Free
//              text is allowed everywhere it appears (SPEC §3.2).
// Inputs:  value, onChange, options [{label, color}], placeholder, icon, dot
// Outputs: combo element
export const Combo = ({ value, onChange, options, placeholder, icon, dot }) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value || '');
  React.useEffect(() => setDraft(value || ''), [value]);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = options.filter((o) => !draft || o.label.toLowerCase().includes(draft.toLowerCase()));
  const exact = options.some((o) => o.label.toLowerCase() === draft.toLowerCase());
  const pick = (label) => { onChange(label); setDraft(label); setOpen(false); };
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', padding: '0 10px 0 12px', height: 38,
        width: '100%', minWidth: 0,
        borderColor: open ? 'var(--accent)' : 'var(--line)'
      }}>
        {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flex: 'none' }} />}
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--ink-3)' }} />}
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onChange(draft); setOpen(false); }
            if (e.key === 'Escape') { setOpen(false); e.stopPropagation(); }
          }}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, height: '100%', minWidth: 0
          }} />
        <button onClick={() => setOpen((v) => !v)} tabIndex={-1} style={{
          background: 'transparent', border: 'none', color: 'var(--ink-3)',
          cursor: 'pointer', padding: 4, display: 'flex'
        }}>
          <Icon name="chevron-down" size={14} />
        </button>
      </label>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-pop)',
          padding: 4, zIndex: 50, maxHeight: 200, overflowY: 'auto'
        }}>
          {filtered.map((o) => (
            <div key={o.label}
              onMouseDown={(e) => { e.preventDefault(); pick(o.label); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: 13, color: 'var(--ink)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-softer)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              {o.color && <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color, flex: 'none' }} />}
              <span style={{ flex: 1 }}>{o.label}</span>
            </div>
          ))}
          {!exact && draft && (
            <div onMouseDown={(e) => { e.preventDefault(); pick(draft); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontSize: 13, color: 'var(--accent)',
                borderTop: filtered.length ? '1px solid var(--line)' : 'none',
                marginTop: filtered.length ? 4 : 0
              }}>
              <Icon name="plus" size={13} />
              <span>Create &ldquo;{draft}&rdquo;</span>
            </div>
          )}
          {!filtered.length && !draft && (
            <div style={{ padding: '7px 10px', color: 'var(--ink-3)', fontSize: 12 }}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
};

export const Segmented = ({ value, onChange, options }) => (
  <div style={{
    display: 'inline-flex', background: 'var(--panel-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius)', padding: 3, gap: 2
  }}>
    {options.map((o) => {
      const sel = value === o.value;
      return (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 12px', border: 'none', cursor: 'pointer',
          background: sel ? 'var(--panel)' : 'transparent',
          color: sel ? 'var(--ink)' : 'var(--ink-2)',
          borderRadius: 'calc(var(--radius) - 3px)',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
          boxShadow: sel ? 'var(--shadow)' : 'none'
        }}>{o.label}</button>
      );
    })}
  </div>
);

// Description: the amber, dismissible form-level error banner (SPEC §8.3).
// Inputs:  message (falsy renders nothing), onDismiss
// Outputs: banner element or null
export const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', marginBottom: 12,
      background: 'rgba(176,123,42,0.10)', border: '1px solid rgba(176,123,42,0.30)',
      borderRadius: 'var(--radius)', color: 'var(--ink)'
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999, flex: 'none',
        background: 'var(--warn)', color: 'var(--accent-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, marginTop: 1
      }}>!</span>
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{message}</div>
      {onDismiss && (
        <button onClick={onDismiss} title="Dismiss" style={{
          width: 20, height: 20, border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--ink-3)', borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none'
        }}><Icon name="x" size={11} /></button>
      )}
    </div>
  );
};

// Description: the 28 px countdown ring, 60 → 0, arc shrinking clockwise with
//              remaining seconds in the centre (SPEC §8.3). Purely visual —
//              the core owns the actual timeout.
// Inputs:  seconds, total
// Outputs: ring element
export const CountdownRing = ({ seconds, total }) => {
  const r = 9.5;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, seconds) / total);
  return (
    <div style={{ position: 'relative', width: 28, height: 28, flex: 'none' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="12" cy="12" r={r} stroke="var(--line)" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r={r} stroke="var(--accent)" strokeWidth="2" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)'
      }}>{Math.max(0, seconds)}</span>
    </div>
  );
};

// Description: labelled field with required marker + red invalid state.
// Inputs:  label, required, error, errorText, mode, children
// Outputs: field wrapper
export const V2Field = ({ label, required, error, errorText = 'Required', mode = 'light', children }) => {
  const danger = dangerColor(mode);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <Label>{label}</Label>
        {required && (
          <span style={{
            fontSize: 9, color: error ? danger : 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.08em'
          }}>· REQUIRED</span>
        )}
      </div>
      <div style={{ position: 'relative', ...(error ? { '--line': danger, '--accent': danger } : {}) }}>
        {children}
      </div>
      {error && (
        <div style={{
          marginTop: 5, fontSize: 11, color: danger,
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.02em'
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 999, background: danger,
            color: 'var(--panel)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, flex: 'none'
          }}>!</span>
          {errorText}
        </div>
      )}
    </div>
  );
};

// Description: warm-rust context badge for the focus check-in contexts.
// Inputs:  variant ('end' filled | 'interrupt' outlined), mode, icon, children
// Outputs: badge element
export const ContextBadge = ({ variant = 'end', mode = 'light', children, icon }) => {
  const w = warmPalette(mode);
  const filled = variant === 'end';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 7px',
      background: filled ? w.soft : 'transparent',
      color: w.base,
      border: `1px solid ${filled ? 'transparent' : w.border}`,
      borderRadius: 999, fontSize: 10.5,
      fontFamily: 'var(--font-mono)', fontWeight: 500,
      letterSpacing: '0.02em', whiteSpace: 'nowrap'
    }}>
      {icon && (
        <span style={{
          width: 12, height: 12, borderRadius: 999,
          background: filled ? w.base : 'transparent',
          border: filled ? 'none' : `1px solid ${w.base}`,
          color: filled ? w.ink : w.base,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-body)'
        }}>{icon}</span>
      )}
      {children}
    </span>
  );
};

// Description: the quiet "auto-prompts paused" pill (engagement lull).
// Inputs:  time — 'HH:MM' of last activity
// Outputs: pill element
export const EngagementPausedPill = ({ time }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '4px 10px', background: 'var(--panel-alt)',
    border: '1px solid var(--line)', borderRadius: 999,
    color: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em'
  }}>
    <Icon name="pause" size={10} />
    Paused · no activity since {time}
  </span>
);

// Description: the six interval chips — exactly the allowed set (SPEC §3.2).
// Inputs:  value, onChange
// Outputs: chip row
export const IntervalChips = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 5 }}>
    {ALLOWED_INTERVALS_MIN.map((m) => {
      const sel = m === value;
      return (
        <button key={m} onClick={() => onChange(m)} style={{
          flex: 1, padding: '7px 0', fontSize: 12,
          fontFamily: 'var(--font-mono)', fontWeight: 500,
          border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
          background: sel ? 'var(--accent-soft)' : 'var(--panel)',
          color: sel ? 'var(--accent)' : 'var(--ink-2)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer', minWidth: 0
        }}>{m}m</button>
      );
    })}
  </div>
);

export const KpiTile = ({ value, label, sub }) => (
  <div style={{
    padding: '10px 12px', background: 'var(--panel-alt)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius)'
  }}>
    <div style={{
      fontFamily: 'var(--font-display)', fontWeight: 500,
      fontSize: 20, lineHeight: 1, color: 'var(--ink)',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
    }}>{value}</div>
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Label>{label}</Label>
      {sub && <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{sub}</span>}
    </div>
  </div>
);
