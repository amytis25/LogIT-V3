// theme.jsx
// Description: the Soft Modern theme from the design handoff — light + dark
//              token sets exposed as CSS variables via a wrapper div. Visuals
//              only; behaviour never lives here.
// Inputs:  mode ('light' | 'dark'), children
// Outputs: <Theme> wrapper, hexAlpha(), warmPalette() (focus rust tones)
// Created: 2026-08-17

import React from 'react';

const SOFT = {
  fontBody: '"Inter Tight", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  fontDisplay: '"Source Serif 4", Georgia, serif',
  radius: '12px', radiusSm: '8px', radiusLg: '18px',
  light: {
    bg: '#f1ece1', panel: '#fbf7ec', panelAlt: '#f6f1e3',
    ink: '#2a2218', ink2: '#6b5e4d', ink3: '#a89a83', ink4: '#d2c5ad',
    line: '#e6dcc6', lineStrong: '#d4c7a9',
    accent: '#5d7a5b', accentInk: '#fbf7ec',
    success: '#5d7a5b', warn: '#b07b2a',
    shadow: '0 1px 0 rgba(60,40,20,0.04), 0 6px 20px -10px rgba(60,40,20,0.14)',
    shadowPop: '0 18px 44px -14px rgba(60,40,20,0.28), 0 2px 8px -2px rgba(60,40,20,0.10)'
  },
  dark: {
    bg: '#1a1612', panel: '#23201a', panelAlt: '#2b2720',
    ink: '#f3ead7', ink2: '#a89a83', ink3: '#6e6452', ink4: '#3e3729',
    line: '#352f24', lineStrong: '#45402f',
    accent: '#9ec095', accentInk: '#1a1612',
    success: '#9ec095', warn: '#dca566',
    shadow: '0 1px 0 rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.4)',
    shadowPop: '0 22px 50px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35)'
  }
};

// Description: '#rrggbb' + alpha → 'rgba(...)'.
// Inputs: hex, a  Outputs: rgba string
export function hexAlpha(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Description: the warm-rust palette used by every focus-context surface.
// Inputs: mode  Outputs: { base, soft, softer, border, line, ink }
export function warmPalette(mode) {
  const base = mode === 'dark' ? '#dca566' : '#b07b2a';
  return {
    base,
    soft: hexAlpha(base, 0.14),
    softer: hexAlpha(base, 0.06),
    border: hexAlpha(base, 0.30),
    line: hexAlpha(base, 0.22),
    ink: mode === 'dark' ? '#1a1612' : '#fbf7ec'
  };
}

// Description: the red used by validation errors, tuned per mode.
// Inputs: mode  Outputs: colour
export function dangerColor(mode) {
  return mode === 'dark' ? '#d97a72' : '#b3503a';
}

// Description: theme wrapper exposing tokens as CSS vars.
// Inputs: mode, style, children
// Outputs: themed div
export function Theme({ mode = 'light', style, children, ...rest }) {
  const m = SOFT[mode];
  const vars = {
    '--bg': m.bg, '--panel': m.panel, '--panel-alt': m.panelAlt,
    '--ink': m.ink, '--ink-2': m.ink2, '--ink-3': m.ink3, '--ink-4': m.ink4,
    '--line': m.line, '--line-strong': m.lineStrong,
    '--accent': m.accent, '--accent-ink': m.accentInk,
    '--accent-soft': hexAlpha(m.accent, 0.14),
    '--accent-softer': hexAlpha(m.accent, 0.06),
    '--success': m.success, '--warn': m.warn,
    '--radius': SOFT.radius, '--radius-sm': SOFT.radiusSm, '--radius-lg': SOFT.radiusLg,
    '--font-body': SOFT.fontBody, '--font-mono': SOFT.fontMono, '--font-display': SOFT.fontDisplay,
    '--shadow': m.shadow, '--shadow-pop': m.shadowPop,
    color: 'var(--ink)',
    fontFamily: 'var(--font-body)', fontWeight: 400,
    fontFeatureSettings: '"ss01", "cv11", "tnum"',
    height: '100%',
    ...style
  };
  return <div data-mode={mode} style={vars} {...rest}>{children}</div>;
}
