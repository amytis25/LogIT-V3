// V2 shared helpers — warm-rust accent (focus context), engagement pause pill,
// context badges, validation field wrapper, mono clock display, and the new
// IntervalChips that include 5m.

// Compute warm-rust palette derived from --warn token for a given mode.
const v2WarnPalette = (mode) => {
  const base = mode === 'dark' ? '#dca566' : '#b07b2a';
  return {
    base,
    soft:   hexAlpha(base, 0.14),
    softer: hexAlpha(base, 0.06),
    border: hexAlpha(base, 0.30),
    line:   hexAlpha(base, 0.22),
  };
};

// Wrap children in a div that overrides --accent and accent-soft/softer with
// the warm-rust palette. Useful for focus-context popups / cards.
const WarmAccentScope = ({ mode, style, children }) => {
  const w = v2WarnPalette(mode);
  return (
    <div style={{
      '--accent': w.base,
      '--accent-soft': w.soft,
      '--accent-softer': w.softer,
      '--accent-ink': mode === 'dark' ? '#1a1612' : '#fbf7ec',
      ...style,
    }}>
      {children}
    </div>
  );
};

// V2 IntervalChips — same UI as v1, but with 5m included.
const V2IntervalChips = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 5 }}>
    {[5, 10, 15, 20, 30, 45, 60].map((m) => {
      const sel = m === value;
      return (
        <button key={m} onClick={() => onChange && onChange(m)} style={{
          flex: 1, padding: '7px 0', fontSize: 12,
          fontFamily: 'var(--font-mono)', fontWeight: 500,
          border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
          background: sel ? 'var(--accent-soft)' : 'var(--panel)',
          color: sel ? 'var(--accent)' : 'var(--ink-2)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          transition: 'all 120ms', minWidth: 0,
        }}>{m}m</button>
      );
    })}
  </div>
);

// Small pill that signals the app has paused auto-prompting after inactivity.
// Uses --ink-3 + --panel-alt for a quiet, informative tone (per spec).
const EngagementPausedPill = ({ time = '13:45', style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '4px 10px',
    background: 'var(--panel-alt)',
    border: '1px solid var(--line)',
    borderRadius: 999,
    color: 'var(--ink-3)',
    fontSize: 11, fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em',
    ...style,
  }}>
    <span style={{
      width: 8, height: 8, borderRadius: 2,
      background: 'transparent',
      border: '1.5px solid var(--ink-3)',
      position: 'relative', flex: 'none',
    }}>
      <span style={{
        position: 'absolute', top: 0, left: 1, width: 1.5, height: 4,
        background: 'var(--ink-3)',
      }} />
      <span style={{
        position: 'absolute', top: 0, right: 1, width: 1.5, height: 4,
        background: 'var(--ink-3)',
      }} />
    </span>
    Paused · no activity since {time}
  </span>
);

// Context badge for Check-in popups — variant=end (filled, "Focus complete")
// or variant=interrupt (outlined, "Focus active · interrupt?"). Both warm-rust.
const ContextBadge = ({ variant = 'end', mode = 'light', children, icon }) => {
  const w = v2WarnPalette(mode);
  const filled = variant === 'end';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 7px',
      background: filled ? w.soft : 'transparent',
      color: w.base,
      border: `1px solid ${filled ? 'transparent' : w.border}`,
      borderRadius: 999,
      fontSize: 10.5,
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {icon && (
        <span style={{
          width: 12, height: 12, borderRadius: 999,
          background: filled ? w.base : 'transparent',
          border: filled ? 'none' : `1px solid ${w.base}`,
          color: filled ? (mode === 'dark' ? '#1a1612' : '#fbf7ec') : w.base,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700,
          fontFamily: 'var(--font-body)',
        }}>{icon}</span>
      )}
      {children}
    </span>
  );
};

// Field wrapper with a validation-error state — red border + "Required" hint.
// Picks up a small "danger" red tuned to the warm palette.
const v2DangerColor = (mode) => mode === 'dark' ? '#d97a72' : '#b3503a';

const V2Field = ({ label, required, error, errorText = 'Required', mode = 'light', children }) => {
  const danger = v2DangerColor(mode);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6,
      }}>
        <Label>{label}</Label>
        {required && (
          <span style={{
            fontSize: 9, color: error ? danger : 'var(--ink-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
          }}>·  REQUIRED</span>
        )}
      </div>
      <div data-v2-invalid={error ? 'true' : undefined} style={{
        // When invalid, the inner label/input gets a red border via descendant style below.
        position: 'relative',
        ...(error ? { '--line': danger, '--accent': danger } : {}),
      }}>
        {children}
      </div>
      {error && (
        <div style={{
          marginTop: 5, fontSize: 11, color: danger,
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 999, background: danger,
            color: 'var(--panel)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-body)',
            flex: 'none',
          }}>!</span>
          {errorText}
        </div>
      )}
    </div>
  );
};

// "Live elapsed counter" — pre-rendered, ticking demo. Format "23m 14s".
const LiveElapsed = ({ start = '14:02', current = '14:25', extraSecs = 14, style }) => {
  const [sh, sm] = start.split(':').map(Number);
  const [ch, cm] = current.split(':').map(Number);
  const totalSec = (ch * 3600 + cm * 60 + extraSecs) - (sh * 3600 + sm * 60);
  const [tick, setTick] = React.useState(totalSec);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(tick / 3600);
  const m = Math.floor((tick % 3600) / 60);
  const s = tick % 60;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      ...style,
    }}>
      {h > 0 && `${h}h `}{m}m {String(s).padStart(2, '0')}s
    </span>
  );
};

// Countdown to a fixed end time, in mm:ss or hh:mm:ss.
const CountdownTo = ({ totalSecs = 32 * 60, style }) => {
  const [t, setT] = React.useState(totalSecs);
  React.useEffect(() => {
    const id = setInterval(() => setT((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const fmt = (n) => String(n).padStart(2, '0');
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      ...style,
    }}>
      {h > 0 ? `${fmt(h)}:${fmt(m)}:${fmt(s)}` : `${fmt(m)}:${fmt(s)}`}
    </span>
  );
};

Object.assign(window, {
  v2WarnPalette, WarmAccentScope, V2IntervalChips,
  EngagementPausedPill, ContextBadge, V2Field, v2DangerColor,
  LiveElapsed, CountdownTo,
});
