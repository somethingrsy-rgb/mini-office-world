// 루비와 크리스탈의 움직임(둘 다 같은 규칙). 화면(모든 모니터)과 열려 있는 창들 위를 돌아다녀요.
//  · 바닥(작업표시줄 위)을 걷고, 쉬고, 가끔 열려 있는 창의 윗부분으로 폴짝 올라가 앉아요 (창을 옮기면 따라가요)
//  · 마우스를 코앞에서 흔들면 앞발로 잡으려 하고, 재빨리 빼면 헛짚어요
//  · 드래그해서 원하는 곳(다른 모니터 포함)에 둘 수 있어요  · 고양이 모양이 있는 곳만 클릭돼요(나머지는 뒤 창으로 통과)
//  · 정각 알림, 타이머, 사용자 알람 (울리면 계속 뛰어다녀요)
let dims = null, size = 1, baseSize = 1   // size: 지금 쓰는 크기 (집중 모드에서는 baseSize의 0.6배)
let conf = { hourly: true, sound: true, hours: 'all', alarms: [], ruby: true, crystal: true, focus: false, perch: true }
const bridge = window.api || { ignore() {}, config: async () => ({ size: 1 }), layout: async () => null, onConfig() {}, onLayout() {}, onWindows() {}, onCursor() {}, onPlay() {} }
const SCALE = 0.8          // 그림 1px이 화면에서 차지하는 크기 (보통 크기일 때 고양이 키 ≈ 100px)
const rnd = (a) => a[Math.floor(Math.random() * a.length)]

let layout = { w: innerWidth, h: innerHeight, displays: [{ x: 0, y: 0, w: innerWidth, h: innerHeight, floor: innerHeight - 2 }] }
let wins = []          // 열려 있는 창들의 윗면: { id, x1, x2, y }
const mouse = { x: -999, y: -999, down: false }
const cats = []        // 고양이들 (루비, 크리스탈)
let drag = null        // { cat, sx, sy, moved }
let hover = false

const dispAt = (x) => { let best = 0, bd = 1e9; layout.displays.forEach((d, i) => { const dx = x < d.x ? d.x - x : x > d.x + d.w ? x - (d.x + d.w) : 0; if (dx < bd) { bd = dx; best = i } }); return best }
const winById = (id) => wins.find((w) => w.id === id)
const surfY = (sf) => (sf.t === 'win' ? (winById(sf.id) || {}).y : layout.displays[Math.min(sf.d, layout.displays.length - 1)].floor)
function surfRange(sf, w) {
  const m = w * 0.5 + 6
  if (sf.t === 'win') { const o = winById(sf.id); return o ? [o.x1 + m, o.x2 - m] : [0, 0] }
  const d = layout.displays[Math.min(sf.d, layout.displays.length - 1)]; return [d.x + m, d.x + d.w - m]
}

// ── 프레임마다 미리 만들어 둔 작은 모양 지도(dims.js의 mask)로 판단해요: 투명한 곳은 클릭이 통과 ──
const maskCache = {}
function maskOf(key) {
  if (maskCache[key]) return maskCache[key]
  const [cols, rows, hex, n] = dims.mask[key]
  const bits = BigInt('0x' + hex).toString(2).padStart(n, '0')
  return (maskCache[key] = { cols, rows, bits })
}

// ═══ 고양이 한 마리: pre('' 루비 / 'wh_' 크리스탈)의 그림을 쓰고, 상태는 각자 따로 가져요 ═══
function makeCat(pre, name, x0) {
  const el = document.createElement('div'); el.className = 'cat'
  const img = document.createElement('img'); img.alt = ''; el.appendChild(img); document.body.appendChild(el)
  const st = { x: x0, y: 0, surf: { t: 'floor', d: 0 }, dir: 1, mode: 'stand', until: 0, cool: 0, box: null }
  const n = (g) => dims.count[pre + g]
  const STAND = pre === 'wh_' ? 'wh_stand0' : 'up0'
  const widthRef = () => dims.dim[pre + 'walkR0'].w * SCALE * size

  // ── 다음 행동 고르기 ──
  function pick(now) {
    if (conf.focus) { st.mode = rnd(['sit', 'sit', 'sleep']); st.until = now + 4000; return }   // 집중 모드: 구석에서 가만히 쉬어요
    const onWin = st.surf.t === 'win'
    const cands = conf.perch === false ? [] : wins.filter((w) => w.y > 140 && w.y < layout.displays[dispAt(st.x)].floor - 100 && w.x2 - w.x1 > 240 && !(onWin && w.id === st.surf.id))
    const r = Math.random()
    if (onWin && !winById(st.surf.id)) return fall(now)
    if (onWin && r < 0.3) return fall(now, true)                                  // 창 위에서 한참 있다가 바닥으로 내려와요
    if (!onWin && cands.length && r < 0.2) {                                      // 창 위로 폴짝
      const w = rnd(cands); const tx = w.x1 + 70 + Math.random() * Math.max(10, w.x2 - w.x1 - 140)
      return leapTo({ t: 'win', id: w.id }, tx, now)
    }
    if (r < 0.7) { st.mode = 'walk'; st.dir = Math.random() < 0.5 ? -1 : 1; st.until = now + 5000 + Math.random() * 9000 }
    else if (r < 0.78 && !onWin) { st.mode = 'jump'; st.jumpT = now; st.until = now + 1500 }
    else { st.mode = rnd(['sit', 'sit', 'sleep', 'groom', 'stand']); st.until = now + (onWin ? 20000 + Math.random() * 20000 : 10000) }
  }

  // ── 점프로 옮겨 가기 (창 위로 올라가기, 바닥으로 내려오기, 드래그 후 떨어지기) ──
  function leapTo(sf, tx, now) {
    const [lo, hi] = surfRange(sf, widthRef())
    const x1 = Math.min(Math.max(tx, lo), Math.max(lo, hi)), y1 = surfY(sf)
    if (y1 === undefined) return
    Object.assign(st, { mode: 'leap', leapT: now, x0: st.x, y0: st.y, x1, y1, target: sf, dur: 1100 + Math.min(900, Math.hypot(x1 - st.x, y1 - st.y) * 1.2), until: 1e15 })
    st.dir = x1 >= st.x ? 1 : -1
  }
  function fall(now, nice) {
    const d = dispAt(st.x)
    const [lo, hi] = surfRange({ t: 'floor', d }, widthRef())
    leapTo({ t: 'floor', d }, Math.min(Math.max(st.x + (nice ? (Math.random() < 0.5 ? -90 : 90) : 0), lo), hi), now)
  }

  function frameFor(now) {
    switch (st.mode) {
      case 'run': return st.dir > 0 ? `${pre}walkR${Math.floor(now / 80) % n('walkR')}` : `${pre}walkL${Math.floor(now / 80) % n('walkL')}`
      case 'goto': return st.dir > 0 ? `${pre}walkR${Math.floor(now / 110) % n('walkR')}` : `${pre}walkL${Math.floor(now / 110) % n('walkL')}`
      case 'walk': return st.dir > 0 ? `${pre}walkR${Math.floor(now / 150) % n('walkR')}` : `${pre}walkL${Math.floor(now / 150) % n('walkL')}`
      case 'jump': return `${pre}up${Math.min(n('up') - 1, Math.floor((now - st.jumpT) / 120))}`
      case 'leap': { const g = st.y1 < st.y0 - 20 ? 'up' : 'down'; return `${pre}${g}${Math.min(n(g) - 1, Math.floor(((now - st.leapT) / st.dur) * n(g)))}` }
      case 'pounce': return `${pre}pounce${Math.min(n('pounce') - 1, Math.floor((now - st.pounceT) / 110))}`
      case 'aegyo': case 'drag': return `${pre}aegyo0`
      case 'miss': case 'sit': return `${pre}sit0`
      case 'sleep': return `${pre}sleep0`
      case 'groom': return `${pre}groom0`
      default: return STAND
    }
  }

  function update(now, dt) {
    if (st.frozen) { if (st.ov) drawOv(st.ov); return }
    if (el.style.display === 'none') return
    const k0 = frameFor(now), d0 = dims.dim[k0], W0 = d0.w * SCALE * size, H0 = d0.h * SCALE * size

    // 창 위에 있는데 그 창이 사라졌으면 바닥으로 내려와요 · 창을 옮기면 따라가요
    if (st.surf.t === 'win' && !['leap', 'drag'].includes(st.mode)) {
      const o = winById(st.surf.id)
      if (!o || conf.perch === false) fall(now)   // 창이 사라졌거나 '창 위에 올라가기'를 껐으면 바닥으로 내려와요
      else { st.y = o.y; if (st.x < o.x1 + 10 || st.x > o.x2 - 10) st.x = Math.min(Math.max(st.x, o.x1 + 30), o.x2 - 30) }
    } else if (st.surf.t === 'floor' && !['leap', 'drag'].includes(st.mode)) st.y = surfY(st.surf)

    // 마우스가 코앞에서 흔들리면 앞발로 잡으려 해요
    const interactive = !conf.focus && !['pounce', 'aegyo', 'jump', 'run', 'leap', 'drag', 'miss', 'goto'].includes(st.mode)
    if (interactive && now > st.cool && !hover && Math.abs(mouse.x - st.x) < 240 * size && mouse.y > st.y - H0 - 100 && mouse.y < st.y + 70) {
      Object.assign(st, { mode: 'pounce', pounceT: now, until: now + 1400, pounceDir: mouse.x < st.x ? -1 : 1, cool: now + 1400 + 6000, mx0: mouse.x, my0: mouse.y })
    }
    if (st.mode === 'pounce' && now - st.pounceT > 500 && Math.hypot(mouse.x - st.mx0, mouse.y - st.my0) > 160 * size) {   // 재빨리 빼면 헛짚고 고개를 갸웃해요
      Object.assign(st, { mode: 'miss', missT: now, until: now + 1800 }); if (cats[0] === self) say('?', 1800)
    }
    if (st.mode === 'leap') {
      const p = Math.min(1, (now - st.leapT) / st.dur)
      const ty = surfY(st.target); if (ty !== undefined) st.y1 = ty
      st.x = st.x0 + (st.x1 - st.x0) * p
      st.y = st.y0 + (st.y1 - st.y0) * p - Math.sin(p * Math.PI) * Math.max(50, Math.abs(st.y1 - st.y0) * 0.25) * size
      if (p >= 1) { st.surf = st.target; st.y = st.y1; st.mode = 'sit'; st.until = now + (st.surf.t === 'win' ? 15000 + Math.random() * 15000 : 6000) }
    } else if (st.mode === 'drag') {
      st.x = mouse.x; st.y = mouse.y + H0 * 0.55
    } else if (now > st.until) {
      if (st.after) { st.mode = st.after.mode; st.until = st.after.until; st.after = null } else pick(now)
    }

    if (st.mode === 'goto') {   // 정한 자리까지 걸어가요 (고양이 불러서 놀게 하기·집중 모드 구석으로 가기)
      const d = st.gx - st.x, step = (st.gFast ? 1.2 : 0.5) * W0 * dt
      st.dir = d >= 0 ? 1 : -1
      if (Math.abs(d) <= step) { st.x = st.gx; st.mode = 'stand'; st.until = now + (st.gUntil || 1500) } else st.x += st.dir * step
    }
    if (st.mode === 'walk' || st.mode === 'run') {
      const speed = (st.mode === 'run' ? 1.5 : 0.3) * W0
      st.x += st.dir * speed * dt
      const [lo, hi] = surfRange(st.surf, W0)
      if (st.x < lo) { st.x = lo; st.dir = 1 } else if (st.x > hi) { st.x = hi; st.dir = -1 }   // 바닥·창 끝에서는 돌아서 걸어요
    }

    const key = frameFor(now), dd = dims.dim[key], w = dd.w * SCALE * size, h = dd.h * SCALE * size
    let lift = 0
    if (st.mode === 'run') lift = Math.abs(Math.sin((now - st.runT) / 230)) * 55 * size
    if (st.mode === 'jump') lift = Math.sin(Math.min(1, (now - st.jumpT) / 1500) * Math.PI) * 70 * size
    const flip = st.mode === 'pounce' ? st.pounceDir < 0 : ['walk', 'run', 'goto'].includes(st.mode) ? false : st.dir < 0
    const tilt = st.mode === 'miss' ? -8 : st.mode === 'drag' ? Math.sin(now / 120) * 5 : 0
    if (img.dataset.k !== key) { img.src = `frames/${key}.webp`; img.dataset.k = key }
    img.style.width = w + 'px'; img.style.height = h + 'px'
    img.style.transform = `${flip ? 'scaleX(-1)' : ''} rotate(${tilt}deg)`; img.style.transformOrigin = '50% 90%'
    const ty = st.y - h - lift
    el.style.transform = `translate(${Math.round(st.x - w / 2)}px, ${Math.round(ty)}px)`
    st.box = { x: st.x - w / 2, y: ty, w, h, key, flip }
  }

  function overCat(x, y) {
    const b = st.box
    if (el.style.display === 'none' || !b || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false
    const m = maskOf(b.key)
    let cx = Math.floor(((x - b.x) / b.w) * m.cols); const cy = Math.floor(((y - b.y) / b.h) * m.rows)
    if (b.flip) cx = m.cols - 1 - cx
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {   // 주변 한 칸까지 봐서 털 가장자리도 잡혀요
      const X = cx + dx, Y = cy + dy
      if (X >= 0 && X < m.cols && Y >= 0 && Y < m.rows && m.bits[Y * m.cols + X] === '1') return true
    }
    return false
  }

  // 놓은 자리 바로 아래에 있는 면(창 윗부분 또는 모니터 바닥)에 떨어져요
  function drop() {
    const now = performance.now()
    const d = dispAt(st.x)
    let best = { t: 'floor', d }, by = layout.displays[d].floor
    for (const w of wins) if (st.x > w.x1 + 10 && st.x < w.x2 - 10 && w.y >= st.y - 20 && w.y < by) { best = { t: 'win', id: w.id }; by = w.y }
    st.surf = { t: 'floor', d }
    leapTo(best, st.x, now)
    st.until = 1e15
  }

  function pet() {
    const now = performance.now()
    calmAll()
    Object.assign(st, { mode: 'aegyo', aegyoT: now, until: now + 4500, cool: now + 6500 })
    const b = st.box
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('div'); h.className = 'heart'; h.textContent = '♥'; h.style.color = '#ff6fa5'
      h.style.left = (b.x + b.w / 2 + (i - 1) * 26 - 10) + 'px'; h.style.top = (b.y - 10) + 'px'; h.style.animationDelay = (i * 0.15) + 's'
      document.body.appendChild(h); setTimeout(() => h.remove(), 1800)
    }
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = name
    nm.style.left = (b.x + b.w / 2) + 'px'; nm.style.top = (b.y - 36) + 'px'; document.body.appendChild(nm); setTimeout(() => nm.remove(), 3300)
  }

  // 지정한 모니터 바닥의 x 자리로 걸어가요 (창 위에 있으면 바닥으로 내려와요)
  function goTo(x, d, hold, fast) {
    if (st.mode === 'drag' || st.mode === 'leap') return
    if (st.surf.t !== 'floor' || st.surf.d !== d) {
      if (dispAt(st.x) !== d) st.x = layout.displays[d].x + layout.displays[d].w * (st.x < layout.displays[d].x ? 0.1 : 0.9)
      st.surf = { t: 'floor', d }; st.y = layout.displays[d].floor
    }
    Object.assign(st, { mode: 'goto', gx: x, gFast: !!fast, gUntil: hold || 1500, until: 1e15, after: null })
  }
  const toFloor = () => { if (st.surf.t === 'win') { const d = dispAt(st.x); st.surf = { t: 'floor', d }; st.y = layout.displays[d].floor } }
  function hop(delay = 0) {   // 정각 알림: 폴짝 한 번 → 앉아서 기다려요
    endScene(); const now = performance.now() + delay; toFloor()
    st.mode = 'jump'; st.jumpT = now; st.until = now + 1500
    st.after = { mode: 'sit', until: now + 1500 + 8000 }
  }
  function run() {   // 타이머·알람: 누를 때까지 뛰어다녀요
    endScene(); const now = performance.now(); toFloor()
    st.mode = 'run'; st.runT = now; st.dir = Math.random() < 0.5 ? -1 : 1; st.until = now + 180000; st.after = null
  }
  function calm() { if (st.mode === 'run') { st.mode = 'stand'; st.until = performance.now() } }
  let hid = false
  const setHidden = (h) => { hid = h; el.style.display = h ? 'none' : ''; if (h) st.box = null }
  const setFrozen = (f) => { st.frozen = f; if (!f) st.ov = null; st.box = null }
  // 장난치는 동안은 장면이 정해 준 자리·그림으로 그려요
  function drawOv(o) {
    const d = dims.dim[o.key]; if (!d) return
    const w = d.w * SCALE * size, h = d.h * SCALE * size
    if (img.dataset.k !== o.key) { img.src = `frames/${o.key}.webp`; img.dataset.k = o.key }
    img.style.width = w + 'px'; img.style.height = h + 'px'
    img.style.transform = o.flip ? 'scaleX(-1)' : ''; img.style.transformOrigin = '50% 90%'
    el.style.transform = `translate(${Math.round(o.x - w / 2)}px, ${Math.round(st.y - h)}px)`
    st.box = null
  }

  const self = { st, el, update, overCat, drop, pet, hop, run, calm, setHidden, setFrozen, goTo, comeDown: () => { if (st.surf.t === 'win' && st.mode !== 'drag' && st.mode !== 'leap') fall(performance.now()) }, name }
  return self
}
const calmAll = () => { clearInterval(ringTimer); if (bubbleEl && cats.some((c) => c.st.mode === 'run')) { bubbleEl.remove(); bubbleEl = null }; cats.forEach((c) => c.calm()) }

async function init() {
  dims = window.DIMS
  const c = await bridge.config(); baseSize = c.size || 1; conf = { ...conf, ...c }; size = baseSize * (conf.focus ? 0.6 : 1)
  const l = await bridge.layout(); if (l) layout = l
  const applyVis = () => { if (cats[0]) cats[0].setHidden(conf.ruby === false); if (cats[1]) cats[1].setHidden(conf.crystal === false) }
  bridge.onConfig((c) => {
    const wasFocus = !!conf.focus, wasPerch = conf.perch !== false
    baseSize = c.size || 1; conf = { ...conf, ...c }; size = baseSize * (conf.focus ? 0.6 : 1); applyVis()
    if (wasPerch && conf.perch === false) cats.forEach((k) => k.comeDown())   // 창 위에 올라가기를 끄면 창 위에 있던 고양이도 바닥으로 내려와요
    if (conf.focus && !wasFocus) enterFocus()
    else if (!conf.focus && wasFocus) cats.forEach((k) => { if (k.st.mode === 'goto') k.st.until = 0; k.st.until = performance.now() })
  })
  bridge.onPlay && bridge.onPlay(playNow)
  bridge.onLayout((l) => { layout = l })
  bridge.onWindows((w) => { wins = w })
  bridge.onTimer && bridge.onTimer(setTimer)
  await Promise.all(Object.keys(dims.dim).map((k) => new Promise((r) => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `frames/${k}.webp` })))
  const d = layout.displays[0]
  const ruby = makeCat('', '루비', d.x + d.w * (0.2 + Math.random() * 0.25))
  const crystal = makeCat('wh_', '크리스탈', d.x + d.w * (0.6 + Math.random() * 0.25))
  cats.push(ruby, crystal)
  for (const c of cats) { c.st.surf = { t: 'floor', d: 0 }; c.st.y = d.floor; c.st.mode = 'stand'; c.st.until = performance.now() + 1500 + Math.random() * 3000 }
  applyVis()
  last = performance.now(); requestAnimationFrame(loop)
}

// ═══ 집중 모드: 고양이가 작아져서 오른쪽 아래 구석에 앉아 가만히 있어요 (정각 알림은 소리 없이 말풍선만) ═══
function enterFocus() {
  endScene(); pendingPlay = null
  const d = layout.displays[0]
  cats.forEach((c, i) => c.goTo(d.x + d.w - (60 + i * 105) * size, 0, 4000, true))
}

// ═══ 고양이 불러서 놀게 하기: 마우스가 있는 모니터 바닥 가운데로 두 마리가 와서 장난쳐요 ═══
let pendingPlay = null
function playNow() {
  const [ruby, crystal] = cats
  if (!ruby || !crystal) return
  if (conf.focus) { say('집중 모드를 끄면 같이 놀 수 있어요', 4000); return }
  if (conf.ruby === false || conf.crystal === false) { say('두 고양이를 모두 보이게 하면 놀 수 있어요', 4000); return }
  endScene()
  const d = dispAt(mouse.x > -900 ? mouse.x : 0), disp = layout.displays[d], cx = disp.x + disp.w / 2
  const unit = dims.dim.walkR0.w * SCALE * size, half = 0.45 * unit
  const rubyLeft = ruby.st.x <= crystal.st.x
  ruby.goTo(cx + (rubyLeft ? -half : half), d, 60000); crystal.goTo(cx + (rubyLeft ? half : -half), d, 60000)
  pendingPlay = { t: performance.now(), d, cx }
}

// ═══ 두 마리가 걸어 다니다 우연히 마주치면 장난쳐요 (일부러 서로를 쫓아가지는 않아요) ═══
// 장면의 움직임은 play.js(buildScene)가 만들고, 고양이마다 자기 그림(sneak·sniff·bow·tap·roll·dash)으로 움직여요.
let scene = null, lastScene = performance.now() - 20000, cooldown = 55000 + Math.random() * 15000
const FREE = ['stand', 'sit', 'sleep', 'groom', 'walk']
function endScene() {
  if (!scene) return
  const sc = scene; scene = null
  const [ruby, crystal] = cats
  const fin = sc.plan.at(Math.min(performance.now() - sc.t0, sc.plan.dur - 1))
  const pos = { L: fin.L.x, R: fin.R.x }
  const lc = sc.leftIs === 'ruby' ? ruby : crystal, rc = sc.leftIs === 'ruby' ? crystal : ruby
  for (const [c, x, dir] of [[lc, pos.L, 1], [rc, pos.R, -1]]) {
    c.setFrozen(false)
    c.st.x = x; c.st.dir = dir; c.st.mode = 'sit'; c.st.until = performance.now() + 1000; c.st.cool = performance.now() + 3000   // 장난이 끝나고 1초만 멈춰 있어요
  }
  lastScene = performance.now(); cooldown = 55000 + Math.random() * 15000
}
function directScenes(now) {
  const [ruby, crystal] = cats
  if (!ruby || !crystal) return
  if (scene) {
    const el = now - scene.t0
    if (el >= scene.plan.dur || conf.ruby === false || conf.crystal === false) return endScene()
    const s = scene.plan.at(el)
    const rs = scene.leftIs === 'ruby' ? s.L : s.R, cs = scene.leftIs === 'ruby' ? s.R : s.L
    ruby.st.ov = { x: rs.x, key: playKey('', rs), flip: rs.flip }
    crystal.st.ov = { x: cs.x, key: playKey('wh_', cs), flip: cs.flip }
    return
  }
  if (conf.focus) return
  if (pendingPlay) {   // 불러서 온 경우: 둘 다 도착하면 바로, 25초가 지나도 못 오면 그 자리로 불러서 장난쳐요
    const pp = pendingPlay, a = ruby.st, b = crystal.st
    const arrived = a.mode !== 'goto' && b.mode !== 'goto'
    if (now - pp.t > 800 && (arrived || now - pp.t > 25000)) {
      pendingPlay = null
      const unit = dims.dim.walkR0.w * SCALE * size, disp = layout.displays[pp.d]
      for (const c of cats) { c.st.surf = { t: 'floor', d: pp.d }; c.st.y = disp.floor; if (arrived) continue; c.st.x = pp.cx }
      const [lo, hi] = surfRange(a.surf, unit * 1.2)
      const plan = buildScene(pickActions(), Math.min(a.x, b.x) - (arrived ? 0 : unit * 0.45), Math.max(a.x, b.x) + (arrived ? 0 : unit * 0.45), unit, lo, hi, 0.3 * unit)
      scene = { plan, t0: now, leftIs: a.x <= b.x ? 'ruby' : 'crystal' }
      ruby.setFrozen(true); crystal.setFrozen(true)
    }
    return
  }
  if (conf.ruby === false || conf.crystal === false || drag || now - lastScene < cooldown) return
  const a = ruby.st, b = crystal.st
  if (a.surf.t !== b.surf.t || (a.surf.t === 'floor' ? a.surf.d !== b.surf.d : a.surf.id !== b.surf.id)) return
  if (!FREE.includes(a.mode) || !FREE.includes(b.mode)) return
  const unit = dims.dim.walkR0.w * SCALE * size
  if (Math.abs(a.x - b.x) > 1.6 * unit) return
  const away = (c, o) => c.mode === 'walk' && Math.sign(c.dir) === Math.sign(c.x - o.x)   // 서로 등지고 걷는 중이면 마주친 게 아니에요
  if (away(a, b) || away(b, a)) return
  const [lo, hi] = surfRange(a.surf, unit * 1.2)
  const plan = buildScene(pickActions(), Math.min(a.x, b.x), Math.max(a.x, b.x), unit, lo, hi, 0.3 * unit)
  scene = { plan, t0: now, leftIs: a.x <= b.x ? 'ruby' : 'crystal' }
  b.y = a.y; ruby.setFrozen(true); crystal.setFrozen(true)
}

let last = 0
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  for (const c of cats) c.update(now, dt)
  directScenes(now)
  if (bubbleEl) {
    const b = cats[0] && cats[0].st.box
    if (now > bubbleUntil || !b) { bubbleEl.remove(); bubbleEl = null }
    else { bubbleEl.style.left = Math.round(Math.min(Math.max(b.x + b.w / 2, 140), layout.w - 140)) + 'px'; bubbleEl.style.top = Math.max(4, Math.round(b.y - bubbleEl.offsetHeight - 14)) + 'px' }
  }
  requestAnimationFrame(loop)
}

// ── 마우스: 고양이 모양(투명하지 않은 부분)에서만 받아요. 그 밖은 클릭이 뒤 창으로 통과 ──
const catAt = (x, y) => { for (let i = cats.length - 1; i >= 0; i--) if (cats[i].overCat(x, y)) return cats[i]; return null }
function handleMove(x, y) {
  mouse.x = x; mouse.y = y
  if (drag && !drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 7) { drag.moved = true; drag.cat.st.mode = 'drag'; calmAll() }
  const over = drag ? true : !!catAt(x, y)
  if (over !== hover) { hover = over; bridge.ignore(!over) }
}
document.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY))
bridge.onCursor && bridge.onCursor((c) => handleMove(c.x, c.y))   // 윈도우가 알려 주는 마우스 위치 (이벤트가 안 와도 동작)
document.addEventListener('mousedown', (e) => { const c = hover ? catAt(e.clientX, e.clientY) : null; if (c) drag = { cat: c, sx: e.clientX, sy: e.clientY, moved: false } })
document.addEventListener('mouseup', () => {
  if (!drag) return
  const was = drag; drag = null
  if (!was.moved) return was.cat.pet()
  was.cat.drop()
  if (!catAt(mouse.x, mouse.y)) { hover = false; bridge.ignore(true) }
})

// ── 알람: 정각 알림, 타이머, 사용자 알람. 정각은 폴짝 한 번, 타이머·알람은 고양이를 누를 때까지 둘이 뛰어다녀요 ──
let bubbleEl = null, bubbleUntil = 0, timerId = 0, ringTimer = 0
function say(text, ms = 8000) {
  if (bubbleEl) bubbleEl.remove()
  bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble'; bubbleEl.textContent = text
  document.body.appendChild(bubbleEl); bubbleUntil = performance.now() + ms
}
function chime() {
  if (!conf.sound) return
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)()
    ;[[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.5)
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.55)
    })
    setTimeout(() => ac.close(), 1500)
  } catch { /* 소리를 못 내도 알림은 보여요 */ }
}
function alert(text) { if (conf.focus) { say(text, 6000); return }   // 집중 모드: 소리·폴짝 없이 말풍선만
  cats.forEach((c) => c.hop()); chime(); say(text) }
function ring(text) {
  cats.forEach((c) => c.run())
  say(text + '  (고양이를 눌러 주세요)', 180000)
  chime(); clearInterval(ringTimer)
  ringTimer = setInterval(() => { if (!cats.some((c) => c.st.mode === 'run')) return clearInterval(ringTimer); chime() }, 8000)
}
const hourText = (h) => {
  if (h === 9) return '좋은 아침이에요! 9시 정각이에요'
  if (h === 12) return '12시 정각, 점심시간이에요!'
  if (h === 18) return '18시 정각, 퇴근 시간이에요!'
  if (h === 0) return '밤 12시 정각이에요'
  return h < 12 ? `오전 ${h}시 정각이에요` : `오후 ${h - 12}시 정각이에요`
}
const fired = {}
function checkAlarms(d) {
  for (const a of conf.alarms || []) {
    if (!a.on || !a.time) continue
    const [hh, mm] = a.time.split(':').map(Number)
    if (d.getHours() !== hh || d.getMinutes() !== mm || d.getSeconds() > 10) continue
    if (!(a.days || []).includes(d.getDay())) continue
    const key = a.id + d.toDateString() + a.time
    if (fired[key]) continue
    fired[key] = 1
    ring(`⏰ ${a.time} ${a.label || '알람'}`)
  }
}
let lastHourKey = ''
setInterval(() => {
  const d = new Date()
  checkAlarms(d)
  if (d.getMinutes() !== 0 || d.getSeconds() > 5 || !conf.hourly) return
  const key = `${d.getFullYear()}${d.getMonth()}${d.getDate()}${d.getHours()}`
  if (key === lastHourKey) return
  if (conf.hours === 'work' && (d.getDay() === 0 || d.getDay() === 6 || d.getHours() < 9 || d.getHours() > 18)) return
  lastHourKey = key
  alert(hourText(d.getHours()))
}, 1000)
function setTimer(min) {
  clearTimeout(timerId)
  if (!min) { say('타이머를 취소했어요', 3000); return }
  say(`${min}분 뒤에 알려 드릴게요`, 3000)
  timerId = setTimeout(() => ring(`⏱ ${min}분 타이머가 끝났어요!`), min * 60000)
}
window.__alert = alert; window.__timer = setTimer; window.__ring = ring; window.__cats = cats; window.__scene = () => scene; window.__force = () => { const [r, c] = cats; c.st.surf = r.st.surf; c.st.x = r.st.x - 150; lastScene = -1e9; cooldown = 0; r.st.mode = c.st.mode = 'stand' }   // 시험용

init()
