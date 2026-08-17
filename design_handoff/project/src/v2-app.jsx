// LogIT v2 — Session 4 redesign.
// Backward-looking model: popups close the row that just ended.
// 17 variants × light + dark = 34 artboards, in 3 sections.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5d7a5b"
}/*EDITMODE-END*/;

function RootV2() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Each artboard hosts a Theme wrapper at its own mode so we can show light
  // and dark side by side in one canvas.
  const Wrap = ({ mode, children }) => (
    <Theme mode={mode} accent={t.accent}
      style={{ width: '100%', height: '100%', background: 'transparent',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               padding: 12, boxSizing: 'border-box' }}>
      {children}
    </Theme>
  );

  // Sizing
  const PAD = 24;
  const SHELL_AW = SHELL_W + PAD;    const SHELL_AH = 660;
  const POP_AW   = POP_W + PAD;
  const POP_AH_SHORT = 380;          // start-logging popup is shorter
  const POP_AH_FOCUS_ACTIVE = 600;   // focus active variant has 2 sections
  const POP_AH_CHECKIN = 560;        // check-in popups
  const POP_AH_CHECKIN_TALL = 620;   // when helper card / validation present
  const SHORT_AW = 140;              const SHORT_AH = 140;

  // Helper: returns a Fragment as a plain function (NOT a component) so the
  // DesignCanvas's dcFlatten can descend into it — dcFlatten only unwraps
  // raw React.Fragment elements, not custom components.
  const pair = (id, label, w, h, render) => (
    <React.Fragment key={id}>
      <DCArtboard id={`${id}-light`} label={`${label} · Light`} width={w} height={h}>
        <Wrap mode="light">{render('light')}</Wrap>
      </DCArtboard>
      <DCArtboard id={`${id}-dark`} label={`${label} · Dark`} width={w} height={h}>
        <Wrap mode="dark">{render('dark')}</Wrap>
      </DCArtboard>
    </React.Fragment>
  );

  return (
    <React.Fragment>
      <DesignCanvas>
        {/* ─── SHELLS ─────────────────────────────────────────────────── */}
        <DCSection
          id="shells-v2"
          title="Sidebar shells · 4 variants"
          subtitle="Startup (normal + engagement-paused) and Dashboard (open normal row + active focus session). 880×600 shell, light + dark each.">

          {pair('01-startup-normal', '01 · Startup — Normal',
            SHELL_AW, SHELL_AH,
            (m) => <StartupWindowV2 mode={m} onToggleMode={() => {}} />)}

          {pair('02-startup-paused', '02 · Startup — Engagement paused',
            SHELL_AW, SHELL_AH,
            (m) => <StartupWindowV2 mode={m} onToggleMode={() => {}} paused />)}

          {pair('03-dashboard-open-row', '03 · Dashboard — Open normal row (no details yet)',
            SHELL_AW, SHELL_AH,
            (m) => <DashboardWindowOpenRow mode={m} onToggleMode={() => {}} />)}

          {pair('04-dashboard-focus', '04 · Dashboard — Active focus session',
            SHELL_AW, SHELL_AH,
            (m) => <DashboardWindowFocus mode={m} onToggleMode={() => {}} />)}
        </DCSection>

        {/* ─── POPUPS ─────────────────────────────────────────────────── */}
        <DCSection
          id="popups-v2"
          title="Compact popups · 9 variants"
          subtitle="Start-logging (NEW), Check-in (5 firing contexts + validation error), Focus (inactive + active). All 400 wide. Backward-looking copy throughout.">

          {pair('05-start-logging', '05 · Start-logging popup (NEW)',
            POP_AW, POP_AH_SHORT,
            (m) => <StartLoggingPopup mode={m} onToggleMode={() => {}} />)}

          {pair('06-checkin-interval', '06 · Check-in — INTERVAL context',
            POP_AW, POP_AH_CHECKIN,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="interval" />)}

          {pair('07-checkin-validation', '07 · Check-in — Validation error (required fields)',
            POP_AW, POP_AH_CHECKIN_TALL,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="interval" invalid />)}

          {pair('08-checkin-offcycle', '08 · Check-in — OFF_CYCLE context',
            POP_AW, POP_AH_CHECKIN,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="offcycle" />)}

          {pair('09-checkin-focus-end', '09 · Check-in — FOCUS_END (Skip + X hidden)',
            POP_AW, POP_AH_CHECKIN,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="focus_end" />)}

          {pair('10-checkin-focus-interrupt', '10 · Check-in — FOCUS_INTERRUPT (NEW · reversible)',
            POP_AW, POP_AH_CHECKIN_TALL,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="focus_interrupt" />)}

          {pair('11-checkin-exit-prompt', '11 · Check-in — EXIT_PROMPT (no countdown)',
            POP_AW, POP_AH_CHECKIN_TALL,
            (m) => <CheckInPopupV2 mode={m} onToggleMode={() => {}} context="exit_prompt" />)}

          {pair('12-focus-inactive', '12 · Focus popup — Inactive (simplified)',
            POP_AW, POP_AH_SHORT,
            (m) => <FocusPopupInactiveV2 mode={m} onToggleMode={() => {}} />)}

          {pair('13-focus-active', '13 · Focus popup — Active (wrap up + new focus)',
            POP_AW, POP_AH_FOCUS_ACTIVE,
            (m) => <FocusPopupActiveV2 mode={m} onToggleMode={() => {}} />)}
        </DCSection>

        {/* ─── FLOATING SHORTCUT ──────────────────────────────────────── */}
        <DCSection
          id="shortcut-v2"
          title="Floating shortcut · 4 states"
          subtitle="84×84 always-on-top button. Sage = normal, warm rust = focus, muted = inactive or paused.">

          {pair('14-shortcut-normal', '14 · Shortcut — Normal',
            SHORT_AW, SHORT_AH,
            (m) => <FloatingShortcutV2 state="normal" mode={m} />)}

          {pair('15-shortcut-focus', '15 · Shortcut — Focus mode',
            SHORT_AW, SHORT_AH,
            (m) => <FloatingShortcutV2 state="focus" mode={m} />)}

          {pair('16-shortcut-inactive', '16 · Shortcut — Inactive (no open row)',
            SHORT_AW, SHORT_AH,
            (m) => <FloatingShortcutV2 state="inactive" mode={m} />)}

          {pair('17-shortcut-paused', '17 · Shortcut — Engagement paused',
            SHORT_AW, SHORT_AH,
            (m) => <FloatingShortcutV2 state="paused" mode={m} />)}
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent (applied to all artboards)" />
        <TweakColor label="Accent · Light"
          value={t.accent}
          options={ACCENTS.light}
          onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<RootV2 />);
