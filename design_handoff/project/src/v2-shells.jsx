// V2 shells — Startup (normal + paused) and Dashboard (open-row + focus-active).
// Reuses ShellWindow chrome + sidebar from v1.

// ─── STARTUP (normal) ───────────────────────────────────────────────────────
const StartupHomeV2 = ({ paused = false }) => {
  const [interval, setIntervalMin] = React.useState(20);
  const [error, setError] = React.useState('');
  const weekHours = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const avg = weekHours / 7;

  return (
    <div>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div>
        <Label>NOTHING LOGGED YET TODAY</Label>
        <div style={{
          marginTop: 4, fontFamily: 'var(--font-display)',
          fontWeight: 'var(--heading-weight)', letterSpacing: 'var(--letter-title)',
          fontSize: 26, lineHeight: 1.1, color: 'var(--ink)',
        }}>{paused ? 'Quiet for a while.' : 'Good afternoon.'}</div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink-2)' }}>
          Tue · May 20 · {paused
            ? 'auto-prompts off — no activity since 13:45'
            : 'last logged yesterday at 17:30'}
        </div>
      </div>

      {paused && (
        <div style={{ marginTop: 14 }}>
          <EngagementPausedPill time="13:45" />
        </div>
      )}

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
        <div style={{ marginTop: 8 }}>
          <V2IntervalChips value={interval} onChange={setIntervalMin} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          {paused ? (
            <>
              Prompts are silent until you start a block. Pick an interval ready for when you
              resume — <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{interval}m</span>.
            </>
          ) : (
            <>
              LogIT pings you every <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{interval}m</span>{' '}
              to ask <em>what did you just do?</em> — closing the previous block and starting a new one.
            </>
          )}
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

const StartupWindowV2 = ({ mode, onToggleMode, paused = false }) => {
  const [view, setView] = React.useState('dashboard');
  const meta = view === 'dashboard'
    ? { title: 'LogIT', subtitle: paused ? 'paused · waiting for you' : 'ready when you are' }
    : SECTION_META[view];
  return (
    <ShellWindow {...meta} view={view} onChangeView={setView}
      mode={mode} onToggleMode={onToggleMode}>
      {view === 'dashboard'  && <StartupHomeV2 paused={paused} />}
      {view === 'manual'     && <ManualPane />}
      {view === 'analytics'  && <AnalyticsPane />}
      {view === 'categories' && <EditorPane kind="categories" />}
      {view === 'projects'   && <EditorPane kind="projects" />}
    </ShellWindow>
  );
};

// ─── DASHBOARD — open NORMAL row (no details yet) ───────────────────────────
const DashboardHomeOpenRow = () => {
  const [interval, setIntervalMin] = React.useState(20);
  const [error, setError] = React.useState('');
  // Today's previously-closed entries (the open row is rendered above as NOW)
  const today = DAYS[DAYS.length - 1];
  const todayH = dayHours(today);
  const weekH = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const entries = today.entries;

  return (
    <div>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      {/* NOW card — open normal row with NO details yet */}
      <div style={{
        padding: 14, background: 'var(--accent-softer)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius)',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Label>NOW · OPEN BLOCK</Label>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: 'var(--success)',
              boxShadow: `0 0 0 3px ${hexAlpha('#3f8a5b', 0.18)}`, flex: 'none',
            }} />
          </div>
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--heading-weight)',
              letterSpacing: 'var(--letter-title)',
              fontSize: 22, lineHeight: 1, color: 'var(--ink)',
            }}>Started 14:02</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              <LiveElapsed start="14:02" current="14:25" extraSecs={14} /> elapsed
            </span>
          </div>
          <div style={{
            marginTop: 8, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Icon name="clock" size={11} />
            Details pending next check-in at 14:30
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <Label>NEXT CHECK-IN</Label>
          <div style={{
            marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 18,
            fontWeight: 500, color: 'var(--ink)',
          }}>14:30</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            in <CountdownTo totalSecs={4 * 60 + 46} />
          </div>
        </div>
      </div>

      <DashboardBelow entries={entries} todayH={todayH} weekH={weekH}
        interval={interval} onIntervalChange={setIntervalMin}
        showLogActivity={true} />
    </div>
  );
};

// ─── DASHBOARD — active FOCUS session ───────────────────────────────────────
const DashboardHomeFocus = ({ mode }) => {
  const [interval, setIntervalMin] = React.useState(20);
  const [error, setError] = React.useState('');
  const today = DAYS[DAYS.length - 1];
  const todayH = dayHours(today);
  const weekH = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const entries = today.entries;
  const w = v2WarnPalette(mode);

  return (
    <div>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      {/* NOW card — focus session, warm rust */}
      <div style={{
        padding: 14,
        background: w.softer,
        border: `1px solid ${w.line}`,
        borderRadius: 'var(--radius)',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: 'var(--letter-label)',
              color: w.base,
            }}>NOW · FOCUS SESSION</span>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: w.base,
              boxShadow: `0 0 0 3px ${w.soft}`, flex: 'none',
            }} />
          </div>
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--heading-weight)',
              letterSpacing: 'var(--letter-title)',
              fontSize: 22, lineHeight: 1, color: 'var(--ink)',
            }}>13:30 → 15:30</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              ends in{' '}
              <CountdownTo totalSecs={66 * 60} style={{
                color: 'var(--ink)', fontWeight: 500,
              }} />
            </span>
          </div>
          <div style={{
            marginTop: 8, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Icon name="focus" size={11} />
            Check-ins suppressed — details pending at session end
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none', minWidth: 110 }}>
          <Label style={{ color: w.base }}>REMAINING</Label>
          <div style={{
            marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 22,
            fontWeight: 500, color: 'var(--ink)',
          }}>
            <CountdownTo totalSecs={66 * 60} />
          </div>
          <div style={{
            marginTop: 4, height: 3, background: w.soft,
            borderRadius: 999, overflow: 'hidden',
          }}>
            <div style={{ height: '100%', width: '45%', background: w.base }} />
          </div>
        </div>
      </div>

      <DashboardBelow entries={entries} todayH={todayH} weekH={weekH}
        interval={interval} onIntervalChange={setIntervalMin}
        showLogActivity={false} endFocusBtn={true} mode={mode} />
    </div>
  );
};

// Shared "below the NOW card" section — timeline + sidebar widgets + CTAs.
const DashboardBelow = ({
  entries, todayH, weekH,
  interval, onIntervalChange,
  showLogActivity, endFocusBtn, mode,
}) => {
  const w = mode ? v2WarnPalette(mode) : null;
  return (
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
          {showLogActivity && (
            <Btn size="sm" kind="primary" icon="plus" style={{ flex: 1, justifyContent: 'center' }}>
              Log activity
            </Btn>
          )}
          {endFocusBtn && (
            <button style={{
              flex: 1, justifyContent: 'center',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: 'transparent', border: `1px solid ${w.line}`,
              color: w.base, borderRadius: 'var(--radius)',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
            }}>
              <Icon name="x" size={12} />
              End focus early
            </button>
          )}
          {!endFocusBtn && (
            <Btn size="sm" kind="secondary" icon="focus">
              Focus mode
            </Btn>
          )}
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
          <div style={{ marginTop: 8 }}>
            <V2IntervalChips value={interval} onChange={onIntervalChange} />
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardWindowOpenRow = ({ mode, onToggleMode }) => {
  const [view, setView] = React.useState('dashboard');
  const meta = view === 'dashboard'
    ? { title: 'Today', subtitle: 'Tue · May 20 · live · open block' }
    : SECTION_META[view];
  return (
    <ShellWindow {...meta} view={view} onChangeView={setView}
      mode={mode} onToggleMode={onToggleMode}>
      {view === 'dashboard'  && <DashboardHomeOpenRow />}
      {view === 'manual'     && <ManualPane />}
      {view === 'analytics'  && <AnalyticsPane />}
      {view === 'categories' && <EditorPane kind="categories" />}
      {view === 'projects'   && <EditorPane kind="projects" />}
    </ShellWindow>
  );
};

const DashboardWindowFocus = ({ mode, onToggleMode }) => {
  const [view, setView] = React.useState('dashboard');
  const meta = view === 'dashboard'
    ? { title: 'Today', subtitle: 'Tue · May 20 · live · focus session' }
    : SECTION_META[view];
  return (
    <ShellWindow {...meta} view={view} onChangeView={setView}
      mode={mode} onToggleMode={onToggleMode}>
      {view === 'dashboard'  && <DashboardHomeFocus mode={mode} />}
      {view === 'manual'     && <ManualPane />}
      {view === 'analytics'  && <AnalyticsPane />}
      {view === 'categories' && <EditorPane kind="categories" />}
      {view === 'projects'   && <EditorPane kind="projects" />}
    </ShellWindow>
  );
};

Object.assign(window, {
  StartupWindowV2,
  DashboardWindowOpenRow,
  DashboardWindowFocus,
});
