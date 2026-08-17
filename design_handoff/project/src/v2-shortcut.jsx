// V2 Floating shortcut — 4 states (normal, focus, inactive, paused).
// 84×84 rounded square with logo + a progress ring offset just outside.

const SHORTCUT_SIZE = 84;
const SHORTCUT_RADIUS = 21;

const FloatingShortcutV2 = ({ state = 'normal', mode = 'light' }) => {
  const SIZE = SHORTCUT_SIZE;
  const R = SHORTCUT_RADIUS;
  const w = v2WarnPalette(mode);

  // Per-state ring + button styling
  const cfg = (() => {
    switch (state) {
      case 'focus':
        return {
          ringColor: w.base,
          ringTrack: 'var(--line)',
          ringPct: 0.55,        // progress toward focus end
          logoColor: w.base,
          ringPulse: false,
          showPauseGlyph: false,
          showFocusRing: true,
          opacity: 1,
          title: 'Focus active — tap to interrupt',
        };
      case 'inactive':
        return {
          ringColor: 'var(--ink-4)',
          ringTrack: 'var(--line)',
          ringPct: 0,           // no progress yet
          logoColor: 'var(--accent)',
          ringPulse: false,
          showPauseGlyph: false,
          showFocusRing: false,
          opacity: 1,
          title: 'No open block — tap to start logging',
        };
      case 'paused':
        return {
          ringColor: 'var(--ink-4)',
          ringTrack: 'var(--line)',
          ringPct: 0,
          logoColor: 'var(--ink-3)',
          ringPulse: false,
          showPauseGlyph: true,
          showFocusRing: false,
          opacity: 0.7,
          title: 'Paused — tap to resume',
        };
      default: // normal
        return {
          ringColor: 'var(--accent)',
          ringTrack: 'var(--line)',
          ringPct: 0.38,
          logoColor: 'var(--accent)',
          ringPulse: false,
          showPauseGlyph: false,
          showFocusRing: false,
          opacity: 1,
          title: 'Tap to check in',
        };
    }
  })();

  const RECT_W = SIZE + 4;
  const PERIMETER = 4 * RECT_W;

  return (
    <div style={{ padding: 12, opacity: cfg.opacity, transition: 'opacity 200ms' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* progress ring (offset slightly outside the button) */}
        <svg width={SIZE + 10} height={SIZE + 10}
          viewBox={`0 0 ${SIZE + 10} ${SIZE + 10}`}
          style={{ position: 'absolute', top: -5, left: -5, transform: 'rotate(-90deg)' }}>
          <rect x="3" y="3" width={RECT_W} height={RECT_W} rx={R + 4}
            fill="none" stroke={cfg.ringTrack} strokeWidth="2" />
          {cfg.ringPct > 0 && (
            <rect x="3" y="3" width={RECT_W} height={RECT_W} rx={R + 4}
              fill="none" stroke={cfg.ringColor} strokeWidth="2"
              strokeDasharray={PERIMETER}
              strokeDashoffset={PERIMETER * (1 - cfg.ringPct)}
              strokeLinecap="round" />
          )}
          {/* In paused state, draw a dashed dim ring for "no activity" hint */}
          {state === 'paused' && (
            <rect x="3" y="3" width={RECT_W} height={RECT_W} rx={R + 4}
              fill="none" stroke={cfg.ringColor} strokeWidth="2"
              strokeDasharray="3 4"
              opacity="0.6" />
          )}
        </svg>

        {/* button — uses the logo icon directly */}
        <button title={cfg.title}
          style={{
            width: SIZE, height: SIZE, padding: 0,
            background: 'transparent', color: cfg.logoColor,
            border: 'none', borderRadius: R,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(var(--shadow-pop))',
            transition: 'transform 120ms',
          }}
        >
          <Icon name="logo" size={SIZE} />
        </button>

        {/* Focus ring overlay — small inner ring around the clock-hand to
            reinforce the "in focus" mode */}
        {cfg.showFocusRing && (
          <span style={{
            position: 'absolute',
            top: 10, right: 10,
            width: 16, height: 16, borderRadius: 999,
            background: w.base, color: mode === 'dark' ? '#1a1612' : '#fbf7ec',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid var(--panel)`,
            boxShadow: 'var(--shadow)',
          }}>
            <Icon name="focus" size={9} />
          </span>
        )}

        {/* Paused glyph overlay */}
        {cfg.showPauseGlyph && (
          <span style={{
            position: 'absolute',
            top: 10, right: 10,
            width: 18, height: 18, borderRadius: 999,
            background: 'var(--panel)', color: 'var(--ink-3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--line-strong)',
            boxShadow: 'var(--shadow)',
          }}>
            <Icon name="pause" size={9} />
          </span>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { FloatingShortcutV2, SHORTCUT_SIZE, SHORTCUT_RADIUS });
