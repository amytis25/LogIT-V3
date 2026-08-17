// V2 popups — Start-logging (NEW), Check-in (5 contexts), Focus (2 variants).
// All reuse the existing PopWindow shell. Backward-looking copy throughout.

// ─── helpers ────────────────────────────────────────────────────────────────
const v2InfoCard = ({ icon = 'focus', children, accent = 'sage', mode = 'light' }) => {
  const tone = accent === 'warn' ? v2WarnPalette(mode) : null;
  return (
    <div style={{
      padding: '10px 12px',
      background: tone ? tone.softer : 'var(--accent-softer)',
      border: tone ? `1px solid ${tone.line}` : '1px solid transparent',
      borderRadius: 'var(--radius)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45,
    }}>
      <Icon name={icon} size={14}
        style={{ color: tone ? tone.base : 'var(--accent)', flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

// ─── 1. START-LOGGING POPUP (NEW) ───────────────────────────────────────────
// Fires when timer ticks while INACTIVE (no open row). Short, ~340–380 tall.
const StartLoggingPopup = ({ mode, onToggleMode }) => {
  const [seconds, setSeconds] = React.useState(58);
  React.useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <button style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--ink-2)', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <Icon name="chart" size={12} /> View dashboard
      </button>
      <div style={{ flex: 1 }} />
      <Btn size="sm" kind="ghost">Skip</Btn>
      <Btn size="sm" kind="secondary" icon="focus">Focus mode</Btn>
      <Btn size="sm" kind="primary" icon="play">Start logging</Btn>
    </div>
  );

  const [error, setError] = React.useState('');

  return (
    <PopWindow title="Resume logging?" subtitle="14:30 · paused"
      right={<CountdownRing seconds={seconds} total={60} />}
      mode={mode} onToggleMode={onToggleMode} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--heading-weight)',
          letterSpacing: 'var(--letter-title)',
          fontSize: 18, lineHeight: 1.25, color: 'var(--ink)',
        }}>
          You haven&rsquo;t logged anything since{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500 }}>13:45</span>.
        </div>
        {v2InfoCard({
          icon: 'play',
          children: (
            <span>
              Start a new logging block now, or jump straight into a focus session.
              Skip to silence prompts for the next hour.
            </span>
          ),
        })}
      </div>
    </PopWindow>
  );
};

// ─── 2. CHECK-IN POPUP — 5 contexts + validation error ──────────────────────
// All share the same form: CATEGORY (required), PROJECT (required), WHAT WAS DONE.
// Differ in: title/subtitle copy, badge, buttons, X-close, countdown ring,
// inline "Switch to focus" button.

const CHECKIN_CONTEXTS = {
  interval: {
    title: 'What did you do?',
    subtitle: 'since 14:02 · check-in #4',
    countdown: true,
    closeable: true,
    showSwitchToFocus: true,
    badge: null,
    helper: null,
    buttons: ['view', 'skip', 'submit'],
  },
  offcycle: {
    title: 'What did you do?',
    subtitle: 'since 14:02 · manual check-in',
    countdown: true,
    closeable: true,
    showSwitchToFocus: true,
    badge: null,
    helper: null,
    buttons: ['view', 'skip', 'submit'],
  },
  focus_end: {
    title: 'What did you do?',
    subtitle: 'since 13:30 · focus complete',
    countdown: true,
    closeable: false,
    showSwitchToFocus: false,
    badge: { variant: 'end', text: 'Focus complete', icon: '✓' },
    helper: null,
    buttons: ['submit-and-view', 'submit'],
  },
  focus_interrupt: {
    title: 'What did you do?',
    subtitle: 'since 13:30 · interrupt focus?',
    countdown: true,
    closeable: true,
    showSwitchToFocus: false,
    badge: { variant: 'interrupt', text: 'Focus active · interrupt?', icon: '?' },
    helper: 'Submitting ends focus and starts normal logging. View dashboard keeps focus running.',
    buttons: ['view-focus', 'submit-end-focus'],
  },
  exit_prompt: {
    title: 'What did you do?',
    subtitle: 'since 14:02 · closing',
    countdown: false,
    closeable: true,
    showSwitchToFocus: false,
    badge: null,
    helper: 'Closing — what was the last block?',
    helperTone: 'warn',
    buttons: ['view-cancel', 'discard-exit', 'submit-exit'],
  },
};

// Custom title bar that supports hiding the X close button (FOCUS_END).
const V2CheckInTitleBar = ({
  title, subtitle, badge, right, mode, onToggleMode, closeable = true,
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--panel-alt)',
    flex: 'none',
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 6,
      background: 'var(--accent)', color: 'var(--accent-ink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    }}>
      <Icon name="logo" size={16} />
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--heading-weight)',
          letterSpacing: 'var(--letter-title)',
          fontSize: 14, color: 'var(--ink)', lineHeight: 1.1,
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</span>
        {badge && (
          <ContextBadge variant={badge.variant} mode={mode} icon={badge.icon}>
            {badge.text}
          </ContextBadge>
        )}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 10.5, color: 'var(--ink-3)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          marginTop: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{subtitle}</div>
      )}
    </div>
    {right}
    <ModeToggle mode={mode} onToggle={onToggleMode} />
    {closeable && <CloseBtn />}
  </div>
);

const renderCheckInFooter = (ctx) => {
  const buttons = ctx.buttons;
  // Tiny helpers
  const ViewDashGhost = ({ label = 'View dashboard' }) => (
    <button style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: 'var(--ink-2)', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
      fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    }}>
      <Icon name="chart" size={12} /> {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {buttons.includes('view') && <ViewDashGhost />}
      {buttons.includes('view-focus') && <ViewDashGhost label="View dashboard" />}
      {buttons.includes('view-cancel') && <ViewDashGhost label="Cancel exit" />}
      {buttons.includes('submit-and-view') && (
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--ink-2)', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
        }}>
          <Icon name="chart" size={12} /> Submit and view dashboard
        </button>
      )}
      <div style={{ flex: 1 }} />
      {buttons.includes('skip') && <Btn size="sm" kind="ghost">Skip</Btn>}
      {buttons.includes('discard-exit') && <Btn size="sm" kind="ghost">Discard &amp; exit</Btn>}
      {buttons.includes('submit') && <Btn size="sm" kind="primary" iconAfter="arrow-right">Submit</Btn>}
      {buttons.includes('submit-end-focus') && (
        <Btn size="sm" kind="primary" iconAfter="arrow-right">End focus &amp; submit</Btn>
      )}
      {buttons.includes('submit-exit') && (
        <Btn size="sm" kind="primary" iconAfter="arrow-right">Submit &amp; exit</Btn>
      )}
    </div>
  );
};

const CheckInPopupV2 = ({
  context = 'interval',
  mode, onToggleMode,
  invalid = false,         // when true: shows validation styling + ErrorBanner
}) => {
  const ctx = CHECKIN_CONTEXTS[context];
  const [cat, setCat]     = React.useState(invalid ? '' : 'Deep Work');
  const [proj, setProj]   = React.useState(invalid ? '' : 'Frontend');
  const [notes, setNotes] = React.useState('Tightened the dashboard timeline rows and shipped the chip resize.');
  const [seconds, setSeconds] = React.useState(54);
  React.useEffect(() => {
    if (!ctx.countdown) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [ctx.countdown]);

  // Apply warm accent scope for focus-related contexts so badge + helper card
  // pick up the rust tone consistently — but the form fields still use sage.
  const isFocusCtx = context === 'focus_end' || context === 'focus_interrupt';

  return (
    <PopWindowCustomTitle
      mode={mode}
      title={ctx.title}
      subtitle={ctx.subtitle}
      badge={ctx.badge}
      closeable={ctx.closeable}
      onToggleMode={onToggleMode}
      right={ctx.countdown ? <CountdownRing seconds={seconds} total={60} /> : null}
      footer={renderCheckInFooter(ctx)}
    >
      {invalid && (
        <ErrorBanner message="Category and project are required." />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <V2Field label="CATEGORY" required mode={mode} error={invalid}>
          <Combo value={cat} onChange={setCat}
            options={CATEGORIES.map((c) => ({ ...c }))}
            placeholder="Pick a category…"
            dot={cat ? catColor(cat) : undefined} icon="tag" />
        </V2Field>
        <V2Field label="PROJECT" required mode={mode} error={invalid}>
          <Combo value={proj} onChange={setProj}
            options={PROJECTS.map((p) => ({ ...p }))}
            placeholder="Pick a project…"
            dot={proj ? projColor(proj) : undefined} icon="folder" />
        </V2Field>
        <V2Field label="WHAT WAS DONE" mode={mode}>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — a quick note about the block that just ended."
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--panel-alt)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '10px 12px',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)',
              outline: 'none', resize: 'none', lineHeight: 1.5,
            }}
          />
        </V2Field>

        {ctx.helper && (
          v2InfoCard({
            icon: isFocusCtx ? 'focus' : 'clock',
            accent: ctx.helperTone || (isFocusCtx ? 'warn' : 'sage'),
            mode,
            children: <span>{ctx.helper}</span>,
          })
        )}

        {ctx.showSwitchToFocus && (
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: '1px dashed var(--line-strong)',
            color: 'var(--ink-2)', padding: '8px 12px', borderRadius: 'var(--radius)',
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
            alignSelf: 'flex-start',
          }}>
            <Icon name="focus" size={13} style={{ color: 'var(--accent)' }} />
            Switch to focus mode →
          </button>
        )}
      </div>
    </PopWindowCustomTitle>
  );
};

// Custom version of PopWindow that takes the v2 title-bar (with optional badge,
// optional close button).
const PopWindowCustomTitle = ({
  title, subtitle, badge, right, mode, onToggleMode,
  closeable = true, children, footer,
}) => (
  <div style={{
    width: POP_W,
    background: 'var(--panel)',
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-pop)',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-body)', color: 'var(--ink)',
  }}>
    <V2CheckInTitleBar
      title={title} subtitle={subtitle} badge={badge} right={right}
      mode={mode} onToggleMode={onToggleMode} closeable={closeable} />
    <div style={{ padding: '14px 16px' }}>{children}</div>
    {footer && (
      <div style={{
        flex: 'none', padding: '12px 14px',
        borderTop: '1px solid var(--line)', background: 'var(--panel-alt)',
      }}>{footer}</div>
    )}
  </div>
);

// ─── 3. FOCUS POPUP — 2 variants ────────────────────────────────────────────
// Variant A — INACTIVE: simple time picker, no category/project/notes.
// Variant B — ACTIVE NORMAL: "wrap up current block" form + new focus session.

const FocusPopupInactiveV2 = ({ mode, onToggleMode }) => {
  const [start, setStart] = React.useState('14:30');
  const [end, setEnd]     = React.useState('15:30');
  const [error, setError] = React.useState('');

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
        Duration <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>1h 00m</span>
      </div>
      <div style={{ flex: 1 }} />
      <Btn size="sm" kind="secondary" icon="clock">Check in regularly</Btn>
      <Btn size="sm" kind="primary" icon="play">Begin focus</Btn>
    </div>
  );

  return (
    <PopWindow title="Start focus session" subtitle="popups suppressed until end"
      mode={mode} onToggleMode={onToggleMode} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <V2Field label="START" mode={mode}>
            <TextField value={start} onChange={setStart} icon="clock" mono readOnly />
          </V2Field>
          <V2Field label="END" mode={mode}>
            <TextField value={end} onChange={setEnd} icon="clock" mono />
          </V2Field>
        </div>
        {v2InfoCard({
          icon: 'focus',
          children: (
            <span>
              You&rsquo;ll fill in what you did when the session ends.
              Periodic check-ins pause until <span style={{ fontFamily: 'var(--font-mono)' }}>{end}</span>.
            </span>
          ),
        })}
      </div>
    </PopWindow>
  );
};

const FocusPopupActiveV2 = ({ mode, onToggleMode }) => {
  const [cat, setCat]     = React.useState('Deep Work');
  const [proj, setProj]   = React.useState('Frontend');
  const [notes, setNotes] = React.useState('');
  const [start, setStart] = React.useState('14:30');
  const [end, setEnd]     = React.useState('15:30');
  const [error, setError] = React.useState('');

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1 }} />
      <Btn size="sm" kind="secondary" icon="clock">Check in regularly</Btn>
      <Btn size="sm" kind="primary" icon="play">Begin focus</Btn>
    </div>
  );

  const SectionHead = ({ children, hint }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--heading-weight)',
        letterSpacing: 'var(--letter-title)',
        fontSize: 12.5, color: 'var(--ink)',
      }}>{children}</div>
      {hint && (
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {hint}
        </span>
      )}
    </div>
  );

  return (
    <PopWindow title="Switch to focus mode" subtitle="wrap up · then begin focus"
      mode={mode} onToggleMode={onToggleMode} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHead hint="since 14:02">Wrap up current block</SectionHead>
        <V2Field label="CATEGORY" required mode={mode}>
          <Combo value={cat} onChange={setCat}
            options={CATEGORIES.map((c) => ({ ...c }))} dot={catColor(cat)} icon="tag" />
        </V2Field>
        <V2Field label="PROJECT" required mode={mode}>
          <Combo value={proj} onChange={setProj}
            options={PROJECTS.map((p) => ({ ...p }))} dot={projColor(proj)} icon="folder" />
        </V2Field>
        <V2Field label="WHAT WAS DONE" mode={mode}>
          <TextField value={notes} onChange={setNotes}
            placeholder="Optional — one line about the just-ending block." />
        </V2Field>

        <div style={{
          height: 1, background: 'var(--line)', margin: '6px -2px',
        }} />

        <SectionHead hint="60 min">New focus session</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <V2Field label="START" mode={mode}>
            <TextField value={start} onChange={setStart} icon="clock" mono readOnly />
          </V2Field>
          <V2Field label="END" mode={mode}>
            <TextField value={end} onChange={setEnd} icon="clock" mono />
          </V2Field>
        </div>
      </div>
    </PopWindow>
  );
};

Object.assign(window, {
  StartLoggingPopup,
  CheckInPopupV2,
  FocusPopupInactiveV2,
  FocusPopupActiveV2,
  CHECKIN_CONTEXTS,
});
