// main.jsx
// Description: the renderer entry — reads the window kind from the query
//              string, holds the state snapshot (sync first paint, then
//              broadcasts), wraps everything in the theme, and mounts the
//              right root component.
// Inputs:  ?win= query param, window.logit bridge
// Outputs: the mounted window UI
// Created: 2026-08-17

import React from 'react';
import { createRoot } from 'react-dom/client';
import './reset.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/source-serif-4/500.css';
import '@fontsource/source-serif-4/600.css';
import { PopupRoot } from './popups.jsx';
import { Shell } from './shell.jsx';
import { ShortcutRoot } from './shortcut.jsx';
import { Theme } from './theme.jsx';
import { Icon } from './icons.jsx';

const windowKind = new URLSearchParams(window.location.search).get('win') ?? 'shell';

// Description: the state snapshot — synchronous first paint, then broadcasts.
// Inputs: none  Outputs: state object
function useAppState() {
  const [state, setState] = React.useState(() => window.logit.getStateSync());
  React.useEffect(() => {
    window.logit.onState(setState);
  }, []);
  return state;
}

// Description: the toast card (SPEC §8.10) — text arrives by message.
// Inputs: none  Outputs: element
function ToastRoot() {
  const [text, setText] = React.useState('');
  React.useEffect(() => {
    window.logit.onToast(setText);
  }, []);
  if (!text) return null;
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: 8
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'var(--panel)', border: '1px solid var(--line-strong)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-pop)',
        padding: '10px 14px', fontSize: 12.5, color: 'var(--ink)'
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: 999, background: 'var(--success)',
          color: 'var(--accent-ink)', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flex: 'none'
        }}>
          <Icon name="check" size={10} />
        </span>
        {text}
      </div>
    </div>
  );
}

function App() {
  const state = useAppState();
  return (
    <Theme mode={state.theme} style={{ background: 'transparent' }}>
      {windowKind === 'shell' && <Shell state={state} />}
      {windowKind === 'popup' && <PopupRoot state={state} />}
      {windowKind === 'shortcut' && <ShortcutRoot state={state} />}
      {windowKind === 'toast' && <ToastRoot />}
    </Theme>
  );
}

createRoot(document.getElementById('root')).render(<App />);
