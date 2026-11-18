// 루비의 움직임: 화면 아래(작업표시줄 위)를 걷고, 쉬고, 가끔 폴짝 뛰고, 마우스가 가까이 오면 잡으려 하고, 누르면 애교를 부려요
let dims = null, size = 1
const api = window.api || { ignore() {}, config: async () => ({ size: 1 }), onConfig() {} }
const catEl = document.getElementById('cat'), img = document.getElementById('img')
const FR = (g, n) => Array.from({ length: n }, (_, i) => `${g}${i}`)
const SCALE = 0.8          // 그림 1px이 화면에서 차지하는 크기 (보통 크기일 때 고양이 키 ≈ 100px)
let conf = { hourly: true, sound: true, hours: 'all' }
let st = { x: 300, dir: 1, mode: 'stand', t: 0, frame: 0, until: 0, jumpT: 0, pounceDir: 1, cool: 0 }
const mouse = { x: -999, y: -999 }
let hover = false

async function init() {
  dims = window.DIMS
  const c = await api.config(); size = c.size || 1; conf = { ...conf, ...c }
  api.onConfig((c) => { size = c.size || 1; conf = { ...conf, ...c } })
  api.onTimer && api.onTimer(setTimer)
  const names = Object.keys(dims.dim)
  await Promise.all(names.map((n) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = `frames/${n}.webp` })))
  st.x = innerWidth * (0.2 + Math.random() * 0.6)
  st.mode = 'stand'; st.until = performance.now() + 1500
  last = performance.now(); requestAnimationFrame(loop)
}

const rnd = (a) => a[Math.floor(Math.random() * a.length)]

// 다음 행동 고르기: 걷기 / 폴짝 뛰기 / 쉬기(10초)
function pick(now) {
  const r = Math.random()
  if (r < 0.62) { st.mode = 'walk'; st.dir = Math.random() < 0.5 ? -1 : 1; st.until = now + 5000 + Math.random() * 9000 }
  else if (r < 0.72) { st.mode = 'jump'; st.jumpT = now; st.until = now + 1500 }
  else { st.mode = rnd(['sit', 'sit', 'sleep', 'groom', 'stand']); st.until = now + 10000 }
  st.frame = 0
}

function frameFor(now) {
  const n = (g) => dims.count[g]
  switch (st.mode) {
    case 'walk': return st.dir > 0 ? `walkR${Math.floor(now / 150) % n('walkR')}` : `walkL${Math.floor(now / 150) % n('walkL')}`
    case 'jump': return `up${Math.min(n('up') - 1, Math.floor((now - st.jumpT) / 120))}`
    case 'pounce': return `pounce${Math.min(n('pounce') - 1, Math.floor((now - st.pounceT) / 110))}`
    case 'aegyo': return 'aegyo0'
    case 'sit': return 'sit0'
    case 'sleep': return 'sleep0'
    case 'groom': return 'groom0'
    default: return 'up0'
  }
}

let last = 0
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  if (!dims) return requestAnimationFrame(loop)
  const key0 = frameFor(now)
  const d = dims.dim[key0], W = d.w * SCALE * size, H = d.h * SCALE * size
  const groundY = innerHeight - 2

  // 마우스가 가까이 오면 잡으려고 해요 (뛰는 중·애교 중에는 안 해요)
  const cx = st.x, cyTop = groundY - H
  if (!['pounce', 'aegyo', 'jump'].includes(st.mode) && now > st.cool && Math.abs(mouse.x - cx) < 260 * size && mouse.y > cyTop - 120 && mouse.y < groundY + 4 && !hover) {
    st.mode = 'pounce'; st.pounceT = now; st.until = now + 1400; st.pounceDir = mouse.x < cx ? -1 : 1; st.cool = now + 1400 + 6000
  }
  if (now > st.until) { if (st.after) { st.mode = st.after.mode; st.until = st.after.until; st.after = null } else pick(now) }   // 행동이 끝나면 다음 행동을 골라요

  if (st.mode === 'walk') {
    const speed = 0.3 * W   // 걸음 그림에 맞춰 발이 미끄러지지 않을 속도
    st.x += st.dir * speed * dt
    const margin = W * 0.5 + 8
    if (st.x < margin) { st.x = margin; st.dir = 1 } else if (st.x > innerWidth - margin) { st.x = innerWidth - margin; st.dir = -1 } // 화면 끝에서 돌아서 걸어요
  }
  const key = frameFor(now)
  const dd = dims.dim[key], w = dd.w * SCALE * size, h = dd.h * SCALE * size
  let lift = 0
  if (st.mode === 'jump') lift = Math.sin(Math.min(1, (now - st.jumpT) / 1500) * Math.PI) * 70 * size
  if (st.mode === 'aegyo') lift = Math.abs(Math.sin((now - st.aegyoT) / 220)) * 5 * size
  const flip = st.mode === 'pounce' ? st.pounceDir < 0 : ['walk'].includes(st.mode) ? false : st.dir < 0
  if (img.dataset.k !== key) { img.src = `frames/${key}.webp`; img.dataset.k = key }
  img.style.width = w + 'px'; img.style.height = h + 'px'; img.style.transform = flip ? 'scaleX(-1)' : ''
  catEl.style.transform = `translate(${Math.round(st.x - w / 2)}px, ${Math.round(groundY - h - lift)}px)`
  if (bubbleEl) { if (now > bubbleUntil) { bubbleEl.remove(); bubbleEl = null } else { bubbleEl.style.left = Math.round(Math.min(Math.max(st.x, 140), innerWidth - 140)) + 'px'; bubbleEl.style.top = Math.max(4, Math.round(groundY - h - lift - bubbleEl.offsetHeight - 14)) + 'px' } }
  st.box = { x: st.x - w / 2, y: groundY - h - lift, w, h }
  requestAnimationFrame(loop)
}

// 고양이 위에서만 마우스를 받아요 (그 밖은 클릭이 뒤 창으로 통과)
document.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY
  const b = st.box
  const over = !!b && e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h
  if (over !== hover) { hover = over; api.ignore(!over) }
})
document.addEventListener('mousedown', () => { if (hover) petCat() })

function petCat() {
  const now = performance.now()
  st.mode = 'aegyo'; st.aegyoT = now; st.until = now + 4500; st.cool = now + 6500
  const b = st.box
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('div'); h.className = 'heart'; h.textContent = '♥'; h.style.color = '#ff6fa5'
    h.style.left = (b.x + b.w / 2 + (i - 1) * 26 - 10) + 'px'; h.style.top = (b.y - 10) + 'px'; h.style.animationDelay = (i * 0.15) + 's'
    document.body.appendChild(h); setTimeout(() => h.remove(), 1800)
  }
  const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = '루비'
  nm.style.left = (b.x + b.w / 2) + 'px'; nm.style.top = (b.y - 36) + 'px'; document.body.appendChild(nm); setTimeout(() => nm.remove(), 3300)
}

// ── 알람: 정각 알림과 타이머. 고양이가 폴짝 뛰고 말풍선을 띄우고(소리는 작게) 알려줘요 ──
let bubbleEl = null, bubbleUntil = 0, timerId = 0
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
function alert(text) {
  const now = performance.now()
  st.mode = 'jump'; st.jumpT = now; st.until = now + 1500   // 폴짝 뛰어 알려요 → 끝나면 앉아서 말풍선 아래에 있어요
  st.after = { mode: 'sit', until: now + 1500 + 8000 }
  chime(); say(text)
}
const hourText = (h) => {
  if (h === 9) return '좋은 아침이에요! 9시 정각이에요'
  if (h === 12) return '12시 정각, 점심시간이에요!'
  if (h === 18) return '18시 정각, 퇴근 시간이에요!'
  if (h === 0) return '밤 12시 정각이에요'
  return h < 12 ? `오전 ${h}시 정각이에요` : `오후 ${h - 12}시 정각이에요`
}
let lastHourKey = ''
setInterval(() => {
  const d = new Date()
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
  timerId = setTimeout(() => alert(`${min}분이 지났어요!`), min * 60000)
}
window.__alert = alert; window.__timer = setTimer   // 시험용

init()
