// 루비와 크리스탈의 움직임(둘 다 같은 규칙). 화면(모든 모니터)과 열려 있는 창들 위를 돌아다녀요.
//  · 바닥(작업표시줄 위)을 걷고, 쉬고, 가끔 열려 있는 창의 윗부분으로 폴짝 올라가 앉아요 (창을 옮기면 따라가요)
//  · 마우스를 코앞에서 흔들면 앞발로 잡으려 하고, 재빨리 빼면 헛짚어요
//  · 드래그해서 원하는 곳(다른 모니터 포함)에 둘 수 있어요  · 고양이 모양이 있는 곳만 클릭돼요(나머지는 뒤 창으로 통과)
//  · 정각 알림, 타이머, 사용자 알람 (울리면 계속 뛰어다녀요)
let dims = null, size = 1
let conf = { hourly: true, sound: true, hours: 'all', alarms: [], ruby: true, crystal: true }
const bridge = window.api || { ignore() {}, config: async () => ({ size: 1 }), layout: async () => null, onConfig() {}, onLayout() {}, onWindows() {}, onCursor() {} }
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
    const onWin = st.surf.t === 'win'
    const cands = wins.filter((w) => w.y > 140 && w.y < layout.displays[dispAt(st.x)].floor - 100 && w.x2 - w.x1 > 240 && !(onWin && w.id === st.surf.id))
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
    if (st.frozen) { el.style.display = 'none'; st.box = null; return }
    if (el.style.display === 'none') return
    const k0 = frameFor(now), d0 = dims.dim[k0], W0 = d0.w * SCALE * size, H0 = d0.h * SCALE * size

    // 창 위에 있는데 그 창이 사라졌으면 바닥으로 내려와요 · 창을 옮기면 따라가요
    if (st.surf.t === 'win' && !['leap', 'drag'].includes(st.mode)) {
      const o = winById(st.surf.id)
      if (!o) fall(now)
      else { st.y = o.y; if (st.x < o.x1 + 10 || st.x > o.x2 - 10) st.x = Math.min(Math.max(st.x, o.x1 + 30), o.x2 - 30) }
    } else if (st.surf.t === 'floor' && !['leap', 'drag'].includes(st.mode)) st.y = surfY(st.surf)

    // 마우스가 코앞에서 흔들리면 앞발로 잡으려 해요
    const interactive = !['pounce', 'aegyo', 'jump', 'run', 'leap', 'drag', 'miss'].includes(st.mode)
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
    const flip = st.mode === 'pounce' ? st.pounceDir < 0 : ['walk', 'run'].includes(st.mode) ? false : st.dir < 0
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
  const setHidden = (h) => { hid = h; el.style.display = h || st.frozen ? 'none' : ''; if (h) st.box = null }
  const setFrozen = (f) => { st.frozen = f; el.style.display = f || hid ? 'none' : ''; if (f) st.box = null }

  const self = { st, el, update, overCat, drop, pet, hop, run, calm, setHidden, setFrozen, name }
  return self
}
const calmAll = () => { clearInterval(ringTimer); if (bubbleEl && cats.some((c) => c.st.mode === 'run')) { bubbleEl.remove(); bubbleEl = null }; cats.forEach((c) => c.calm()) }

async function init() {
  dims = window.DIMS
  const c = await bridge.config(); size = c.size || 1; conf = { ...conf, ...c }
  const l = await bridge.layout(); if (l) layout = l
  const applyVis = () => { if (cats[0]) cats[0].setHidden(conf.ruby === false); if (cats[1]) cats[1].setHidden(conf.crystal === false) }
  bridge.onConfig((c) => { size = c.size || 1; conf = { ...conf, ...c }; applyVis() })
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

// ═══ 두 마리가 만나면 장난쳐요: 가까이 있는 둘이 쉬고 있으면 짝 그림(A·B 코 비비기 / C·D 뛰어놀기)을 보여 줘요 ═══
const SCENES = [['A', 480, 1, 15], ['B', 480, 1, 15], ['C', 330, 2, 35], ['D', 330, 2, 35]]
let scene = null, lastScene = performance.now() - 30000, lastVisit = 0
const pairImg = document.createElement('img'); pairImg.alt = ''; pairImg.className = 'pair'; pairImg.style.display = 'none'; document.body.appendChild(pairImg)
const IDLE = ['stand', 'sit', 'sleep', 'groom']
function endScene(place = true) {
  if (!scene) return
  const sc = scene; scene = null; pairImg.style.display = 'none'; lastScene = performance.now()
  const [ruby, crystal] = cats
  const away = sc.flip ? -1 : 1                      // 크리스탈은 그림에서 왼쪽(뒤집히면 오른쪽)
  for (const [c, off] of [[crystal, -75 * away], [ruby, 75 * away]]) {
    c.setFrozen(false)
    if (place) {
      const [lo, hi] = surfRange(c.st.surf, 130 * size)
      c.st.x = Math.min(Math.max(sc.x + off, lo), Math.max(lo, hi)); c.st.dir = off < 0 ? 1 : -1
      c.st.mode = 'sit'; c.st.until = performance.now() + 5000 + Math.random() * 6000; c.st.cool = performance.now() + 4000
    }
  }
}
function directScenes(now) {
  const [ruby, crystal] = cats
  if (!ruby || !crystal) return
  if (scene) {
    const k = Math.floor((now - scene.t) / scene.ms)
    if (k >= 12 * scene.loops || conf.ruby === false || conf.crystal === false || drag) return endScene(false)
    const key = `pair${scene.kind}${k % 12}`, d = dims.dim[key], pk = scene.kind === 'A' || scene.kind === 'B' ? 0.86 : 0.78, w = d.w * SCALE * size * pk, h = d.h * SCALE * size * pk
    if (pairImg.dataset.k !== key) { pairImg.src = `frames/${key}.webp`; pairImg.dataset.k = key }
    pairImg.style.width = w + 'px'; pairImg.style.height = h + 'px'
    pairImg.style.transform = `translate(${Math.round(scene.x - w / 2)}px, ${Math.round(scene.y - h)}px)${scene.flip ? ' scaleX(-1)' : ''}`
    pairImg.style.display = ''
    return
  }
  if (conf.ruby === false || conf.crystal === false || drag) return
  const a = ruby.st, b = crystal.st
  if (a.surf.t !== b.surf.t || (a.surf.t === 'floor' ? a.surf.d !== b.surf.d : a.surf.id !== b.surf.id)) return
  if (!IDLE.includes(a.mode) || !IDLE.includes(b.mode)) { if (!(b.mode === 'walk' && b.seek)) return }
  const dx = Math.abs(a.x - b.x)
  if (now - lastScene > 15000 && dx < 360 * size && IDLE.includes(a.mode) && IDLE.includes(b.mode)) {
    let r = Math.random() * SCENES.reduce((s, c) => s + c[3], 0), pick = SCENES[0]
    for (const c of SCENES) { if ((r -= c[3]) < 0) { pick = c; break } }
    const [lo, hi] = surfRange(a.surf, 260 * size)
    scene = { kind: pick[0], ms: pick[1], loops: pick[2], t: now, x: Math.min(Math.max((a.x + b.x) / 2, lo), Math.max(lo, hi)), y: a.y, flip: b.x > a.x, n: 0 }
    ruby.setFrozen(true); crystal.setFrozen(true); b.seek = false
    return
  }
  if (b.seek && (dx < 220 * size || b.mode !== 'walk')) b.seek = false
  if (!b.seek && now - lastScene > 25000 && now - lastVisit > 12000 && dx > 400 * size && IDLE.includes(b.mode)) {   // 멀리 있으면 크리스탈이 루비에게 놀러 가요
    lastVisit = now; b.seek = true; b.mode = 'walk'; b.dir = a.x > b.x ? 1 : -1; b.until = now + Math.min(40000, (dx - 200 * size) / (0.3 * 133 * size) * 1000)
  }
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
function alert(text) { cats.forEach((c) => c.hop()); chime(); say(text) }
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
window.__alert = alert; window.__timer = setTimer; window.__ring = ring; window.__cats = cats; window.__scene = () => scene; window.__play = (kind) => { const [r, c] = cats; r.st.mode = c.st.mode = 'stand'; c.st.surf = r.st.surf; c.st.x = r.st.x - 150; c.st.y = r.st.y; lastScene = -1e9; scene = null; const p = SCENES.find((s) => s[0] === kind) || SCENES[0]; scene = { kind: p[0], ms: p[1], loops: p[2], t: performance.now(), x: r.st.x - 75, y: r.st.y, flip: false, n: 0 }; r.setFrozen(true); c.setFrozen(true) }   // 시험용

init()
