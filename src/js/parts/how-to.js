/**
 * Animated "how to use" banner for the widgets registry.
 *
 * Same idea as the electerm.org blog banners: generated DOM + CSS, no image,
 * no canvas, no GIF, one requestAnimationFrame timeline, one PERIOD, a T
 * object of named beats consumed by a single frame(t). Layout is in em and the
 * root font-size is 1% of the banner width, so the whole scene scales.
 *
 * The story is the real install path, in the site's own words:
 *   1. click Copy install on a widget card (owner/repo#<40-char sha>);
 *   2. paste it into electerm's Widgets → Online panel;
 *   3. hit Verify & install; package.json, main.js and every file's sha256
 *      are checked, the widget lands in the list and opens in a new tab.
 *
 * A status line narrates each beat, so a frozen frame still teaches something.
 * Pointer targets are measured from the DOM, never hard-coded.
 *
 * Mount point: any element with [data-how-banner].
 */
const STYLE_ID = 'htu-style'

const PERIOD = 13200

const T = {
  regFrom: 0,
  regTo: 700,
  appFrom: 220,
  appTo: 920,
  cardFrom: 700,
  cardTo: 1100,
  miniFrom: 950,
  miniGap: 170,
  ptrCopyFrom: 1500,
  ptrCopyTo: 1950,
  copyClick: 2000,
  ptrInputFrom: 2600,
  ptrInputTo: 3150,
  typeFrom: 3250,
  typeTo: 5050,
  ptrVerifyFrom: 5350,
  ptrVerifyTo: 5800,
  verifyClick: 5900,
  checkFrom: 6100,
  checkGap: 300,
  doneFrom: 7450,
  doneTo: 7950,
  rowFrom: 7500,
  rowTo: 7850,
  tabFrom: 7900,
  tabTo: 8250,
  ptrOutFrom: 8500,
  ptrOutTo: 8900,
  fadeFrom: 11800,
  fadeTo: 13000
}

// Truncated for the banner; the real string carries a full 40-char sha.
// The tftp widget is used because its repo name is short enough that the
// sha prefix stays visible in the input at both desktop and card scales.
const INSTALL = 'electerm/electerm-widget-tftp#62957d63…'

const STEPS = [
  { at: 0, label: '01 / 03   Copy the install string', status: 'copy  ·  owner/repo#sha  ·  source commit pinned' },
  { at: T.copyClick, label: '02 / 03   Paste into Widgets → Online', status: 'Widgets → Online  ·  paste the string, then import' },
  { at: T.verifyClick, label: '03 / 03   Verify every file', status: 'verify  ·  package.json, main.js, sha256 per file' },
  { at: T.doneFrom, label: 'DONE   ·   Ready to run', status: 'installed  ·  commit pinned  ·  Local TFTP Server is ready' }
]

// Geometry (padding, gap, width, height, left, top) lives only on boxes with
// no font-size of their own; text leaves only set font-size. Otherwise em would
// resolve against the leaf's own font-size and silently inflate the layout.
const CSS = `
.htu {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 2 / 1;
  overflow: hidden;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg, 14px);
  background: #f7faff;
  color: #0f172a;
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif);
  line-height: 1.3;
  isolation: isolate;
  -webkit-font-smoothing: antialiased;
}
.htu::before {
  content: '';
  position: absolute;
  z-index: 0;
  inset: -4em;
  background-image: radial-gradient(rgba(37,99,235,.22) .13em, transparent .13em);
  background-size: 3.6em 3.6em;
  opacity: .55;
  animation: htu-drift 36s linear infinite;
  pointer-events: none;
}
.htu::after {
  content: '';
  position: absolute;
  z-index: 0;
  width: 34em;
  height: 34em;
  right: -13em;
  top: -16em;
  border-radius: 50%;
  background: rgba(255,255,255,.72);
  pointer-events: none;
}
@keyframes htu-drift { to { transform: translate3d(3.6em, 3.6em, 0); } }
@keyframes htu-blink { 50% { opacity: 0; } }
@keyframes htu-spin { to { transform: rotate(360deg); } }

.htu-cap {
  position: absolute;
  z-index: 2;
  left: 4em;
  right: 4em;
  top: 2.2em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2em;
}
.htu-badge { font-size: 1.12em; font-weight: 800; letter-spacing: .16em; color: #1d4ed8; }
.htu-step { font-size: 1.2em; font-family: var(--font-mono, monospace); color: #475569; white-space: nowrap; }

.htu-scene {
  position: absolute;
  z-index: 2;
  left: 4em;
  right: 4em;
  top: 7em;
  bottom: 3em;
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 2em;
}

.htu-reg {
  display: flex;
  flex-direction: column;
  border: 1px solid #dbe5f5;
  border-radius: .8em;
  background: #fff;
  box-shadow: 0 1em 2.6em rgba(15,23,42,.12);
  overflow: hidden;
}
.htu-reg-bar {
  height: 3.4em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .55em;
  padding: 0 1.1em;
  background: #f1f5fb;
  border-bottom: 1px solid #e2e8f0;
}
.htu-reg-bar i { width: .62em; height: .62em; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }
.htu-reg-url { font-size: 1.12em; font-family: var(--font-mono, monospace); color: #64748b; }
.htu-reg-body { flex: 1; min-height: 0; padding: 1.6em; display: flex; }
.htu-reg-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.1em;
  padding: 1.5em;
  border: 1px solid #e2e8f0;
  border-radius: .5em;
  background: #fff;
}
.htu-reg-line { display: flex; align-items: baseline; justify-content: space-between; gap: 1em; }
.htu-reg-name { font-size: 1.55em; font-weight: 700; color: #0f172a; }
.htu-reg-ver { font-size: 1.05em; font-family: var(--font-mono, monospace); color: #94a3b8; }
.htu-reg-desc { font-size: 1.12em; color: #64748b; }
.htu-reg-mini {
  height: 2.5em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 0 .7em;
  border: 1px solid #eef2f8;
  border-radius: .3em;
  opacity: 0;
}
.htu-reg-mini > span:first-child { font-size: 1.12em; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htu-reg-mini > span:last-child { font-size: 1em; font-family: var(--font-mono, monospace); color: #94a3b8; }
.htu-code-box {
  margin-top: auto;
  height: 3.2em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 .8em;
  border: 1px solid #e2e8f0;
  border-radius: .35em;
  background: #f8fafc;
}
.htu-code-box.is-on { border-color: #2563eb; background: #eff6ff; }
.htu-code {
  font-size: 1.06em;
  font-family: var(--font-mono, monospace);
  color: #1d4ed8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.htu-reg-note { font-size: 1.02em; color: #94a3b8; }
.htu-copy-wrap {
  height: 3.1em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2563eb;
  border-radius: .35em;
  background: #eff6ff;
}
.htu-copy-wrap.is-hit { background: #2563eb; }
.htu-copy-txt { font-size: 1.22em; font-weight: 600; color: #1d4ed8; }
.htu-copy-wrap.is-hit .htu-copy-txt { color: #fff; }

.htu-app {
  display: flex;
  flex-direction: column;
  border-radius: .8em;
  overflow: hidden;
  background: #121214;
  box-shadow: 0 1em 2.6em rgba(15,23,42,.3);
}
.htu-bar {
  height: 3.4em;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: .2em;
  padding: 0 .7em;
  background: #000;
}
.htu-tab { display: flex; align-items: center; padding: 0 .9em; border-radius: .25em .25em 0 0; }
.htu-tab > span { font-size: 1.1em; color: #888; white-space: nowrap; }
.htu-tab.is-on { background: #121214; box-shadow: inset 0 -.18em 0 0 #08c; }
.htu-tab.is-on > span { color: #ddd; font-weight: 700; }
.htu-newtab {
  display: flex;
  align-items: center;
  gap: .45em;
  padding: 0 .9em;
  border-radius: .25em .25em 0 0;
  background: #121214;
  opacity: 0;
}
.htu-newtab i { width: .45em; height: .45em; border-radius: 50%; background: #06d6a0; flex-shrink: 0; }
.htu-newtab > span { font-size: 1.08em; color: #ddd; white-space: nowrap; }
.htu-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1.5fr; }
.htu-list {
  padding: 1.2em .9em;
  display: flex;
  flex-direction: column;
  gap: .55em;
  overflow: hidden;
  background: #17171b;
  border-right: 1px solid #2e3338;
}
.htu-list-head { font-size: 1.02em; letter-spacing: .06em; text-transform: uppercase; color: #888; }
.htu-wrow {
  height: 2.5em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .5em;
  padding: 0 .7em;
  border-radius: .3em;
}
.htu-wrow > span { font-size: 1.16em; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htu-wrow.is-new { background: #08c; opacity: 0; }
.htu-wrow.is-new i { width: .35em; height: .35em; border-radius: 50%; background: #fff; flex-shrink: 0; }
.htu-wrow.is-new > span { color: #fff; font-weight: 600; }
.htu-panel {
  position: relative;
  padding: 1.4em;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1em;
  overflow: hidden;
}
.htu-panel-title { font-size: 1.42em; font-weight: 700; color: #ddd; }
.htu-input-box {
  height: 3.1em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .25em;
  padding: 0 .8em;
  border: 1px solid #2e3338;
  border-radius: .3em;
  background: #101014;
}
.htu-input-box.is-on { border-color: #08c; }
.htu-typed {
  flex: 1;
  min-width: 0;
  font-size: 1.06em;
  font-family: var(--font-mono, monospace);
  color: #cfd4da;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.htu-caret { width: .12em; height: 1.3em; flex-shrink: 0; background: #08c; animation: htu-blink .8s steps(1) infinite; }
.htu-verify-wrap {
  height: 3em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .6em;
  border-radius: .3em;
  background: #08c;
}
.htu-verify-wrap.is-hot { background: #0a9ad9; }
.htu-verify-txt { font-size: 1.2em; font-weight: 600; color: #fff; white-space: nowrap; }
.htu-spin { width: .85em; height: .85em; border: .16em solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; opacity: 0; }
.htu-verify-wrap.is-busy .htu-spin { opacity: 1; animation: htu-spin .7s linear infinite; }
.htu-checks { display: flex; flex-direction: column; gap: .5em; }
.htu-check { height: 2.1em; flex-shrink: 0; display: flex; align-items: center; gap: .6em; opacity: 0; }
.htu-check b { font-size: 1.14em; color: #06d6a0; }
.htu-check span { font-size: 1.1em; font-family: var(--font-mono, monospace); color: #9aa4b2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htu-done {
  height: 2.6em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .6em;
  padding: 0 .8em;
  border: 1px solid rgba(6,214,160,.5);
  border-radius: .3em;
  opacity: 0;
}
.htu-done i { width: .45em; height: .45em; border-radius: 50%; background: #06d6a0; flex-shrink: 0; }
.htu-done span { font-size: 1.1em; color: #06d6a0; }
.htu-status {
  height: 2.8em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: .6em;
  padding: 0 1em;
  background: #0c0c0f;
  border-top: 1px solid #000;
}
.htu-status i { width: .45em; height: .45em; border-radius: 50%; background: #06d6a0; flex-shrink: 0; animation: htu-blink 1.4s ease-in-out infinite; }
.htu-status span { font-size: 1.08em; font-family: var(--font-mono, monospace); color: #9aa4b2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.htu-ptr {
  position: absolute;
  z-index: 5;
  width: 2em;
  height: 2em;
  margin: -.2em 0 0 -.35em;
  opacity: 0;
  pointer-events: none;
  filter: drop-shadow(0 .12em .25em rgba(15,23,42,.45));
}
.htu-ripple {
  position: absolute;
  z-index: 4;
  width: 3.4em;
  height: 3.4em;
  border-radius: 50%;
  border: .16em solid rgba(8,136,204,.75);
  opacity: 0;
  pointer-events: none;
}
`

function injectStyle () {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

function clamp (v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function seg (t, from, to) {
  return clamp((t - from) / (to - from), 0, 1)
}

function easeOut (p) {
  return 1 - Math.pow(1 - p, 3)
}

function easeInOut (p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}

function esc (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function setOp (node, v) {
  if (node) node.style.opacity = v.toFixed(3)
}

function pointerSvg () {
  return '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">' +
    '<path d="M4 2.5 20.2 11.4 12.7 12.9 9.4 20.6 4 2.5Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/>' +
    '</svg>'
}

function markup () {
  const minis = [
    ['Passbolt Search', 'v0.1.0'],
    ['Docker Cockpit', 'v1.0.0']
  ].map((row) =>
    '<div class="htu-reg-mini"><span>' + esc(row[0]) + '</span><span>' + esc(row[1]) + '</span></div>'
  ).join('')
  const checks = ['package.json', 'main.js', 'sha256 · every file'].map((text) =>
    '<div class="htu-check"><b>✓</b><span>' + esc(text) + '</span></div>'
  ).join('')

  return (
    '<div class="htu-cap" data-cap>' +
      '<span class="htu-badge">HOW TO USE</span>' +
      '<span class="htu-step" data-step></span>' +
    '</div>' +
    '<div class="htu-scene" data-scene>' +
      '<div class="htu-reg" data-reg>' +
        '<div class="htu-reg-bar"><i></i><i></i><i></i><span class="htu-reg-url">widgets.electerm.org</span></div>' +
        '<div class="htu-reg-body">' +
          '<div class="htu-reg-card" data-card>' +
            '<div class="htu-reg-line"><span class="htu-reg-name">Local TFTP Server</span><span class="htu-reg-ver">v1.0.0</span></div>' +
            '<div class="htu-reg-desc">Serve a folder over TFTP for routers, switches and PXE boot.</div>' +
            minis +
            '<div class="htu-reg-note">3 widgets indexed · sha256 per file</div>' +
            '<div class="htu-code-box" data-code-box><span class="htu-code">' + esc(INSTALL) + '</span></div>' +
            '<div class="htu-copy-wrap" data-copy><span class="htu-copy-txt" data-copy-txt>Copy install</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="htu-app" data-app>' +
        '<div class="htu-bar">' +
          '<span class="htu-tab"><span>Bookmarks</span></span>' +
          '<span class="htu-tab"><span>Setting</span></span>' +
          '<span class="htu-tab is-on"><span>Widgets → Online</span></span>' +
          '<span class="htu-newtab" data-newtab><i></i><span>Local TFTP Server</span></span>' +
        '</div>' +
        '<div class="htu-body">' +
          '<div class="htu-list">' +
            '<div class="htu-list-head">Installed widgets</div>' +
            '<div class="htu-wrow"><span>Passbolt Search</span></div>' +
            '<div class="htu-wrow"><span>Docker Cockpit</span></div>' +
            '<div class="htu-wrow is-new" data-newrow><i></i><span>Local TFTP Server</span></div>' +
          '</div>' +
          '<div class="htu-panel">' +
            '<div class="htu-panel-title">Import from registry</div>' +
            '<div class="htu-input-box" data-input><span class="htu-typed" data-typed></span><span class="htu-caret"></span></div>' +
            '<div class="htu-verify-wrap" data-verify><span class="htu-spin"></span><span class="htu-verify-txt" data-verify-txt>Verify &amp; install</span></div>' +
            '<div class="htu-checks">' + checks + '</div>' +
            '<div class="htu-done" data-done><i></i><span>Installed · commit pinned</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="htu-status"><i></i><span data-status></span></div>' +
      '</div>' +
    '</div>' +
    '<div class="htu-ptr" data-ptr>' + pointerSvg() + '</div>' +
    '<div class="htu-ripple" data-ripple></div>'
  )
}

function mount (host) {
  if (host.getAttribute('data-htu-mounted')) return
  host.setAttribute('data-htu-mounted', '1')

  const root = document.createElement('div')
  root.className = 'htu'
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label',
    'How to use electerm widgets: copy the pinned install string from the registry, paste it into Widgets Online in the desktop app, then verify package.json, main.js and every file sha256 before the widget is installed')
  root.innerHTML = markup()
  host.appendChild(root)

  const q = (sel) => root.querySelector(sel)
  const el = {
    cap: q('[data-cap]'),
    scene: q('[data-scene]'),
    reg: q('[data-reg]'),
    app: q('[data-app]'),
    card: q('[data-card]'),
    minis: Array.prototype.slice.call(root.querySelectorAll('.htu-reg-mini')),
    codeBox: q('[data-code-box]'),
    copyBox: q('[data-copy]'),
    copyTxt: q('[data-copy-txt]'),
    input: q('[data-input]'),
    typed: q('[data-typed]'),
    verifyBox: q('[data-verify]'),
    verifyTxt: q('[data-verify-txt]'),
    checks: Array.prototype.slice.call(root.querySelectorAll('.htu-check')),
    done: q('[data-done]'),
    newRow: q('[data-newrow]'),
    newTab: q('[data-newtab]'),
    step: q('[data-step]'),
    status: q('[data-status]'),
    ptr: q('[data-ptr]'),
    ripple: q('[data-ripple]')
  }

  // 1em = 1% of the banner width: every size above is in em.
  const fit = () => {
    const w = root.clientWidth
    if (w) root.style.fontSize = (w / 100) + 'px'
  }
  fit()

  const targets = { copy: [0, 0], input: [0, 0], verify: [0, 0] }
  const measure = () => {
    fit()
    const unit = root.clientWidth / 100
    if (!unit) return
    const base = root.getBoundingClientRect()
    const at = (node) => {
      if (!node) return null
      const r = node.getBoundingClientRect()
      return [(r.left - base.left + r.width / 2) / unit, (r.top - base.top + r.height / 2) / unit]
    }
    targets.copy = at(el.copyBox) || targets.copy
    targets.input = at(el.input) || targets.input
    targets.verify = at(el.verifyBox) || targets.verify
  }
  measure()
  if (window.ResizeObserver) {
    new window.ResizeObserver(measure).observe(root)
  } else {
    window.addEventListener('resize', measure)
  }

  let stepIndex = -1
  const setStep = (index) => {
    if (index === stepIndex) return
    stepIndex = index
    el.step.textContent = STEPS[index].label
    el.status.textContent = STEPS[index].status
  }

  function frame (t) {
    const gone = 1 - easeInOut(seg(t, T.fadeFrom, T.fadeTo))
    setOp(el.cap, gone)
    setOp(el.scene, gone)

    // two panes slide up, then the registry card and its rows stagger in
    const regP = easeOut(seg(t, T.regFrom, T.regTo))
    setOp(el.reg, regP)
    el.reg.style.transform = 'translateY(' + ((1 - regP) * 1.4).toFixed(3) + 'em)'
    const appP = easeOut(seg(t, T.appFrom, T.appTo))
    setOp(el.app, appP)
    el.app.style.transform = 'translateY(' + ((1 - appP) * 1.4).toFixed(3) + 'em)'
    setOp(el.card, easeOut(seg(t, T.cardFrom, T.cardTo)))
    el.minis.forEach((node, i) => {
      const from = T.miniFrom + i * T.miniGap
      setOp(node, easeOut(seg(t, from, from + 320)))
    })

    // beat 1: click Copy install
    el.copyBox.classList.toggle('is-hit', t >= T.copyClick && t < T.ptrInputFrom)
    el.codeBox.classList.toggle('is-on', t >= T.copyClick)
    el.copyTxt.textContent = t >= T.copyClick ? 'Copied ✓' : 'Copy install'

    // beat 2: the string is typed into Widgets → Online
    const typedP = seg(t, T.typeFrom, T.typeTo)
    el.typed.textContent = INSTALL.slice(0, Math.round(typedP * INSTALL.length))
    el.input.classList.toggle('is-on', t >= T.ptrInputFrom)

    // beat 3: verify, then the file checks and the installed widget land
    el.verifyBox.classList.toggle('is-hot', t >= T.ptrVerifyFrom && t < T.verifyClick)
    el.verifyBox.classList.toggle('is-busy', t >= T.verifyClick && t < T.doneFrom)
    el.verifyTxt.textContent = t >= T.doneFrom ? 'Verified & installed' : 'Verify & install'
    el.checks.forEach((node, i) => {
      const from = T.checkFrom + i * T.checkGap
      setOp(node, easeOut(seg(t, from, from + 320)))
    })
    setOp(el.done, easeOut(seg(t, T.doneFrom, T.doneTo)))
    const rowP = easeOut(seg(t, T.rowFrom, T.rowTo))
    setOp(el.newRow, rowP)
    el.newRow.style.transform = 'translateY(' + ((1 - rowP) * 0.35).toFixed(3) + 'em)'
    setOp(el.newTab, easeOut(seg(t, T.tabFrom, T.tabTo)))

    // status line: the story in the site's own words
    let idx = 0
    for (let i = 0; i < STEPS.length; i++) {
      if (t >= STEPS[i].at) idx = i
    }
    setStep(idx)

    // pointer: copy -> input -> verify, then out
    const path = [
      { from: T.ptrCopyFrom, to: T.ptrCopyTo, a: targets.copy, b: targets.copy },
      { from: T.ptrCopyTo, to: T.ptrInputFrom, a: targets.copy, b: targets.input },
      { from: T.ptrInputFrom, to: T.ptrInputTo, a: targets.input, b: targets.input },
      { from: T.ptrInputTo, to: T.ptrVerifyFrom, a: targets.input, b: targets.verify },
      { from: T.ptrVerifyFrom, to: T.ptrVerifyTo, a: targets.verify, b: targets.verify }
    ]
    let px = targets.copy[0]
    let py = targets.copy[1]
    for (const step of path) {
      if (t >= step.to) {
        px = step.b[0]
        py = step.b[1]
        continue
      }
      if (t >= step.from) {
        const p = easeInOut(seg(t, step.from, step.to))
        px = step.a[0] + (step.b[0] - step.a[0]) * p
        py = step.a[1] + (step.b[1] - step.a[1]) * p
      }
      break
    }
    const ptrIn = seg(t, T.ptrCopyFrom, T.ptrCopyFrom + 240)
    const ptrOut = easeInOut(seg(t, T.ptrOutFrom, T.ptrOutTo))
    el.ptr.style.left = px.toFixed(2) + 'em'
    el.ptr.style.top = py.toFixed(2) + 'em'
    setOp(el.ptr, ptrIn * (1 - ptrOut) * gone)

    // ripples on the three clicks
    const clicks = [
      { at: T.copyClick, p: targets.copy },
      { at: T.typeFrom, p: targets.input },
      { at: T.verifyClick, p: targets.verify }
    ]
    let rip = null
    for (const c of clicks) {
      if (t >= c.at && t < c.at + 460) {
        rip = c
        break
      }
    }
    if (rip) {
      const p = seg(t, rip.at, rip.at + 460)
      setOp(el.ripple, (1 - p) * gone)
      el.ripple.style.left = rip.p[0].toFixed(2) + 'em'
      el.ripple.style.top = rip.p[1].toFixed(2) + 'em'
      el.ripple.style.transform = 'translate(-50%, -50%) scale(' + (0.35 + p * 1.9).toFixed(3) + ')'
    } else {
      setOp(el.ripple, 0)
    }
  }

  const reduce = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduce) {
    // One representative frame: installed, checks up, new tab open, no loop.
    frame(T.doneFrom + 700)
    setOp(el.ptr, 0)
    setOp(el.ripple, 0)
    return
  }

  const state = { raf: null }
  const start = performance.now()
  const tick = (now) => {
    frame((now - start) % PERIOD)
    state.raf = window.requestAnimationFrame(tick)
  }
  const play = () => {
    if (state.raf === null) state.raf = window.requestAnimationFrame(tick)
  }
  const pause = () => {
    if (state.raf !== null) {
      window.cancelAnimationFrame(state.raf)
      state.raf = null
    }
  }

  if (window.IntersectionObserver) {
    new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) play()
      else pause()
    }, { threshold: 0 }).observe(root)
  } else {
    play()
  }
}

export function initHowTo (doc = document) {
  injectStyle()
  for (const host of doc.querySelectorAll('[data-how-banner]')) {
    mount(host)
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initHowTo())
  } else {
    initHowTo()
  }
}
