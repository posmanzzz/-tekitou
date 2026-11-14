# daifugo source map

`daifugo.html` is GENERATED. Edit files here, then run `python3 /home/claude/build.py`
(`--out PATH` to write elsewhere). Tests: `/home/claude/t/run_all.sh` (FULL=1 adds chaos.js).

- `index.template.html`: HTML shell. `/*@@CSS@@*/` and `/*@@JS@@*/` lines are replaced by
  the concatenation of `css/*.css` and `js/*.js` in filename order. Nothing else is added or stripped.
- JS fragments are NOT modules: they are consecutive slices of ONE IIFE `(() => { "use strict"; ... })();`
  (opens at the top of js/01, closes at the bottom of js/16). All of it shares one closure scope.
- Add a new fragment by renaming/inserting a `NN-` prefix; cut only at top-level statement boundaries.

## css/ (order matters: later rules override earlier ones)
- 01-base-table-cards: :root vars, base, table/seats, playing cards, menu.
- 02-fx-legacy: first effect layers (#fx, chat/ready/bomber, fx v3, avatar icons).
- 03-fx-v4-dopa-kanji: full-screen effects v4, ドパガキ (.onoma, stamps), pachinko kanji.
- 04-theme-parlor: "THEME: ドパガキ・パーラー" override layer (re-themes :root and most components).
- 05-perf-overrides: 軽量化 (transform/opacity only) and 軽量化2 overrides (turn off heavy decorations); the `.led` frame
  (four `<i>` strips whose `::before` slides by `transform`; do NOT animate background-position, it repaints the whole root layer
  every frame); `body.q1` / `body.q2` rules of the quality governor (see below).
- 06-uno: UNO cards/seats/colors (body.uc-*).
- 07-wide-layout: `body.wide` PC landscape layout.
- 08-spots-and-late: background spotlights (#spots), then late additions (mini games, lobby/room list .rrow).
- 09-ux: LAST layer. Safe-area vars (`--sat/--sar/--sab/--sal` = env(safe-area-inset-*); tests override them), focus-visible/hover, settings/help sheets, `body.land` compact landscape layout (seats in one top row, hand bottom-left, controls in a right column of `--rc`=196px), short-portrait compaction, UNO colour letters, timer ring (`.tring`), first-visit hint, keyboard cursor `.kf`.

## js/
- 01-rules-daifugo: constants (SUITS, RULE_DEFS, DEFAULT_RULES, PRESETS), analyze/canPlay, blankRoom, startRound,
  doPlay/doGive/doBomb/doPass, resolveAfter, CPU (candidates, botMove). Pure state functions, no DOM.
- 02-engine-uno: UNO rules (unoDeck, uCanPlay, uPlay, uDraw, uSeven, uCallUno) and unoBot.
- 03-engine-mini: miniStart; ババ抜き (babaStart, bDraw, bPeek, bShuffle, babaBot); 神経衰弱 (shinkeiStart, kFlip, shinkeiBot); replaceId.
- 04-engine-actions: addBot, `botStep(s,pid)` / `autoTurn(s,pid)` (one CPU move for ANY pid; used by CPU turns and by timeout auto-moves),
  `applyAction(s, actor, a)` (single entry for ALL game actions, returns true/false/error string; it is a wrapper that validates the
  actor id / action shape, snapshots the state and restores it if the inner `applyActionInner` throws; `engineErrors()` counts those),
  `viewFor(s,pid)` (per-player hidden-info filter; also hides UNO `u.drew.card`), and `normState(s)` (allow-list rebuilder for any state
  received from the network: drops unknown fields, caps sizes, returns null if structurally broken). **A new state field must be added to normState or it will be dropped on clients.**
  Actions added for the timer: `timer` (host, non-play phase, 0/15/30/60), `auto` (host only), `back` (leave "away").
- 05-util-audio-fxcore: esc/hash/store/sstore/clone, `window.__dfg` test export and the test early-return, audio (tone/noise/sfx),
  banner/flash/shake, PFX single-canvas particle system (confetti/burst/fireworks/rain), `QG` quality governor, overlay helpers, flyCardsToField, myTurnFx.
- 06-fx-dopa-slam: fxLevel/dopa(), onoma/stamp/praise/kanji/cutin, winFx/placeFx, avaSlam + good/bad slam variants (GOODF/BADF tables).
- 07-fx-playfx: bomber hand explosion (snapHand/explodeHand) and `playFx(e)` (dispatch of daifugo fx events).
- 08-net-core: myId/myKey security (sha256hex, cleanIn), mode/S/sel globals, setState/applyState, `act(a)` (routes to solo/db/p2p), db (Claude-artifact) mode, avatar images.
- 08-net-errors: error ring buffer (`pushErr`, 20 entries, `bugReport()` without passphrase/keys; exposed only as `__dfgNet.errs/report`), `guard(fn,where)`,
  global error / unhandledrejection handler (debounced re-render, burst -> `showCrash()` with a way back to the entry screen). PeerJS-internal errors are only recorded.
- 09-net-p2p: `APP_VERSION` and integer `PROTO` (bump PROTO whenever a message shape changes; join and every state message carry it and a mismatch is refused with a "reload" message in either direction),
  per-device relay option (`relayOn()`/`peerCfg()`, localStorage `dfg_relay`), pending-connection limits, one seat per connection, `handleMerge` (always answers no). PeerJS host/client: setupHostConn, hostApply/broadcast, hostWatchdog, becomeHost/tryTakeover (host migration),
  connectHost/startRejoin, clientHeartbeat, joinP2P/cleanupP2P/handoffHost. ICE_SERVERS, PEER_OPTS.
- 09-net-timer: host-enforced turn timer (see "Turn timer" below) and its UI (`.tmr` badge, `#tmwarn`, `#afkbar`).
- 10-net-directory: lazy directory connection (`dirWanted`/`dirSync`: only on the entry screen for users who have not opted out via `dfg_nodir`; stopped in solo), `dirNorm` validates every listing field. Room list ("案内所" peer id DIR_ID, `Dir`), dirTick/dirRegister, entry-page list; joinOnline/startSolo/backToEntry/leave; `driveBots` (host-only CPU stepping).
- 11-ui-common: `render()` dispatch by screen/game, stateSig diff, runFx, chat (collectChat/sendChat/updateChat), cardEl, avatar(), fx/sound buttons.
- 12-ui-entry-lobby: renderEntry, lobby panels (playerChips, rulesPanel, gamePanel, securityPanel), start controls, renderLobby.
- 13-ui-uno: unoCardEl, unoSeatHtml, unoControls, renderUno, playUnoFx.
- 14-ui-mini: shared genSeatHtml/tableTop, renderBaba/playBabaFx, kGrid/renderShinkei/playShinkeiFx.
- 15-ui-reactions-motion: thrown items (processThrows/throwHit), 激アツ予告 yokoku, turn orb/seatHop/fieldPunch.
- 15b-ui-settings-help: settings sheet (⚙), help sheet (❓ per game), confirm dialog (all rendered into `#ov`, outside `#app`, so table re-renders never touch them), the `LAYERS`/history manager (`layerSync()` pushes one history entry per open layer + one for the room; popstate closes the top layer, from the room asks `askLeave()`), Wake Lock, `beforeunload` (online play only), PWA glue (`__pwa` read only; sets `ui=false`, shows `#updbar`, never during play), first-visit hint (`firstHint/noteMove`), `topCardAt()` (visually topmost card), keyboard handler + `kb` cursor, `uxSync()` (called at the end of every `render()`). `SAFE` (px insets, read by `readSafe()` via the `#saprobe` element) is used by 16/13/14 for geometry.
- 16-ui-daifugo-pages: table geometry (SEAT_POS, isWide, seatPos, handGeom, layoutHand), controls, renderGame, menuHtml, renderResult,
  then the final `render();` call and the IIFE closer `})();`.

## Turn timer (09-net-timer)
- Setting lives in the state (`tsec`: 0/15/30/60; default 30 online, solo sets 0). Only the host counts. Every state message carries `tr` (ms left) and `tp` (whose turn);
  clients set `deadline = Date.now()+tr`, so device clocks never matter. On timeout the host applies `{t:"auto"}`; two in a row -> away/CPU until `back` or any own action.
- Heavy effects add grace; a new host restarts the current turn with a full-length deadline. Never fires for bot/away turns.

## UX layer (settings, help, layouts, keyboard)
- Layout kinds: `layKey()` = `l` (land: `innerHeight<=520 && w>1.3h`, takes priority) / `w` (wide PC) / `p` (portrait). `applyWide()` sets `body.wide` / `body.land` and re-renders when the kind changes.
- Portrait: `handGeom` goes to 2 rows when overlap would be < 26px per card (smaller cards then), `fitField()` (in `placeBar()`) centres/scales `.field` in the gap between the seats and the control bar, `seatPos` keeps seats below the ticker.
- Settings keys (all through `store`): dfg_fxlv, dfg_vol (0..3, `VOLS` gain table in 05; dfg_snd is kept in sync), dfg_vib, dfg_sort (`str`|`suit`, `mySort`), dfg_relay, dfg_nodir, dfg_ipnote, dfg_hint_<game>.
- Never add `window.__x = ...` (production build rejects it); `window.__pwa` is only read.
- Tests: `uxshots.js` (screenshots to `t/ux/`, all viewports x games x 4/10 players + geometry check; `--safe` simulates insets), `uxlayout.js` (same, no screenshots, in run_all), `keytest.js` (keyboard-only turns), `uxtest.js` (back button, settings persistence, double tap, hints, help, PWA glue with a fake `__pwa`), `uxshots2.js` (feature screenshots).

## Tests added with the hardening work (all in run_all.sh)
`advfuzz` (engine adversarial fuzz), `advnet` (hostile client and hostile host), `xss` (sink escaping with payloads in every field), `timertest` (engine timer),
`p2ptimer` (timer in real browsers, clock skew, hand-off), `protocol` (PROTO handshake, relay toggle, lazy directory, `__dfgSet` absent in a plain build).
Security overview for users/hosts: `/home/claude/SECURITY.md`.

## Order-sensitive notes
- 05 contains `window.__dfg={...}; if(window.__DFG_TEST__) return;`. In jsdom tests the IIFE returns there, so
  ONLY js/01..04 and the top of 05 run. Do not move DOM/net code above it, and keep engine code (01-04) before it.
- `t/build.py` patches the literal text `window.__dfgDebug = () => S;` (in 08-net-core) to add `__dfgFx`
  (eval hook used by browser tests) and injects `window.__DFG_HOOKS__=true;` (the only thing that enables `__dfgSet`; the flag name must stay on that one stripped `window.__` line) and injects a PeerJS tag before the first `<script>`. Keep that text intact.
- Top-level `let`/`const` are in the temporal dead zone until their line executes. `fxLevel` (06) is used by functions
  in 05; `GOODF`/`BADF` (end of 06) by slamGood/slamBad. This works only because nothing calls them before load finishes;
  do not call fx code during load (the single `render();` at the very end of 16 is what starts the app).
- The stray comment "アクション（全操作の入口）" at the end of 01 is a leftover; the real applyAction is in 04.
- 09/10 share state declared in 08 (`peer`, `conn`, `conns`, `S`, `mode`); 10 `driveBots` is called from setState in 08.
- CSS 04 and 05 override earlier layers by design; appending a rule to a late file beats editing an early one.

## Performance notes (read before touching animations or fx)
- Rule of thumb: continuous (infinite) animations must be `transform`/`opacity` only. Anything else (background-position, box-shadow,
  filter) repaints into the root layer every frame and keeps the main thread busy even when the table is idle.
  The `.ribbon` rainbow and `.led` strips slide a `::before` with `transform` for that reason. Idle my-turn table = 0 Blink paints/sec.
- The hand bob is ONE animation on `.hand.myturn` (08-spots-and-late), not one per card (that created one compositor layer per card).
- Layers are expensive in memory: a full-screen layer is ~10 MB at 1080x2400. `.aslam .rays` is a rotating conic square sized 130vmax
  (it must cover the screen from (50%,42%) at every angle; it used to be 240vmax = 126 MB).
- `QG` (js/05) = automatic quality governor. It samples rAF frame times ONLY while effects are running (`#fx` has children or PFX has
  particles), steps `tier` 0->1->2 after ~1.5 s below 45 fps and back after ~6 s above 55 fps. tier>=1 sets `body.q1` (canvas DPR 1, particles x0.6,
  lighter kanji glow), tier 2 sets `body.q2` (particles x0.35, hides cutin lines / rays / smoke / ov-rgb). `fxLevel` is never touched and
  kanji / cut-ins / slams still play. Force with localStorage `dfg_qg` = `off` (disable) | `1` | `2`; tests can read `QG.tier()` / `QG.changes()`.
  `Q(n)` (particle count) multiplies the old PFX auto factor and the governor factor.
- `fxLevel` default: if `dfg_fxlv` was never stored, it is 0 when the OS asks for `prefers-reduced-motion: reduce`, else 2.
- Benchmarks live in `t/`: `perfbench.js` (frame times, CPU split, layers; `--page baseline|www`, `--qg off|auto`), `layers_c.js` / `layers_b.js`
  (layer breakdown), `paintwho.js` (which elements repaint), `anims.js` (running animations), `parity.js` + `parity_montage.py` (before/after screenshots),
  `rendercost.js`. `t/baseline/index.html` is the pre-optimisation build and `t/perf_baseline.json` / `t/perf_after_*.json` hold the saved numbers.
- Careful: a CSS rule that looks dead may not be (e.g. `.led.rb i` used to win over `.led i` by specificity). Check with a screenshot before deleting.
- Known leftover: `.seat.turn .plate` (glow/turnGlow) and `#play` (playPulse), `.sstat.unoleft`, `.unobtn`, `.udeck.can .ucard` still animate `box-shadow` (small areas, repaint only their own rect).
  Converting needs an extra glow element because `.plate` has `overflow:hidden`; measured negligible, left as is.
