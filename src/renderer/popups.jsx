// popups.jsx
// Description: the three popup surfaces in one window — the check-in popup's
//              five contexts (SPEC §8.3), the focus popup's two form variants
//              + live page (§8.4), and the start-logging popup (§8.5). The
//              window renders whatever state.popup says; the core owns every
//              consequence, including the real timeout.
// Inputs:  state snapshot (state.popup drives everything)
// Outputs: <PopupRoot>
// Created: 2026-08-17

import React from 'react';
import {
  CTX_EXIT_PROMPT, CTX_FOCUS_END, CTX_FOCUS_INTERRUPT, CTX_INTERVAL, CTX_OFF_CYCLE,
  FALLBACK_COLOR, POPUP_WIDTH, SUBMIT_MAX_ATTEMPTS
} from '../shared/constants.js';
import {
  formatClock, formatDurationShort, isValidHHMM, wrappedSpanMinutes
} from '../shared/derive.js';
import { Icon } from './icons.jsx';
import { TitleBar } from './shell.jsx';
import { warmPalette } from './theme.jsx';
import {
  Btn, Combo, ContextBadge, CountdownRing, ErrorBanner, Label, TextArea,
  TextField, V2Field, useTick
} from './widgets.jsx';

// Per-context copy + chrome (design handoff, corrected to spec where they
// disagreed — see UPDATES 2026-08-17).
const CHECKIN_CONTEXTS = {
  [CTX_INTERVAL]: {
    subtitleTail: 'check-in', closeable: true, showSwitchToFocus: true,
    badge: null, helper: null, buttons: ['view', 'skip', 'submit']
  },
  [CTX_OFF_CYCLE]: {
    subtitleTail: 'manual', closeable: true, showSwitchToFocus: true,
    badge: null, helper: null, buttons: ['view', 'skip', 'submit']
  },
  [CTX_FOCUS_END]: {
    subtitleTail: 'focus complete', closeable: false, showSwitchToFocus: false,
    badge: { variant: 'end', text: 'Focus complete', icon: '✓' },
    helper: null, buttons: ['submit-and-view', 'submit']
  },
  [CTX_FOCUS_INTERRUPT]: {
    subtitleTail: 'interrupt focus?', closeable: true, showSwitchToFocus: false,
    badge: { variant: 'interrupt', text: 'Focus active · interrupt?', icon: '?' },
    helper: 'Submitting ends focus and starts normal logging. View dashboard keeps focus running.',
    buttons: ['view-focus', 'submit-end-focus']
  },
  [CTX_EXIT_PROMPT]: {
    subtitleTail: 'closing', closeable: true, showSwitchToFocus: false,
    badge: null, helper: 'Closing — what was the last block?', helperTone: 'warn',
    buttons: ['view-cancel', 'discard-exit', 'submit-exit']
  }
};

// Description: seconds remaining on the popup countdown, ticking.
// Inputs:  deadlineMs — epoch ms or null
// Outputs: integer seconds or null
function useCountdown(deadlineMs) {
  useTick(deadlineMs !== null);
  if (deadlineMs === null) return null;
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

// Description: shared popup frame — panel, title bar, body, footer.
// Inputs:  chrome + children
// Outputs: element
function PopFrame({ title, subtitle, badge, right, mode, closeable, onClose, footer, children }) {
  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{
        width: POPUP_WIDTH, background: 'var(--panel)',
        border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-body)', color: 'var(--ink)'
      }}>
        <TitleBar title={title} subtitle={subtitle} mode={mode}
          badge={badge && <ContextBadge variant={badge.variant} mode={mode} icon={badge.icon}>{badge.text}</ContextBadge>}
          right={right}
          onClose={closeable ? onClose : null} />
        <div style={{ padding: '14px 16px' }}>{children}</div>
        {footer && (
          <div style={{
            flex: 'none', padding: '12px 14px',
            borderTop: '1px solid var(--line)', background: 'var(--panel-alt)'
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

const GhostBtn = ({ onClick, icon = 'chart', children }) => (
  <button onClick={onClick} style={{
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--ink-2)', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
  }}>
    <Icon name={icon} size={12} /> {children}
  </button>
);

// Description: helper info card, sage or warm.
// Inputs:  icon, tone, mode, children
// Outputs: element
function InfoCard({ icon = 'focus', tone, mode, children }) {
  const w = tone === 'warn' ? warmPalette(mode) : null;
  return (
    <div style={{
      padding: '10px 12px',
      background: w ? w.softer : 'var(--accent-softer)',
      border: w ? `1px solid ${w.line}` : '1px solid transparent',
      borderRadius: 'var(--radius)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45
    }}>
      <Icon name={icon} size={14} style={{ color: w ? w.base : 'var(--accent)', flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// Description: SPEC §10 save-failure banner text for an attempt count.
// Inputs:  saveError — { attempt, final, echo }
// Outputs: string
function saveErrorText(saveError) {
  if (!saveError.final) {
    return `Save failed (attempt ${saveError.attempt} of ${SUBMIT_MAX_ATTEMPTS}). Close any app that has the log file open, then submit again.`;
  }
  const echo = saveError.echo
    ? `\nCategory: ${saveError.echo.category}\nProject: ${saveError.echo.project}\nNotes: ${saveError.echo.notes || '—'}`
    : '';
  return `Your entry was NOT saved. Copy it down before closing:${echo}`;
}

// ── check-in ────────────────────────────────────────────────────────────────
function CheckinPopup({ state }) {
  const popup = state.popup;
  const ctx = CHECKIN_CONTEXTS[popup.context];
  const prefill = popup.prefill ?? {};
  const [cat, setCat] = React.useState(prefill.category ?? '');
  const [proj, setProj] = React.useState(prefill.project ?? '');
  const [notes, setNotes] = React.useState(prefill.notes ?? '');
  const [invalid, setInvalid] = React.useState(false);
  const [error, setError] = React.useState('');
  const seconds = useCountdown(popup.deadlineMs);

  const submit = async (extra = {}) => {
    const res = await window.logit.send('checkin-submit', { category: cat, project: proj, notes, ...extra });
    if (res.ok) return;
    if (res.invalid) { setInvalid(true); setError('Category and project are required.'); return; }
    if (res.saveError) { setInvalid(false); setError(saveErrorText(res.saveError)); }
  };
  const dismiss = () => window.logit.send('checkin-dismiss', { toShell: true });

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && ctx.closeable) dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctx.closeable]);

  const openStart = state.openRow?.start ?? state.now;
  const catColor = cat ? (state.colors.category[cat] ?? FALLBACK_COLOR) : undefined;
  const projColor = proj ? (state.colors.project[proj] ?? FALLBACK_COLOR) : undefined;
  const isFocusCtx = popup.context === CTX_FOCUS_END || popup.context === CTX_FOCUS_INTERRUPT;

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {ctx.buttons.includes('view') && <GhostBtn onClick={dismiss}>View dashboard</GhostBtn>}
      {ctx.buttons.includes('view-focus') && <GhostBtn onClick={dismiss}>View dashboard</GhostBtn>}
      {ctx.buttons.includes('view-cancel') && <GhostBtn onClick={dismiss}>Cancel exit</GhostBtn>}
      {ctx.buttons.includes('submit-and-view') && (
        <GhostBtn onClick={() => submit({ andView: true })}>Submit and view dashboard</GhostBtn>
      )}
      <div style={{ flex: 1 }} />
      {ctx.buttons.includes('skip') && (
        <Btn size="sm" kind="ghost" onClick={() => window.logit.send('checkin-skip')}>Skip</Btn>
      )}
      {ctx.buttons.includes('discard-exit') && (
        <Btn size="sm" kind="ghost" onClick={() => window.logit.send('checkin-skip')}>Discard &amp; exit</Btn>
      )}
      {ctx.buttons.includes('submit') && (
        <Btn size="sm" kind="primary" iconAfter="arrow-right" onClick={() => submit()}>Submit</Btn>
      )}
      {ctx.buttons.includes('submit-end-focus') && (
        <Btn size="sm" kind="primary" iconAfter="arrow-right" onClick={() => submit()}>End focus &amp; submit</Btn>
      )}
      {ctx.buttons.includes('submit-exit') && (
        <Btn size="sm" kind="primary" iconAfter="arrow-right" onClick={() => submit()}>Submit &amp; exit</Btn>
      )}
    </div>
  );

  return (
    <PopFrame
      title="What did you do?"
      subtitle={`since ${openStart} · ${ctx.subtitleTail} · ${state.now}`}
      badge={ctx.badge} mode={state.theme}
      right={seconds !== null ? <CountdownRing seconds={seconds} total={state.popupTimeoutSec} /> : null}
      closeable={ctx.closeable} onClose={dismiss} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <V2Field label="CATEGORY" required mode={state.theme} error={invalid && cat.trim() === ''}>
          <Combo value={cat} onChange={setCat}
            options={state.categories.map((n) => ({ label: n, color: state.colors.category[n] }))}
            placeholder="Pick a category…" dot={catColor} icon="tag" />
        </V2Field>
        <V2Field label="PROJECT" required mode={state.theme} error={invalid && proj.trim() === ''}>
          <Combo value={proj} onChange={setProj}
            options={state.projects.map((n) => ({ label: n, color: state.colors.project[n] }))}
            placeholder="Pick a project…" dot={projColor} icon="folder" />
        </V2Field>
        <V2Field label="WHAT WAS DONE" mode={state.theme}>
          <TextArea value={notes} onChange={setNotes}
            placeholder="Optional — a quick note about the block that just ended." rows={2} />
        </V2Field>
        {ctx.helper && (
          <InfoCard icon={isFocusCtx ? 'focus' : 'clock'}
            tone={ctx.helperTone || (isFocusCtx ? 'warn' : undefined)} mode={state.theme}>
            {ctx.helper}
          </InfoCard>
        )}
        {ctx.showSwitchToFocus && (
          <button onClick={() => window.logit.send('checkin-switch-focus', { category: cat, project: proj, notes })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: '1px dashed var(--line-strong)',
              color: 'var(--ink-2)', padding: '8px 12px', borderRadius: 'var(--radius)',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start'
            }}>
            <Icon name="focus" size={13} style={{ color: 'var(--accent)' }} />
            Switch to focus mode →
          </button>
        )}
      </div>
    </PopFrame>
  );
}

// ── start-logging ───────────────────────────────────────────────────────────
function StartPopup({ state }) {
  const seconds = useCountdown(state.popup.deadlineMs);
  const [error, setError] = React.useState('');
  const skip = () => window.logit.send('start-popup-dismiss', { action: 'skip' });

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') skip(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const start = async () => {
    const res = await window.logit.send('start-logging');
    if (!res.ok) setError(res.error);
  };

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <GhostBtn onClick={() => window.logit.send('start-popup-dismiss', { action: 'view' })}>
        View dashboard
      </GhostBtn>
      <div style={{ flex: 1 }} />
      <Btn size="sm" kind="ghost" onClick={skip}>Skip</Btn>
      <Btn size="sm" kind="secondary" icon="focus" onClick={() => window.logit.send('open-focus')}>Focus mode</Btn>
      <Btn size="sm" kind="primary" icon="play" onClick={start}>Start logging</Btn>
    </div>
  );

  return (
    <PopFrame title="Resume logging?" subtitle={`${state.now} · paused`}
      mode={state.theme}
      right={seconds !== null ? <CountdownRing seconds={seconds} total={state.popupTimeoutSec} /> : null}
      closeable onClose={skip} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          letterSpacing: '-0.015em', fontSize: 18, lineHeight: 1.25, color: 'var(--ink)'
        }}>
          You haven&rsquo;t logged anything since{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500 }}>
            {state.lastActivity}
          </span>.
        </div>
        <InfoCard icon="play" mode={state.theme}>
          Start a new logging block now, or jump straight into a focus session.
          Skip to wait for the next check-in.
        </InfoCard>
      </div>
    </PopFrame>
  );
}

// ── focus ───────────────────────────────────────────────────────────────────
function FocusPopup({ state }) {
  const popup = state.popup;
  if (popup.variant === 'live') return <FocusLive state={state} />;
  return <FocusForm state={state} variantB={popup.variant === 'B'} />;
}

function FocusForm({ state, variantB }) {
  const prefill = state.popup.prefill ?? {};
  const [start, setStart] = React.useState(state.now);
  const [end, setEnd] = React.useState('');
  const [cat, setCat] = React.useState(prefill.category ?? '');
  const [proj, setProj] = React.useState(prefill.project ?? '');
  const [notes, setNotes] = React.useState(prefill.notes ?? '');
  const [error, setError] = React.useState('');
  const dismiss = () => window.logit.send('focus-dismiss');

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const valid = isValidHHMM(start) && isValidHHMM(end) && wrappedSpanMinutes(start, end) > 0;
  const duration = valid ? formatDurationShort(wrappedSpanMinutes(start, end)) : null;

  const begin = async () => {
    const res = await window.logit.send('focus-begin', {
      start, end, wrap: variantB ? { category: cat, project: proj, notes } : null
    });
    if (!res.ok && res.errors) setError(res.errors.join('\n'));
  };
  const checkInRegularly = () => window.logit.send('focus-checkin-regularly', {
    typed: variantB ? { category: cat, project: proj, notes } : null
  });

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
        {duration && <>Duration <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{duration}</span></>}
      </div>
      <div style={{ flex: 1 }} />
      <Btn size="sm" kind="secondary" icon="clock" onClick={checkInRegularly}>Check in regularly</Btn>
      <Btn size="sm" kind="primary" icon="play" onClick={begin}>Begin focus</Btn>
    </div>
  );

  const SectionHead = ({ children, hint }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        letterSpacing: '-0.015em', fontSize: 12.5, color: 'var(--ink)'
      }}>{children}</div>
      {hint && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{hint}</span>}
    </div>
  );

  return (
    <PopFrame
      title={variantB ? 'Switch to focus mode' : 'Start focus session'}
      subtitle={variantB ? 'wrap up · then begin focus' : 'popups suppressed until end'}
      mode={state.theme} closeable onClose={dismiss} footer={footer}>
      <ErrorBanner message={error} onDismiss={() => setError('')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {variantB && (
          <>
            <SectionHead hint={`since ${state.openRow?.start ?? ''}`}>Wrap up current block</SectionHead>
            <V2Field label="CATEGORY" required mode={state.theme}>
              <Combo value={cat} onChange={setCat}
                options={state.categories.map((n) => ({ label: n, color: state.colors.category[n] }))}
                placeholder="Pick a category…"
                dot={cat ? (state.colors.category[cat] ?? FALLBACK_COLOR) : undefined} icon="tag" />
            </V2Field>
            <V2Field label="PROJECT" required mode={state.theme}>
              <Combo value={proj} onChange={setProj}
                options={state.projects.map((n) => ({ label: n, color: state.colors.project[n] }))}
                placeholder="Pick a project…"
                dot={proj ? (state.colors.project[proj] ?? FALLBACK_COLOR) : undefined} icon="folder" />
            </V2Field>
            <V2Field label="WHAT WAS DONE" mode={state.theme}>
              <TextField value={notes} onChange={setNotes}
                placeholder="Optional — one line about the just-ending block." />
            </V2Field>
            <div style={{ height: 1, background: 'var(--line)', margin: '6px -2px' }} />
            <SectionHead hint={duration ?? ''}>New focus session</SectionHead>
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <V2Field label="START" mode={state.theme}>
            <TextField value={start} onChange={setStart} icon="clock" mono />
          </V2Field>
          <V2Field label="END" required mode={state.theme}>
            <TextField value={end} onChange={setEnd} icon="clock" mono placeholder="HH:MM" />
          </V2Field>
        </div>
        {!variantB && (
          <InfoCard icon="focus" mode={state.theme}>
            You&rsquo;ll fill in what you did when the session ends.
            Periodic check-ins pause until{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{isValidHHMM(end) ? end : '…'}</span>.
          </InfoCard>
        )}
      </div>
    </PopFrame>
  );
}

// Description: the live page — countdown, progress, End session. Closing this
//              window does NOT end the session (SPEC §8.4).
// Inputs:  state
// Outputs: element
function FocusLive({ state }) {
  useTick(true);
  const dismiss = () => window.logit.send('focus-dismiss');
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const focus = state.focus ?? { start: '', end: '' };
  const remaining = Math.max(0, (state.focusEndsAtMs - Date.now()) / 1000);
  const totalSec = wrappedSpanMinutes(focus.start, focus.end) * 60;
  const elapsedSec = Math.max(0, totalSec - remaining);
  const pct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;

  return (
    <PopFrame title="Focus · live" subtitle="popups suppressed"
      mode={state.theme} closeable onClose={dismiss}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }} />
          <Btn size="sm" kind="secondary" onClick={() => window.logit.send('focus-end-early')}>End session</Btn>
        </div>
      }>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <Label style={{ color: 'var(--accent)' }}>POPUPS SUPPRESSED</Label>
        <div style={{
          marginTop: 12, fontFamily: 'var(--font-mono)',
          fontSize: 56, fontWeight: 500, letterSpacing: '-0.02em',
          lineHeight: 1, color: 'var(--ink)'
        }}>{formatClock(remaining)}</div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
          ends at <span style={{ fontFamily: 'var(--font-mono)' }}>{focus.end}</span>
        </div>
        <div style={{ marginTop: 20, height: 3, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
        </div>
        <div style={{
          marginTop: 8, display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)'
        }}>
          <span>{focus.start}</span>
          <span>{formatDurationShort(Math.floor(elapsedSec / 60))} · {Math.round(pct)}%</span>
          <span>{focus.end}</span>
        </div>
      </div>
      <div style={{
        marginTop: 20, padding: '12px 14px',
        background: 'var(--panel-alt)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', textAlign: 'left'
      }}>
        <Label>THIS SESSION</Label>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--ink-2)' }}>
          Details pending — you&rsquo;ll describe the block when the session ends.
        </div>
      </div>
    </PopFrame>
  );
}

// Description: popup window root — renders whatever popup the core says is up.
// Inputs:  state
// Outputs: element or null (window being torn down)
export function PopupRoot({ state }) {
  const popup = state.popup;
  if (popup === null) return null;
  if (popup.kind === 'checkin') return <CheckinPopup key={popup.context} state={state} />;
  if (popup.kind === 'start') return <StartPopup state={state} />;
  return <FocusPopup key={popup.variant} state={state} />;
}
