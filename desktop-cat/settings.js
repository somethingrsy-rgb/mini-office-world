const api = window.api
let alarms = []
const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const $ = (id) => document.getElementById(id)
const uid = () => Math.random().toString(36).slice(2, 9)

function save() { api.saveAlarms(alarms) }
function render() {
  const box = $('list'); box.innerHTML = ''
  if (!alarms.length) box.innerHTML = '<p class="m">아직 알람이 없어요. 아래 "+ 알람 추가"를 눌러 보세요.</p>'
  alarms.forEach((a) => {
    const el = document.createElement('div'); el.className = 'al' + (a.on ? '' : ' off')
    el.innerHTML = `<div class="row"><input type="checkbox" ${a.on ? 'checked' : ''} data-k="on" title="켜기/끄기"><input type="time" value="${a.time}" data-k="time"><input type="text" placeholder="메모 (예: 회의 시작)" value="${(a.label || '').replace(/"/g, '&quot;')}" data-k="label" maxlength="30"><button class="x" data-k="del">삭제</button></div>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" data-d="${d}" ${a.days.includes(d) ? 'checked' : ''}>${DAYS[d]}</label>`).join('')} <button data-k="wk">평일</button> <button data-k="all">매일</button></div>`
    el.addEventListener('input', (e) => {
      const t = e.target
      if (t.dataset.k === 'time') a.time = t.value
      else if (t.dataset.k === 'label') a.label = t.value
      else if (t.dataset.k === 'on') { a.on = t.checked; el.classList.toggle('off', !a.on) }
      else if (t.dataset.d !== undefined) { const d = Number(t.dataset.d); a.days = t.checked ? [...new Set([...a.days, d])] : a.days.filter((x) => x !== d) }
      save()
    })
    el.addEventListener('click', (e) => {
      const k = e.target.dataset.k
      if (k === 'del') { alarms = alarms.filter((x) => x.id !== a.id); save(); render() }
      if (k === 'wk') { a.days = [1, 2, 3, 4, 5]; save(); render() }
      if (k === 'all') { a.days = [0, 1, 2, 3, 4, 5, 6]; save(); render() }
    })
    box.appendChild(el)
  })
}
$('add').onclick = () => { alarms.push({ id: uid(), on: true, time: '09:00', label: '', days: [1, 2, 3, 4, 5] }); save(); render() }
document.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => api.startTimer(Number(b.dataset.m))))
$('cs').onclick = () => { const v = Number($('cm').value); if (v >= 1) api.startTimer(v) }
$('cc').onclick = () => api.startTimer(0)
api.config().then((c) => { alarms = Array.isArray(c.alarms) ? c.alarms : []; render() })
