// Root: 4 windows on a design canvas. Light/dark toggle lives in tweaks
// AND inside each window's chrome — both wired to the same state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "light",
  "accent": "#5d7a5b"
}/*EDITMODE-END*/;

function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const toggleMode = () => setTweak('mode', t.mode === 'light' ? 'dark' : 'light');

  // Re-pick a sensible default accent when the user flips modes
  // (otherwise the light accent on a dark bg looks washed out and vice versa).
  React.useEffect(() => {
    const palette = ACCENTS[t.mode];
    if (!palette.includes(t.accent)) {
      setTweak('accent', palette[0]);
    }
  }, [t.mode]);

  const Wrap = ({ children, w, h }) => (
    <Theme mode={t.mode} accent={t.accent}
      style={{ width: '100%', height: '100%', background: 'transparent',
               display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Theme>
  );

  // Artboard sizes — windows shrink to fit content; artboards just need
  // enough room for the tallest variant + a touch of breathing space.
  const PAD = 24;
  const popAW = POP_W + PAD,  popAH = 460;
  const shAW  = SHELL_W + PAD, shAH = 460;
  // Floating shortcut is tiny — just the 84×84 button + a touch of room for the ring.
  const shortAW = 120, shortAH = 120;

  const winProps = { mode: t.mode, onToggleMode: toggleMode };

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection
          id="popups"
          title="LogIT · 4 popup windows"
          subtitle="Soft Modern · light + dark · serif headings, sage accent. Toggle mode from any window or the Tweaks panel."
        >
          <DCArtboard id="startup"  label="1 · Startup"    width={shAW}  height={shAH}>
            <Wrap><StartupWindow {...winProps} /></Wrap>
          </DCArtboard>
          <DCArtboard id="dashboard" label="2 · Dashboard" width={shAW}  height={shAH}>
            <Wrap><DashboardWindow {...winProps} /></Wrap>
          </DCArtboard>
          <DCArtboard id="checkin"  label="3 · Check-in"   width={popAW} height={popAH}>
            <Wrap><CheckInWindow {...winProps} /></Wrap>
          </DCArtboard>
          <DCArtboard id="focus"    label="4 · Focus mode" width={popAW} height={popAH}>
            <Wrap><FocusWindow {...winProps} /></Wrap>
          </DCArtboard>
          <DCArtboard id="shortcut" label="5 · Floating shortcut" width={shortAW} height={shortAH}>
            <Wrap><ShortcutWindow {...winProps} /></Wrap>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Mode" value={t.mode}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          onChange={(v) => setTweak('mode', v)} />

        <TweakSection label="Accent" />
        <TweakColor label="Accent" value={t.accent}
          options={ACCENTS[t.mode]}
          onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
