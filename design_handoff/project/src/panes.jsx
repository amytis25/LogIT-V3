// Panes that swap into the main area of ShellWindow when sidebar tabs are clicked.
// Designed to fit roughly 640px wide × 360px tall (matching the dashboard pane).

// ─── MANUAL ENTRY ───────────────────────────────────────────────────────────
const ManualPane = () => {
  const [date, setDate]   = React.useState('2026-05-20');
  const [start, setStart] = React.useState('15:30');
  const [end, setEnd]     = React.useState('17:00');
  const [cat, setCat]     = React.useState('Review');
  const [proj, setProj]   = React.useState('Design System');
  const [notes, setNotes] = React.useState('');

  const recent = [
    { date: '2026-05-19', range: '14:00–15:30', cat: 'Meetings',  proj: 'Q3 Planning' },
    { date: '2026-05-18', range: '09:00–11:00', cat: 'Research',  proj: 'Frontend' },
    { date: '2026-05-15', range: '20:00–21:30', cat: 'Deep Work', proj: 'Personal' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <Title size={20}>Manual entry</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            Log an activity from earlier in the day or week.
          </div>
        </div>
        <Btn size="sm" kind="primary" icon="check">Save entry</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
            <Field label="DATE"><TextField value={date} onChange={setDate} icon="calendar" mono /></Field>
            <Field label="START"><TextField value={start} onChange={setStart} icon="clock" mono /></Field>
            <Field label="END"><TextField value={end} onChange={setEnd} icon="clock" mono /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="CATEGORY">
              <Combo value={cat} onChange={setCat}
                options={CATEGORIES.map((c) => ({ ...c }))} dot={catColor(cat)} icon="tag" />
            </Field>
            <Field label="PROJECT">
              <Combo value={proj} onChange={setProj}
                options={PROJECTS.map((p) => ({ ...p }))} dot={projColor(proj)} icon="folder" />
            </Field>
          </div>
          <Field label="NOTES">
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you do?"
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
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Duration <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>1h 30m</span>
            {' · '}saves to CSV with mode=manual
          </div>
        </div>

        <div style={{
          background: 'var(--panel-alt)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
            <Label>RECENT MANUAL ENTRIES</Label>
          </div>
          <div>
            {recent.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '64px 1fr',
                gap: 8, padding: '8px 12px',
                borderBottom: i < recent.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                  {r.date.slice(5)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.cat}
                    <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {r.proj}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {r.range}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ANALYTICS ──────────────────────────────────────────────────────────────
const AnalyticsPane = () => {
  const totalH = DAYS.reduce((s, d) => s + dayHours(d), 0);
  const avgH = totalH / 7;
  const byCat = {};
  DAYS.forEach((d) => d.entries.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + hoursOf(e); }));
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const top = catList[0];
  const focusH = DAYS.reduce((s, d) => s + d.entries.filter((e) => e.mode === 'focus').reduce((s2, e) => s2 + hoursOf(e), 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Title size={20}>Analytics</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            Real numbers from your CSV log · last 7 days
          </div>
        </div>
        <Segmented value="7d" onChange={() => {}}
          options={[{ value: '7d', label: '7d' }, { value: '14d', label: '14d' }, { value: '30d', label: '30d' }]} />
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <KpiTile value={`${totalH.toFixed(1)}h`} label="Tracked" />
        <KpiTile value={`${avgH.toFixed(1)}h`} label="Avg / day" />
        <KpiTile value={`${focusH.toFixed(1)}h`} label="In focus" />
        <KpiTile value={top[0]} label="Top" mono={false} sub={`${top[1].toFixed(1)}h`} />
      </div>

      {/* Chart */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--panel-alt)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>HOURS BY CATEGORY · BY DAY</Label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {catList.slice(0, 5).map(([c]) => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                      fontSize: 10.5, color: 'var(--ink-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor(c) }} />
                {c}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}><AnalyticsBars height={160} /></div>
      </div>
    </div>
  );
};

const KpiTile = ({ value, label, sub }) => (
  <div style={{
    padding: '10px 12px',
    background: 'var(--panel-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
  }}>
    <div style={{
      fontFamily: 'var(--font-display)', fontWeight: 'var(--heading-weight)',
      fontSize: 20, lineHeight: 1, color: 'var(--ink)',
      fontFeatureSettings: '"tnum"',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{value}</div>
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Label>{label}</Label>
      {sub && (
        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{sub}</span>
      )}
    </div>
  </div>
);

// Slightly bigger stacked bar chart (with hour gridlines).
const AnalyticsBars = ({ height = 160 }) => {
  const max = Math.max(...DAYS.map(dayHours));
  const yTicks = [0, max * 0.5, max].map(Math.round);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, height }}>
      <div style={{
        display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
        width: 22, paddingBottom: 18, paddingTop: 4,
        fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)',
        textAlign: 'right',
      }}>
        {yTicks.map((v, i) => <span key={i}>{v}h</span>)}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10,
        borderLeft: '1px solid var(--line)', paddingLeft: 12,
      }}>
        {DAYS.map((d) => {
          const stacks = {};
          d.entries.forEach((e) => { stacks[e.cat] = (stacks[e.cat] || 0) + hoursOf(e); });
          const total = dayHours(d);
          return (
            <div key={d.date} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, height: '100%',
            }}>
              <div style={{ flex: 1, width: '100%', display: 'flex',
                            flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', maxWidth: 42, margin: '0 auto',
                  height: max ? `${(total / max) * 100}%` : 0,
                  display: 'flex', flexDirection: 'column-reverse',
                  borderRadius: 4, overflow: 'hidden', minHeight: 3,
                }}>
                  {Object.entries(stacks).map(([cat, h]) => (
                    <div key={cat} style={{ height: `${(h / total) * 100}%`, background: catColor(cat) }} />
                  ))}
                </div>
              </div>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: d.isToday ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: d.isToday ? 600 : 400, letterSpacing: '0.04em',
              }}>{d.day} {d.date.slice(8)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── EDITOR (Categories + Projects share this) ──────────────────────────────
const EditorPane = ({ kind }) => {
  const isCat = kind === 'categories';
  const initial = isCat ? CATEGORIES : PROJECTS;
  const [items, setItems] = React.useState(initial);
  const [draft, setDraft] = React.useState('');
  const palette = ['#5d7a5b', '#a05a2c', '#3a5a7a', '#7a3a5a', '#c8a23b', '#3a8a85', '#8a6b3a'];
  const total = items.reduce((s, x) => s + x.hours, 0) || 1;

  const add = () => {
    if (!draft.trim()) return;
    setItems([...items, { label: draft.trim(), color: palette[items.length % palette.length], hours: 0 }]);
    setDraft('');
  };
  const remove = (label) => setItems(items.filter((i) => i.label !== label));

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
          padding: '4px 8px', borderRadius: 999,
        }}>
          {items.length} {isCat ? 'cats' : 'projects'}
        </span>
      </div>

      <div style={{
        background: 'var(--panel-alt)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        {/* add row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderBottom: '1px solid var(--line)',
        }}>
          <Icon name="plus" size={13} style={{ color: 'var(--ink-3)' }} />
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={`Add ${isCat ? 'category' : 'project'}…`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)',
            }}
          />
          <Btn size="sm" kind={draft.trim() ? 'primary' : 'ghost'} disabled={!draft.trim()} onClick={add}>
            Add
          </Btn>
        </div>

        {/* rows */}
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {items.map((it, i) => {
            const pct = (it.hours / total) * 100;
            return (
              <div key={it.label} style={{
                display: 'grid', gridTemplateColumns: '18px 1fr 60px 90px 26px',
                gap: 10, padding: '8px 12px', alignItems: 'center',
                borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 4, background: it.color,
                  border: '1px solid rgba(0,0,0,0.06)',
                }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                  {it.hours.toFixed(1)}h
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: it.color }} />
                  </div>
                  <span style={{ width: 32, textAlign: 'right', fontFamily: 'var(--font-mono)',
                                  fontSize: 10.5, color: 'var(--ink-3)' }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <button onClick={() => remove(it.label)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', padding: 4, borderRadius: 4, display: 'flex',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--line)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── FOCUS PANE (inline focus setup, same logic as standalone FocusWindow) ──
const FocusPane = () => {
  const [active, setActive] = React.useState(false);
  const [start, setStart] = React.useState('12:30');
  const [end, setEnd]     = React.useState('14:30');
  const [cat, setCat]     = React.useState('Deep Work');
  const [proj, setProj]   = React.useState('Frontend');
  const [goal, setGoal]   = React.useState('Wire up logging UI + retry');
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
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <Title size={20}>Focus · live</Title>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              {cat} · {proj} · popups suppressed until {end}
            </div>
          </div>
          <Btn size="sm" kind="secondary" onClick={() => setActive(false)}>End session</Btn>
        </div>
        <div style={{
          padding: 22, background: 'var(--panel-alt)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          textAlign: 'center',
        }}>
          <Label style={{ color: 'var(--accent)' }}>REMAINING</Label>
          <div style={{
            marginTop: 6, fontFamily: 'var(--font-mono)',
            fontSize: 64, fontWeight: 500, letterSpacing: '-0.02em',
            lineHeight: 1, color: 'var(--ink)',
          }}>{fmt(remaining)}</div>
          <div style={{ marginTop: 18, height: 4, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '45%', background: 'var(--accent)' }} />
          </div>
          <div style={{
            marginTop: 6, display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)',
          }}>
            <span>{start}</span><span>54m elapsed · 1h 06m left</span><span>{end}</span>
          </div>
        </div>
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--panel-alt)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
        }}>
          <Label>GOAL</Label>
          <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>{goal}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <Title size={20}>Focus mode</Title>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
            Start a deep work session — periodic check-ins pause until the end time.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" kind="secondary" icon="clock">Check in regularly</Btn>
          <Btn size="sm" kind="primary" icon="play" onClick={() => setActive(true)}>Begin focus</Btn>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="START"><TextField value={start} onChange={setStart} icon="clock" mono /></Field>
          <Field label="END · REQUIRED"><TextField value={end} onChange={setEnd} icon="clock" mono /></Field>
          <Field label="DURATION">
            <div style={{
              height: 38, display: 'flex', alignItems: 'center', padding: '0 12px',
              background: 'var(--accent-softer)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', color: 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
            }}>2h 00m</div>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="CATEGORY">
            <Combo value={cat} onChange={setCat}
              options={CATEGORIES.map((c) => ({ ...c }))} dot={catColor(cat)} icon="tag" />
          </Field>
          <Field label="PROJECT">
            <Combo value={proj} onChange={setProj}
              options={PROJECTS.map((p) => ({ ...p }))} dot={projColor(proj)} icon="folder" />
          </Field>
        </div>
        <Field label="GOAL">
          <TextField value={goal} onChange={setGoal} placeholder="One line — what's the win?" />
        </Field>
      </div>
    </div>
  );
};

Object.assign(window, { ManualPane, AnalyticsPane, EditorPane, FocusPane, KpiTile, AnalyticsBars });
