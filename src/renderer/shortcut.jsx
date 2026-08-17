// shortcut.jsx
// Description: the floating shortcut (SPEC §8.9) — a rounded square (size from
//              SHORTCUT_SIZE) with a progress ring, four visual states,
//              draggable (drag never triggers logging), double-click activates.
// Inputs:  state snapshot
// Outputs: <ShortcutRoot>
// Created: 2026-08-17

import React from 'react';
import {
  SHORTCUT_SIZE, STATE_ACTIVE_FOCUS, STATE_ACTIVE_NORMAL
} from '../shared/constants.js';
import { wrappedSpanMinutes } from '../shared/derive.js';
import { Icon } from './icons.jsx';
import { warmPalette } from './theme.jsx';
import { useTick } from './widgets.jsx';

const DRAG_THRESHOLD_PX = 4;

export function ShortcutRoot({ state }) {
  useTick(true);   // the ring is a live element
  const w = warmPalette(state.theme);
  const dragRef = React.useRef(null);

  // Visual state per SPEC §8.9.
  const visual = state.paused ? 'paused'
    : state.state === STATE_ACTIVE_FOCUS ? 'focus'
      : state.state === STATE_ACTIVE_NORMAL ? 'normal' : 'inactive';

  let ringPct = 0;
  if (visual === 'normal' && state.nextFireMs) {
    const totalSec = state.intervalMinutes * 60;
    const remaining = Math.max(0, (state.nextFireMs - Date.now()) / 1000);
    ringPct = Math.min(1, 1 - remaining / totalSec);
  } else if (visual === 'focus' && state.focus && state.focusEndsAtMs) {
    const totalSec = wrappedSpanMinutes(state.focus.start, state.focus.end) * 60;
    const remaining = Math.max(0, (state.focusEndsAtMs - Date.now()) / 1000);
    ringPct = totalSec > 0 ? Math.min(1, 1 - remaining / totalSec) : 0;
  }

  const cfg = {
    normal: { ringColor: 'var(--accent)', logoColor: 'var(--accent)', opacity: 1, title: 'Tap to check in' },
    focus: { ringColor: w.base, logoColor: w.base, opacity: 1, title: 'Focus active — tap to interrupt' },
    inactive: { ringColor: 'var(--ink-4)', logoColor: 'var(--accent)', opacity: 1, title: 'No open block — tap to start logging' },
    paused: { ringColor: 'var(--ink-4)', logoColor: 'var(--ink-3)', opacity: 0.7, title: 'Paused — tap to resume' }
  }[visual];

  // Drag: report deltas to the main process (which clamps); a real drag
  // suppresses the activation a double-click would fire.
  const onMouseDown = (e) => {
    dragRef.current = { x: e.screenX, y: e.screenY, moved: false };
    const onMove = (me) => {
      const d = dragRef.current;
      const dx = me.screenX - d.x;
      const dy = me.screenY - d.y;
      if (Math.abs(dx) + Math.abs(dy) === 0) return;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) d.moved = true;
      d.x = me.screenX;
      d.y = me.screenY;
      window.logit.send('shortcut-move-by', { dx, dy });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const onDoubleClick = () => {
    if (dragRef.current?.moved) return;   // drag must not trigger logging
    window.logit.send('shortcut-activate');
  };

  // Everything scales off SHORTCUT_SIZE so the button can be resized in one
  // place (constants.js) without the ring or badges drifting out of proportion.
  const SIZE = SHORTCUT_SIZE;
  const R = SIZE / 4;                                  // logo's own corner radius
  const RING_GAP = Math.max(2, Math.round(SIZE / 16)); // ring sits outside the button
  const RING_STROKE = Math.max(1.5, SIZE / 42);
  const RECT_W = SIZE + RING_GAP * 2;
  const PERIMETER = 4 * RECT_W;
  const SVG_SIZE = SIZE + RING_GAP * 4;
  const RING_ORIGIN = RING_GAP;                        // rect inset inside the svg
  const BADGE = Math.round(SIZE * 0.21);
  const BADGE_INSET = Math.round(SIZE * 0.12);
  const BADGE_ICON = Math.max(6, Math.round(SIZE * 0.107));
  const SHADOW = `drop-shadow(0 ${Math.round(SIZE / 14)}px ${Math.round(SIZE / 5)}px rgba(0,0,0,0.25))`;

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={cfg.title}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: cfg.opacity, cursor: 'pointer', userSelect: 'none'
      }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SVG_SIZE} height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          style={{
            position: 'absolute', top: -RING_GAP * 2, left: -RING_GAP * 2,
            transform: 'rotate(-90deg)'
          }}>
          <rect x={RING_ORIGIN} y={RING_ORIGIN} width={RECT_W} height={RECT_W} rx={R + RING_GAP}
            fill="none" stroke="var(--line)" strokeWidth={RING_STROKE} />
          {ringPct > 0 && (
            <rect x={RING_ORIGIN} y={RING_ORIGIN} width={RECT_W} height={RECT_W} rx={R + RING_GAP}
              fill="none" stroke={cfg.ringColor} strokeWidth={RING_STROKE}
              strokeDasharray={PERIMETER}
              strokeDashoffset={PERIMETER * (1 - ringPct)}
              strokeLinecap="round" />
          )}
          {visual === 'paused' && (
            <rect x={RING_ORIGIN} y={RING_ORIGIN} width={RECT_W} height={RECT_W} rx={R + RING_GAP}
              fill="none" stroke={cfg.ringColor} strokeWidth={RING_STROKE}
              strokeDasharray="3 4" opacity="0.6" />
          )}
        </svg>
        <div style={{
          width: SIZE, height: SIZE, color: cfg.logoColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: SHADOW
        }}>
          <Icon name="logo" size={SIZE} />
        </div>
        {visual === 'focus' && (
          <span style={{
            position: 'absolute', top: BADGE_INSET, right: BADGE_INSET,
            width: BADGE, height: BADGE, borderRadius: 999,
            background: w.base, color: w.ink,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--panel)', boxShadow: 'var(--shadow)'
          }}>
            <Icon name="focus" size={BADGE_ICON} />
          </span>
        )}
        {visual === 'paused' && (
          <span style={{
            position: 'absolute', top: BADGE_INSET, right: BADGE_INSET,
            width: BADGE, height: BADGE, borderRadius: 999,
            background: 'var(--panel)', color: 'var(--ink-3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--line-strong)', boxShadow: 'var(--shadow)'
          }}>
            <Icon name="pause" size={BADGE_ICON} />
          </span>
        )}
      </div>
    </div>
  );
}
