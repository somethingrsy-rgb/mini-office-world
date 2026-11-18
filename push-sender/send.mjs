// 평일 아침 9시(한국)에 GitHub Actions가 실행해요: 데이터 저장소의 업무를 읽어 등록된 기기로 푸시를 보내요
// 로그는 공개될 수 있어서 업무 제목은 절대 출력하지 않아요
import webpush from 'web-push'
import { buildMessages } from './messages.mjs'

// 붙여넣을 때 섞여 들어가는 공백·따옴표·줄바꿈·끝의 '='를 지워 줘요
const clean = (v) => (v ?? '').replace(/[\s"'`]/g, '').replace(/=+$/, '')
const DATA_REPO = clean(process.env.DATA_REPO), DATA_TOKEN = clean(process.env.DATA_TOKEN), VAPID_PUBLIC = clean(process.env.VAPID_PUBLIC), VAPID_PRIVATE = clean(process.env.VAPID_PRIVATE)
const okKey = (v, n) => v.length === n && /^[A-Za-z0-9_-]+$/.test(v)
if (!okKey(VAPID_PUBLIC, 87) || !okKey(VAPID_PRIVATE, 43)) { console.error(`VAPID 키 모양이 이상해요 (공개 키 길이 ${VAPID_PUBLIC.length}/87, 비밀 키 길이 ${VAPID_PRIVATE.length}/43). 키를 다시 복사해서 Secrets에 붙여 주세요.`); process.exit(1) }
if (!DATA_REPO || !DATA_TOKEN || !VAPID_PUBLIC || !VAPID_PRIVATE) { console.error('필요한 설정(Secrets)이 비어 있어요.'); process.exit(1) }
webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC, VAPID_PRIVATE)

const api = (path, init) => fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`, { ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${DATA_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init?.headers ?? {}) } })
const read = async (path) => { const r = await api(path); if (r.status === 404) return null; if (!r.ok) throw new Error(`${path} 읽기 실패 (${r.status})`); const j = await r.json(); return { sha: j.sha, json: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) } }

const data = await read('mini-office-data.json')
const subsFile = await read('mini-office-push.json')
const subs = subsFile?.json?.subs ?? []
if (!data) { console.log('업무 파일이 아직 없어요.'); process.exit(0) }
if (subs.length === 0) { console.log('알림을 켠 기기가 없어요.'); process.exit(0) }

const msgs = buildMessages(data.json.tasks ?? [])
console.log(`보낼 알림 ${msgs.length}개, 기기 ${subs.length}대`)
const dead = new Set()
for (const m of msgs) {
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(s.sub, JSON.stringify(m), { TTL: 6 * 3600 }) }
    catch (e) { if ([400, 401, 403, 404, 410].includes(e.statusCode)) dead.add(s.sub.endpoint); else console.error('전송 실패', e.statusCode) }
  }))
}
if (dead.size && subsFile) {
  const next = { subs: subs.filter((s) => !dead.has(s.sub.endpoint)) }
  await api('mini-office-push.json', { method: 'PUT', body: JSON.stringify({ message: 'remove dead subscriptions', content: Buffer.from(JSON.stringify(next, null, 1)).toString('base64'), sha: subsFile.sha }) })
  console.log(`만료된 기기 ${dead.size}대 정리`)
}
