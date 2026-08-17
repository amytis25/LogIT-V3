// Minimal Lucide-style line icons. Stroke uses currentColor so they inherit ink.
// Kept simple — geometric primitives, no decorative SVG paths.

const Icon = ({ name, size = 16, stroke = 1.6, style, ...rest }) => {
  const p = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'inline-block', flex: 'none', ...style },
    ...rest
  };
  switch (name) {
    case 'clock':return (
        <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);

    case 'focus':return (
        <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>);

    case 'pencil':return (
        <svg {...p}><path d="M14 4l6 6L9 21H3v-6L14 4z" /></svg>);

    case 'chart':return (
        <svg {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg>);

    case 'tag':return (
        <svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none" /></svg>);

    case 'folder':return (
        <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>);

    case 'play':return (
        <svg {...p}><path d="M7 4l13 8-13 8V4z" /></svg>);

    case 'pause':return (
        <svg {...p}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>);

    case 'x':return (
        <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);

    case 'check':return (
        <svg {...p}><path d="M4 12l5 5 11-12" /></svg>);

    case 'plus':return (
        <svg {...p}><path d="M12 5v14M5 12h14" /></svg>);

    case 'minus':return (
        <svg {...p}><path d="M5 12h14" /></svg>);

    case 'chevron-down':return (
        <svg {...p}><path d="M6 9l6 6 6-6" /></svg>);

    case 'chevron-right':return (
        <svg {...p}><path d="M9 6l6 6-6 6" /></svg>);

    case 'arrow-right':return (
        <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

    case 'arrow-up-right':return (
        <svg {...p}><path d="M7 17L17 7M9 7h8v8" /></svg>);

    case 'calendar':return (
        <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);

    case 'settings':return (
        <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>);

    case 'sun':return (
        <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>);

    case 'moon':return (
        <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);

    case 'sparkle':return (
        <svg {...p}><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" /></svg>);

    case 'dot':return (
        <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>);

    case 'grip':return (
        <svg {...p}><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" /></svg>);

    case 'logo':return (
        // A square with an inset clock-hand mark — the LogIT identity placeholder.
        <svg {...p} viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="2" y="2" width="20" height="20" rx="6" />
        <rect x="11" y="6" width="2" height="7" rx="1" fill="var(--accent-ink, #fff)" />
        <rect x="11" y="11" width="6" height="2" rx="1" fill="var(--accent-ink, #fff)" />
      </svg>);

    default:return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
};

window.Icon = Icon;