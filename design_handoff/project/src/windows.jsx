// Four popup windows for the LogIT app.
// Two compact popups (Check-in, Focus mode) at 400×540.
// Two larger sidebar-shell windows (Startup, Dashboard) at 880×600.
// All share a chrome title bar with logo + title + in-window dark/light toggle + close.

const POP_W = 400, POP_H = 540;
const SHELL_W = 880, SHELL_H = 600;

// ─── CHROME ─────────────────────────────────────────────────────────────────
const ModeToggle = ({ mode, onToggle }) => (
  <button
    title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
    onClick={onToggle}
    style={{
      width: 28, height: 24, border: '1px solid var(--line)',
      background: 'var(--panel)', color: 'var(--ink-2)',
      cursor: 'pointer', borderRadius: 'var(--radius-sm)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flex: 'none', transition: 'background 120ms, color 120ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--accent-softer)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'var(--panel)'; }}
  >
    <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={13} />
  </button>
);

const CloseBtn = () => (
  <button title="Close" style={{
    width: 24, height: 24, border: 'none', background: 'transparent',
    cursor: 'pointer', color: 'var(--ink-3)', borderRadius: 'var(--radius-sm)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)'; }}
  >
    <Icon name="x" size={13} />
  </button>
);

// Compact title bar (used in all 4 windows).
const TitleBar = ({ title, subtitle, right, mode, onToggleMode, showLogo = true }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--panel-alt)',
    flex: 'none',
  }}>
    {showLogo && (
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      }}>
        <Icon name="logo" size={16} />
      </span>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--heading-weight)',
        letterSpacing: 'var(--letter-title)',
        fontSize: 14, color: 'var(--ink)', lineHeight: 1.1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: 10.5, color: 'var(--ink-3)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{subtitle}</div>
      )}
    </div>
    {right}
    <ModeToggle mode={mode} onToggle={onToggleMode} />
    <CloseBtn />
  </div>
);

// Small popup shell (Check-in, Focus).
const PopWindow = ({ title, subtitle, right, mode, onToggleMode, children, footer }) => (
  <div style={{
    width: POP_W,
    background: 'var(--panel)',
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-pop)',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    fontFamily: 'var(--font-body)', color: 'var(--ink)',
  }}>
    <TitleBar title={title} subtitle={subtitle} right={right} mode={mode} onToggleMode={onToggleMode} />
    <div style={{ padding: '14px 16px' }}>{children}</div>
    {footer && (
      <div style={{
        flex: 'none', padding: '12px 14px',
        borderTop: '1px solid var(--line)', background: 'var(--panel-alt)',
      }}>{footer}</div>
    )}
  </div>
);

// Larger sidebar shell (Startup, Dashboard).
const ShellWindow = ({ title, subtitle, view, onChangeView, mode, onToggleMode, children }) => {
  const nav = [
    { id: 'dashboard',  icon: 'clock',  label: 'Dashboard' },
    { id: 'manual',     icon: 'pencil', label: 'Manual entry' },
    { id: 'analytics',  icon: 'chart',  label: 'Analytics' },
    { id: 'categories', icon: 'tag',    label: 'Categories' },
    { id: 'projects',   icon: 'folder', label: 'Projects' },
  ];
  return (
    <div style={{
      width: SHELL_W,
      background: 'var(--panel)',
      border: '1px solid var(--line-strong)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-pop)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-body)', color: 'var(--ink)',
    }}>
      <TitleBar title={title} subtitle={subtitle} mode={mode} onToggleMode={onToggleMode} />
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* sidebar */}
        <aside style={{
          width: 180, flex: 'none',
          borderRight: '1px solid var(--line)',
          background: 'var(--panel-alt)',
          padding: '14px 10px',
          display: 'flex', flexDirection: 'column',
        }}>
          {nav.map((n) => {
            const sel = n.id === view;
            return (
              <button key={n.id} onClick={() => onChangeView && onChangeView(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', marginBottom: 1,
                border: 'none', background: sel ? 'var(--panel)' : 'transparent',
                boxShadow: sel ? 'var(--shadow)' : 'none',
                color: sel ? 'var(--ink)' : 'var(--ink-2)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: sel ? 500 : 400,
                textAlign: 'left', transition: 'background 100ms, color 100ms',
              }}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.color = 'var(--ink-2)'; }}
              >
                <Icon name={n.icon} size={14} style={{ color: sel ? 'var(--accent)' : 'var(--ink-3)' }} />
                <span style={{ flex: 1 }}>{n.label}</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
        </aside>
        {/* main */}
        <main style={{ flex: 1, minWidth: 0, padding: '18px 22px' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

// Per-view title/subtitle for the shell title bar (used by Startup + Dashboard).
const SECTION_META = {
  manual:     { title: 'Manual entry', subtitle: 'retroactive logging' },
  analytics:  { title: 'Analytics',    subtitle: 'last 7 days · real CSV data' },
  categories: { title: 'Categories',   subtitle: 'activity buckets' },
  projects:   { title: 'Projects',     subtitle: 'optional groupings' },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
const Field = ({ label, children, style }) => (
  <div style={{ minWidth: 0, ...style }}>
    <Label style={{ marginBottom: 6 }}>{label}</Label>
    {children}
  </div>
);

const CountdownRing = ({ seconds, total }) => {
  const r = 9.5;
  const c = 2 * Math.PI * r;
  const off = c * (1 - seconds / total);
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
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-2)',
      }}>{seconds}</span>
    </div>
  );
};

const SparkBars = ({ height = 56 }) => {
  const max = Math.max(...DAYS.map(dayHours));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {DAYS.map((d) => {
        const stacks = {};
        d.entries.forEach((e) => { stacks[e.cat] = (stacks[e.cat] || 0) + hoursOf(e); });
        const total = dayHours(d);
        return (
          <div key={d.date} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, height: '100%',
          }}>
            <div style={{
              width: '100%', flex: 1,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              <div style={{
                width: '100%',
                height: max ? `${(total / max) * 100}%` : 0,
                display: 'flex', flexDirection: 'column-reverse',
                borderRadius: 3, overflow: 'hidden', minHeight: 3,
              }}>
                {Object.entries(stacks).map(([cat, h]) => (
                  <div key={cat} style={{ height: `${(h / total) * 100}%`, background: catColor(cat) }} />
                ))}
              </div>
            </div>
            <div style={{
              fontSize: 9.5, fontFamily: 'var(--font-mono)',
              color: d.isToday ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: d.isToday ? 600 : 400, letterSpacing: '0.06em',
            }}>{d.day[0]}</div>
          </div>
        );
      })}
    </div>
  );
};

const IntervalChips = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 5 }}>
    {[10, 15, 20, 30, 45, 60].map((m) => {
      const sel = m === value;
      return (
        <button key={m} onClick={() => onChange(m)} style={{
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

// ErrorBanner — slot for form-level error messages.
// Renders nothing when no message; otherwise a warm dismissible row keyed off
// the warn token so it reads as "attention" without screaming.
const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', marginBottom: 12,
      background: hexAlpha('#b07b2a', 0.10),
      border: `1px solid ${hexAlpha('#b07b2a', 0.30)}`,
      borderRadius: 'var(--radius)',
      color: 'var(--ink)',
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999, flex: 'none',
        background: 'var(--warn)', color: 'var(--accent-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, marginTop: 1,
      }}>!</span>
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.45 }}>{message}</div>
      {onDismiss && (
        <button onClick={onDismiss} title="Dismiss" style={{
          width: 20, height: 20, border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--ink-3)', borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
        }}><Icon name="x" size={11} /></button>
      )}
    </div>
  );
};

// ─── 1. STARTUP (sidebar shell · idle state) ────────────────────────────────
// Body for the Dashboard tab in the Startup window (no active task).
const StartupHome = () => {
  const [interval, setIntervalMin] = React.useState(20);
  const weekHours = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const avg = weekHours / 7;
  return (
    <div>
      <div>
        <Label>NOTHING LOGGED YET TODAY</Label>
        <div style={{
          marginTop: 4, fontFamily: 'var(--font-display)',
          fontWeight: 'var(--heading-weight)', letterSpacing: 'var(--letter-title)',
          fontSize: 26, lineHeight: 1.1, color: 'var(--ink)',
        }}>Good afternoon.</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink-2)' }}>
          Tue · May 20 · last logged yesterday at 17:30
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1, padding: '15px 18px',
          background: 'var(--accent)', color: 'var(--accent-ink)',
          border: 'none', borderRadius: 'var(--radius)',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: 'var(--shadow)',
        }}>
          <Icon name="play" size={15} />
          Start logging
        </button>
        <button style={{
          padding: '15px 18px',
          background: 'var(--panel)', color: 'var(--ink)',
          border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="focus" size={14} style={{ color: 'var(--accent)' }} />
          Focus mode
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>CHECK IN EVERY</Label>
        <div style={{ marginTop: 8 }}><IntervalChips value={interval} onChange={setIntervalMin} /></div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          LogIT pings you every <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{interval}m</span>. Use the sidebar to jump into focus, manual entry, analytics or your category &amp; project libraries.
        </div>
      </div>

      <div style={{
        marginTop: 18, padding: 14,
        background: 'var(--panel-alt)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>LAST 7 DAYS</Label>
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
            {weekHours.toFixed(1)}h · avg {avg.toFixed(1)}h/d · {DAYS.reduce((s,d)=>s+d.entries.length,0)} entries
          </span>
        </div>
        <div style={{ marginTop: 10 }}><SparkBars height={64} /></div>
      </div>
    </div>
  );
};

const StartupWindow = ({ mode, onToggleMode }) => {
  const [view, setView] = React.useState('dashboard');
  const meta = view === 'dashboard'
    ? { title: 'LogIT', subtitle: 'ready when you are' }
    : SECTION_META[view];
  return (
    <ShellWindow {...meta} view={view} onChangeView={setView}
      mode={mode} onToggleMode={onToggleMode}>
      {view === 'dashboard'  && <StartupHome />}
      {view === 'manual'     && <ManualPane />}
      {view === 'analytics'  && <AnalyticsPane />}
      {view === 'categories' && <EditorPane kind="categories" />}
      {view === 'projects'   && <EditorPane kind="projects" />}
    </ShellWindow>
  );
};

// ─── 2. DASHBOARD (sidebar shell · active state) ────────────────────────────
// Body for the Dashboard tab in the Dashboard window (with active task).
const DashboardHome = () => {
  const [interval, setIntervalMin] = React.useState(20);
  const today = DAYS[DAYS.length - 1];
  const todayH = dayHours(today);
  const weekH = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const entries = today.entries;
  return (
    <div>
      {/* NOW card */}
      <div style={{
        padding: 14, background: 'var(--accent-softer)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <Label>NOW</Label>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999, background: 'var(--success)',
              boxShadow: `0 0 0 4px ${hexAlpha('#3f8a5b', 0.18)}`, flex: 'none',
            }} />
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>Deep Work</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>· Frontend</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
            started 11:30 · 1h 04m elapsed
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <Label>NEXT CHECK-IN</Label>
          <div style={{
            marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 18,
            fontWeight: 500, color: 'var(--ink)',
          }}>14:32</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            in 12m 14s
          </div>
        </div>
      </div>

      {/* Two-col: timeline + sidebar (7-day glance + interval) */}
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>TODAY · {entries.length} ENTRIES</Label>
            <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
              {todayH.toFixed(1)}h
            </span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {entries.map((e, i) => {
              const mins = Math.round(hoursOf(e) * 60);
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '70px 4px 1fr auto',
                  alignItems: 'center', gap: 8, padding: '6px 4px',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                    {e.start}–{e.end}
                  </span>
                  <span style={{ height: 18, width: 3, borderRadius: 2, background: catColor(e.cat) }} />
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{e.cat}</span>
                    {e.proj && e.proj !== '—' && (
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
                                      overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        · {e.proj}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                    {mins}m
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Btn size="sm" kind="primary" icon="plus" style={{ flex: 1, justifyContent: 'center' }}>
              Log activity
            </Btn>
            <Btn size="sm" kind="secondary" icon="focus">
              Focus mode
            </Btn>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: 12, background: 'var(--panel-alt)',
            border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label>LAST 7 DAYS</Label>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
                {weekH.toFixed(1)}h
              </span>
            </div>
            <div style={{ marginTop: 8 }}><SparkBars height={50} /></div>
          </div>
          <div style={{
            padding: 12, background: 'var(--panel-alt)',
            border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          }}>
            <Label>CHECK IN EVERY</Label>
            <div style={{ marginTop: 8 }}><IntervalChips value={interval} onChange={setIntervalMin} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardWindow = ({ mode, onToggleMode }) => {
  const [view, setView] = React.useState('dashboard');
  const meta = view === 'dashboard'
    ? { title: 'Today', subtitle: 'Tue · May 20 · live' }
    : SECTION_META[view];
  return (
    <ShellWindow {...meta} view={view} onChangeView={setView}
      mode={mode} onToggleMode={onToggleMode}>
      {view === 'dashboard'  && <DashboardHome />}
      {view === 'manual'     && <ManualPane />}
      {view === 'analytics'  && <AnalyticsPane />}
      {view === 'categories' && <EditorPane kind="categories" />}
      {view === 'projects'   && <EditorPane kind="projects" />}
    </ShellWindow>
  );
};

// ─── 3. CHECK-IN / LOG ACTIVITY (compact popup) ─────────────────────────────
const CheckInWindow = ({ mode, onToggleMode }) => {
  const [cat, setCat]     = React.useState('Deep Work');
  const [proj, setProj]   = React.useState('Frontend');
  const [notes, setNotes] = React.useState('');
  // Demo error state — in app this fills when submit fails (save error,
  // missing category, retry exhausted, etc.).
  const [error, setError] = React.useState('Couldn’t save — log file is read-only. Retrying in 5s…');
  const [countdown, setCountdown] = React.useState(58);
  React.useEffect(() => {
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <Btn size="sm" kind="primary" iconAfter="arrow-right">Submit</Btn>
    </div>
  );

  return (
    <PopWindow title="What are you up to?" subtitle="check-in #4 · 12:50"
      right={<CountdownRing seconds={countdown} total={60} />}
      mode={mode} onToggleMode={onToggleMode} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="CATEGORY">
          <Combo value={cat} onChange={setCat}
            options={CATEGORIES.map((c) => ({ ...c }))} dot={catColor(cat)} icon="tag" />
        </Field>
        <Field label="PROJECT">
          <Combo value={proj} onChange={setProj}
            options={PROJECTS.map((p) => ({ ...p }))} dot={projColor(proj)} icon="folder" />
        </Field>
        <Field label="NOTES (OPTIONAL)">
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="What's the shape of this stretch?"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--panel-alt)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '10px 12px',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)',
              outline: 'none', resize: 'none', lineHeight: 1.5,
            }}
          />
        </Field>
        <button style={{
          marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px dashed var(--line-strong)',
          color: 'var(--ink-2)', padding: '8px 12px', borderRadius: 'var(--radius)',
          fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
          alignSelf: 'flex-start',
        }}>
          <Icon name="focus" size={13} style={{ color: 'var(--accent)' }} />
          Switch to focus mode →
        </button>
      </div>
    </PopWindow>
  );
};

// ─── 4. FOCUS MODE (compact popup) ──────────────────────────────────────────
const FocusWindow = ({ mode, onToggleMode }) => {
  const [active, setActive] = React.useState(false);
  const [start, setStart] = React.useState('12:30');
  const [end, setEnd]     = React.useState('14:30');
  const [cat, setCat]     = React.useState('Deep Work');
  const [proj, setProj]   = React.useState('Frontend');
  const [goal, setGoal]   = React.useState('Wire up logging UI + retry');
  // Demo error state — in app this fills when validation fails or the session
  // can’t be persisted.
  const [error, setError] = React.useState('');

  const [remaining, setRemaining] = React.useState(66 * 60);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [active]);
  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (active) {
    return (
      <PopWindow title="Focus · live" subtitle={`${cat} · ${proj}`}
        right={<Pill style={{ fontSize: 9 }}>LIVE</Pill>}
        mode={mode} onToggleMode={onToggleMode}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Btn size="sm" kind="ghost">Extend +15m</Btn>
            <div style={{ flex: 1 }} />
            <Btn size="sm" kind="secondary" onClick={() => setActive(false)}>End session</Btn>
          </div>
        }
      >
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Label style={{ color: 'var(--accent)' }}>POPUPS SUPPRESSED</Label>
          <div style={{
            marginTop: 12, fontFamily: 'var(--font-mono)',
            fontSize: 56, fontWeight: 500, letterSpacing: '-0.02em',
            lineHeight: 1, color: 'var(--ink)',
          }}>{fmt(remaining)}</div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
            ends at <span style={{ fontFamily: 'var(--font-mono)' }}>{end}</span>
          </div>
          <div style={{ marginTop: 20, height: 3, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '45%', background: 'var(--accent)' }} />
          </div>
          <div style={{
            marginTop: 8, display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          }}>
            <span>{start}</span><span>54m · 45%</span><span>{end}</span>
          </div>
        </div>
        <div style={{
          marginTop: 20, padding: '12px 14px',
          background: 'var(--panel-alt)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', textAlign: 'left',
        }}>
          <Label>GOAL</Label>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>{goal}</div>
        </div>
      </PopWindow>
    );
  }

  return (
    <PopWindow title="Focus mode" subtitle="deep work session"
      mode={mode} onToggleMode={onToggleMode}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            Duration <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>2h 00m</span>
          </div>
          <div style={{ flex: 1 }} />
          <Btn size="sm" kind="secondary" icon="clock">Check in regularly</Btn>
          <Btn size="sm" kind="primary" icon="play" onClick={() => {
            if (end <= start) {
              setError('End time must be after start. Adjust the END field to continue.');
              return;
            }
            setError(''); setActive(true);
          }}>Begin focus</Btn>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ErrorBanner message={error} onDismiss={() => setError('')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="START">
            <TextField value={start} onChange={setStart} icon="clock" mono />
          </Field>
          <Field label="END">
            <TextField value={end} onChange={setEnd} icon="clock" mono />
          </Field>
        </div>
        <Field label="CATEGORY">
          <Combo value={cat} onChange={setCat}
            options={CATEGORIES.map((c) => ({ ...c }))} dot={catColor(cat)} icon="tag" />
        </Field>
        <Field label="PROJECT">
          <Combo value={proj} onChange={setProj}
            options={PROJECTS.map((p) => ({ ...p }))} dot={projColor(proj)} icon="folder" />
        </Field>
        <Field label="GOAL">
          <TextField value={goal} onChange={setGoal} placeholder="One line — what's the win?" />
        </Field>
        <div style={{
          padding: '10px 12px', background: 'var(--accent-softer)',
          borderRadius: 'var(--radius)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11.5, color: 'var(--ink-2)',
        }}>
          <Icon name="focus" size={14} style={{ color: 'var(--accent)', flex: 'none' }} />
          <span>Periodic check-ins pause until {end}. Logs as one block with a focus flag.</span>
        </div>
      </div>
    </PopWindow>
  );
};

Object.assign(window, {
  POP_W, POP_H, SHELL_W, SHELL_H,
  PopWindow, ShellWindow, TitleBar, ModeToggle, CloseBtn,
  Field, CountdownRing, SparkBars, IntervalChips,
  StartupWindow, DashboardWindow, CheckInWindow, FocusWindow,
  ShortcutWindow,
});

// ─── 5. FLOATING SHORTCUT (84×84 always-on-top, draggable) ──────────────────
// Rounded-cube button. Tap to open the check-in popup; long-press → focus mode.
// The shape follows the logo: rx=6 on a 24-unit viewBox ≈ 25% corner radius,
// so 84px → 21px radius.
const ShortcutWindow = ({ mode, onToggleMode }) => {
  const SIZE = 84;
  const R = 21;
  // A tiny "next check-in" countdown ring around the button — gives it ambient
  // information without taking any space.
  const [seconds, setSeconds] = React.useState(12 * 60 + 14);
  React.useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const intervalSec = 20 * 60;
  const pct = 1 - seconds / intervalSec;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* progress ring (offset slightly outside the button) */}
        <svg width={SIZE + 10} height={SIZE + 10} viewBox={`0 0 ${SIZE + 10} ${SIZE + 10}`}
          style={{ position: 'absolute', top: -5, left: -5, transform: 'rotate(-90deg)' }}>
          <rect x="3" y="3" width={SIZE + 4} height={SIZE + 4} rx={R + 4}
            fill="none" stroke="var(--line)" strokeWidth="2" />
          <rect x="3" y="3" width={SIZE + 4} height={SIZE + 4} rx={R + 4}
            fill="none" stroke="var(--accent)" strokeWidth="2"
            strokeDasharray={4 * (SIZE + 4)}
            strokeDashoffset={4 * (SIZE + 4) * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        {/* button — uses the logo icon directly so its rounded square + glyph
            stay in lockstep with every other place the LogIT mark appears. */}
        <button title="LogIT — click to check in"
          style={{
            width: SIZE, height: SIZE, padding: 0,
            background: 'transparent', color: 'var(--accent)',
            border: 'none', borderRadius: R,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(var(--shadow-pop))',
            transition: 'transform 120ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Icon name="logo" size={SIZE} />
        </button>
      </div>
    </div>
  );
};
