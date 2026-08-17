// Themed widget primitives. Each reads CSS vars from the surrounding <Theme>
// wrapper, so the same code renders three aesthetics by changing the wrapper.

const Btn = ({ kind = 'ghost', size = 'md', icon, iconAfter, children, style, onClick, disabled, ...rest }) => {
  const padY = size === 'sm' ? 6 : size === 'lg' ? 12 : 9;
  const padX = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fs = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;
  const bases = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: `${padY}px ${padX}px`,
    fontFamily: 'inherit', fontSize: fs, fontWeight: 500,
    lineHeight: 1, letterSpacing: '-0.005em',
    borderRadius: 'var(--radius)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: '1px solid transparent',
    transition: 'background 120ms, color 120ms, border-color 120ms, transform 120ms',
    whiteSpace: 'nowrap'
  };
  const kinds = {
    primary: {
      background: 'var(--accent)', color: 'var(--accent-ink)',
      borderColor: 'var(--accent)'
    },
    secondary: {
      background: 'var(--panel)', color: 'var(--ink)',
      borderColor: 'var(--line-strong)'
    },
    ghost: {
      background: 'transparent', color: 'var(--ink-2)',
      borderColor: 'transparent'
    },
    soft: {
      background: 'var(--accent-soft)', color: 'var(--accent)',
      borderColor: 'transparent'
    },
    danger: {
      background: 'transparent', color: 'var(--ink-2)',
      borderColor: 'var(--line-strong)'
    }
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...bases, ...kinds[kind], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (kind === 'ghost') e.currentTarget.style.background = 'var(--accent-softer)';
        if (kind === 'secondary') e.currentTarget.style.borderColor = 'var(--ink-3)';
      }}
      onMouseLeave={(e) => {
        if (kind === 'ghost') e.currentTarget.style.background = 'transparent';
        if (kind === 'secondary') e.currentTarget.style.borderColor = 'var(--line-strong)';
      }}
      {...rest}>
      
      {icon && <Icon name={icon} size={fs + 1} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={fs + 1} />}
    </button>);

};

const TextField = ({ value, onChange, placeholder, suffix, icon, mono, style, ...rest }) =>
<label style={{
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--panel)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '0 12px', height: 38,
  width: '100%', boxSizing: 'border-box', minWidth: 0,
  transition: 'border-color 120ms',
  fontFamily: mono ? 'var(--font-mono)' : 'inherit',
  ...style
}}>
    {icon && <Icon name={icon} size={14} style={{ color: 'var(--ink-3)' }} />}
    <input
    value={value} onChange={(e) => onChange && onChange(e.target.value)}
    placeholder={placeholder}
    onFocus={(e) => e.currentTarget.parentElement.style.borderColor = 'var(--accent)'}
    onBlur={(e) => e.currentTarget.parentElement.style.borderColor = 'var(--line)'}
    style={{
      flex: 1, background: 'transparent', border: 'none', outline: 'none',
      color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, height: '100%',
      minWidth: 0
    }}
    {...rest} />
  
    {suffix && <span style={{ color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{suffix}</span>}
  </label>;


// Searchable combo box (dropdown + freetext).
const Combo = ({ value, onChange, options, placeholder, icon, dot }) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value || '');
  React.useEffect(() => setDraft(value || ''), [value]);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const close = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = options.filter((o) => !draft || o.label.toLowerCase().includes(draft.toLowerCase()));
  const exact = options.some((o) => o.label.toLowerCase() === draft.toLowerCase());
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', padding: '0 10px 0 12px', height: 38,
        width: '100%', boxSizing: 'border-box', minWidth: 0,
        transition: 'border-color 120ms',
        borderColor: open ? 'var(--accent)' : 'var(--line)'
      }}>
        {dot &&
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: dot, flex: 'none'
        }} />
        }
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--ink-3)' }} />}
        <input
          value={draft}
          onChange={(e) => {setDraft(e.target.value);setOpen(true);}}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {onChange && onChange(draft);setOpen(false);}
            if (e.key === 'Escape') {setOpen(false);}
          }}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, height: '100%', minWidth: 0
          }} />
        
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'transparent', border: 'none', color: 'var(--ink-3)',
            cursor: 'pointer', padding: 4, display: 'flex'
          }}>
          
          <Icon name="chevron-down" size={14} />
        </button>
      </label>
      {open &&
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
        background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-pop)',
        padding: 4, zIndex: 50, maxHeight: 220, overflowY: 'auto'
      }}>
          {filtered.map((o) =>
        <div key={o.label}
        onMouseDown={(e) => {e.preventDefault();onChange && onChange(o.label);setDraft(o.label);setOpen(false);}}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          fontSize: 13, color: 'var(--ink)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-softer)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          
              {o.color &&
          <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color, flex: 'none' }} />
          }
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.hours != null &&
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {o.hours}h
                </span>
          }
            </div>
        )}
          {!exact && draft &&
        <div
          onMouseDown={(e) => {e.preventDefault();onChange && onChange(draft);setOpen(false);}}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontSize: 13, color: 'var(--accent)',
            borderTop: filtered.length ? '1px solid var(--line)' : 'none',
            marginTop: filtered.length ? 4 : 0,
            paddingTop: filtered.length ? 11 : 7
          }}>
          
              <Icon name="plus" size={13} />
              <span>Create &ldquo;{draft}&rdquo;</span>
            </div>
        }
          {!filtered.length && !draft &&
        <div style={{ padding: '7px 10px', color: 'var(--ink-3)', fontSize: 12 }}>No matches</div>
        }
        </div>
      }
    </div>);

};

const Segmented = ({ value, onChange, options }) =>
<div style={{
  display: 'inline-flex', background: 'var(--panel-alt)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: 3, gap: 2
}}>
    {options.map((o) => {
    const sel = value === o.value;
    return (
      <button key={o.value}
      onClick={() => onChange(o.value)}
      style={{
        padding: '6px 12px', border: 'none', cursor: 'pointer',
        background: sel ? 'var(--panel)' : 'transparent',
        color: sel ? 'var(--ink)' : 'var(--ink-2)',
        borderRadius: 'calc(var(--radius) - 3px)',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
        boxShadow: sel ? 'var(--shadow)' : 'none',
        transition: 'all 120ms'
      }}>
        {o.label}</button>);

  })}
  </div>;


const Panel = ({ pad = 20, style, children, ...rest }) =>
<div style={{
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: pad,
  ...style
}} {...rest}>
    {children}
  </div>;


const Label = ({ children, style, ...rest }) =>
<div style={{
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 'var(--letter-label)',
  textTransform: 'var(--label-transform)',
  color: 'var(--ink-3)',
  ...style
}} {...rest}>{children}</div>;


const Title = ({ size = 24, children, style, ...rest }) =>
<h2 style={{
  fontFamily: 'var(--font-display)',
  fontWeight: 'var(--heading-weight)',
  letterSpacing: 'var(--letter-title)',
  fontSize: size,
  lineHeight: 1.15,
  margin: 0,
  color: 'var(--ink)',
  ...style
}} {...rest}>{children}</h2>;


const Stat = ({ value, label, sub, style }) =>
<div style={style}>
    <div style={{
    fontFamily: 'var(--font-display)',
    fontWeight: 'var(--heading-weight)',
    letterSpacing: 'var(--letter-title)',
    fontSize: 34, lineHeight: 1, color: 'var(--ink)',
    fontFeatureSettings: '"tnum","ss01"'
  }}>{value}</div>
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <Label>{label}</Label>
      {sub && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{sub}</span>}
    </div>
  </div>;


const Pill = ({ children, color, style }) =>
<span style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '3px 8px', borderRadius: 999,
  background: color ? hexAlpha(color, 0.14) : 'var(--accent-soft)',
  color: color || 'var(--accent)',
  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500,
  border: `1px solid ${color ? hexAlpha(color, 0.22) : 'transparent'}`,
  ...style
}}>
    {children}
  </span>;


// Toggle (just visual; for tiny on/off bits)
const Toggle = ({ value, onChange }) =>
<button onClick={() => onChange(!value)} style={{
  width: 32, height: 18, borderRadius: 999,
  background: value ? 'var(--accent)' : 'var(--ink-4)',
  border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
  transition: 'background 150ms'
}}>
    <span style={{
    position: 'absolute', top: 2, left: value ? 16 : 2,
    width: 14, height: 14, borderRadius: 999, background: '#fff',
    transition: 'left 150ms', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
  }} />
  </button>;


Object.assign(window, { Btn, TextField, Combo, Segmented, Panel, Label, Title, Stat, Pill, Toggle });