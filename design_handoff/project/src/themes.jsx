// Soft Modern aesthetic — light + dark variants.

const SOFT = {
  name: 'Soft Modern',
  fontBody: '"Inter Tight", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  fontDisplay: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
  bodyWeight: 400,
  headingWeight: 500,
  letterTitle: '-0.015em',
  letterLabel: '0.02em',
  labelTransform: 'none',
  radius: '12px',
  radiusSm: '8px',
  radiusLg: '18px',
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

// Curated accent swatches per mode.
const ACCENTS = {
  light: ['#5d7a5b', '#a05a2c', '#3a5a7a', '#7a3a5a', '#2a2218'],
  dark: ['#9ec095', '#d4a574', '#7da6c8', '#c997b3', '#e5d6b8']
};

function Theme({ mode = 'light', accent, style, children, ...rest }) {
  const a = SOFT;
  const m = a[mode];
  const acc = accent || m.accent;
  const vars = {
    '--bg': m.bg, '--panel': m.panel, '--panel-alt': m.panelAlt,
    '--ink': m.ink, '--ink-2': m.ink2, '--ink-3': m.ink3, '--ink-4': m.ink4,
    '--line': m.line, '--line-strong': m.lineStrong,
    '--accent': acc, '--accent-ink': m.accentInk,
    '--accent-soft': hexAlpha(acc, 0.14),
    '--accent-softer': hexAlpha(acc, 0.06),
    '--success': m.success, '--warn': m.warn,
    '--radius': a.radius, '--radius-sm': a.radiusSm, '--radius-lg': a.radiusLg,
    '--font-body': a.fontBody, '--font-mono': a.fontMono, '--font-display': a.fontDisplay,
    '--body-weight': a.bodyWeight, '--heading-weight': a.headingWeight,
    '--letter-title': a.letterTitle, '--letter-label': a.letterLabel,
    '--label-transform': a.labelTransform,
    '--shadow': m.shadow, '--shadow-pop': m.shadowPop,
    background: 'var(--bg)', color: 'var(--ink)',
    fontFamily: 'var(--font-body)', fontWeight: 'var(--body-weight)',
    fontFeatureSettings: '"ss01", "cv11", "tnum"',
    ...style
  };
  return (
    <div data-mode={mode} style={vars} {...rest}>
      {children}
    </div>);

}

function hexAlpha(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

Object.assign(window, { SOFT, ACCENTS, Theme, hexAlpha });