import { useEffect, useRef, useState } from 'react'
import { AVATARS, defaultName, type AvatarId } from '../avatars'
import { asset } from '../assets'
import { backupFileName, makeBackup, parseBackup } from '../backup'
import { DEFAULT_SCHEDULE } from '../schedule'
import { DEFAULT_SETTINGS, getLastBackup, markBackup, validateSchedule, type Settings } from '../settings'
import type { Task } from '../types'
import { CURRENT_BUILD, fetchLatestBuild, updateApp } from '../update'

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }

const SCHEDULE_FIELDS: [keyof typeof DEFAULT_SCHEDULE, string][] = [
  ['arrive', '출근'], ['lunchStart', '점심 시작'], ['lunchEnd', '점심 끝'],
  ['coffeeStart', '커피타임 시작'], ['coffeeEnd', '커피타임 끝'], ['leave', '퇴근'],
]

interface Props {
  tasks: Task[]
  settings: Settings
  onSettings: (s: Settings) => void
  onReplace: (tasks: Task[], settings: Settings) => Promise<boolean>
  onBackedUp: () => void
  /** 시험용 시각 조절(화면 위 시계를 없애면서 설정 안으로 옮겼어요) */
  time: { now: number; simulated: boolean; playing: boolean; setSim: (v: number | null) => void; setPlaying: (v: boolean | ((p: boolean) => boolean)) => void }
}

export default function SettingsView({ tasks, settings, onSettings, onReplace, onBackedUp, time }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [schedErr, setSchedErr] = useState('')
  // 새 버전이 올라와 있는지 확인: 'checking' → 'latest'(최신) / 'new'(새 버전 있음) / 'offline'(확인 못 함)
  const [ver, setVer] = useState<'checking' | 'latest' | 'new' | 'offline'>('checking')
  const [updating, setUpdating] = useState(false)
  useEffect(() => {
    let on = true
    fetchLatestBuild().then((b) => { if (on) setVer(b === null ? 'offline' : b === CURRENT_BUILD ? 'latest' : 'new') })
    return () => { on = false }
  }, [])
  const last = getLastBackup()
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null

  const say = (ok: boolean, text: string) => setMsg({ ok, text })

  const exportFile = async () => {
    const json = JSON.stringify(makeBackup(tasks, settings), null, 2)
    const name = backupFileName()
    const file = new File([json], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'MINI OFFICE WORLD 백업' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url; a.download = name
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
      markBackup(); onBackedUp()
      say(true, `업무 ${tasks.length}건을 백업했어요. 파일을 안전한 곳에 보관해 주세요.`)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') say(false, '백업 파일을 만들지 못했어요. 아래 "복사하기"를 이용해 보세요.')
    }
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(makeBackup(tasks, settings)))
      markBackup(); onBackedUp()
      say(true, '백업 내용을 복사했어요. 메모 앱 등에 붙여 넣어 보관한 뒤, 복원할 때 파일로 저장해서 사용하세요.')
    } catch {
      say(false, '복사하지 못했어요. 파일로 내보내기를 이용해 주세요.')
    }
  }

  const importFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const { tasks: next, settings: s, skipped } = parseBackup(await f.text())
      const ok = window.confirm(`백업 파일의 업무 ${next.length}건으로 복원할까요?\n지금 저장된 업무 ${tasks.length}건은 모두 바뀌어요.`)
      if (!ok) return
      if (await onReplace(next, s)) say(true, `업무 ${next.length}건을 복원했어요.${skipped ? ` (읽을 수 없는 ${skipped}건 제외)` : ''}`)
      else say(false, '복원하지 못했어요. 저장 공간을 확인해 주세요.')
    } catch (e) {
      say(false, (e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setTime = (k: keyof typeof DEFAULT_SCHEDULE, v: string) => {
    if (!v) return
    const schedule = { ...settings.schedule, [k]: toMin(v) }
    const err = validateSchedule(schedule)
    setSchedErr(err ?? '')
    if (!err) onSettings({ ...settings, schedule })
  }

  const setName = (id: AvatarId, v: string) => onSettings({ ...settings, names: { ...settings.names, [id]: v.slice(0, 6) } })

  const resetAll = async () => {
    if (!window.confirm('모든 업무와 설정을 지울까요?\n되돌릴 수 없어요. 먼저 백업해 두면 안전해요.')) return
    if (await onReplace([], DEFAULT_SETTINGS)) say(true, '모든 데이터를 초기화했어요.')
  }

  return (
    <div className="settings">
      <section>
        <h3 className="sh">🔄 앱 업데이트</h3>
        <p className={`ver ${ver === 'new' ? 'newver' : ''}`}>
          {ver === 'checking' && '새 버전을 확인하는 중이에요…'}
          {ver === 'latest' && '✅ 최신 버전이에요.'}
          {ver === 'new' && '🆕 새 버전이 있어요! 아래 버튼을 눌러 업데이트하세요.'}
          {ver === 'offline' && '인터넷에 연결되어 있지 않아서 확인하지 못했어요.'}
          <small> (현재 버전 {CURRENT_BUILD})</small>
        </p>
        <button className="primary wide" disabled={updating} onClick={() => { setUpdating(true); updateApp() }}>
          {updating ? '업데이트하는 중…' : '🔄 새로고침 (업데이트)'}
        </button>
        <p className="muted">누르면 앱 파일을 새로 받아 와요. 등록한 업무와 설정은 그대로 남아 있어요.</p>
      </section>

      <section>
        <h3 className="sh">🌙 화면 모드</h3>
        <div className="chips">
          {([['auto', '자동'], ['light', '라이트'], ['dark', '다크']] as [Settings['theme'], string][]).map(([k, l]) => (
            <button key={k} className={`chip sm ${settings.theme === k ? 'on imp-normal' : ''}`} onClick={() => onSettings({ ...settings, theme: k })}>{l}</button>
          ))}
        </div>
        <p className="muted">자동은 휴대폰의 다크 모드 설정을 따라가요.</p>
      </section>

      <section>
        <h3 className="sh">💾 데이터 백업·복원</h3>
        <p className="muted">업무는 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우면 사라지니 가끔 백업해 두세요.</p>
        <p className={`bk ${days === null || days > 14 ? 'old' : ''}`}>
          {last ? `마지막 백업: ${new Date(last).toLocaleDateString('ko-KR')} (${days === 0 ? '오늘' : `${days}일 전`})` : '아직 백업한 적이 없어요.'}
        </p>
        <div className="btnrow">
          <button className="primary" onClick={exportFile}>파일로 내보내기</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>파일에서 복원</button>
          <button className="ghost" onClick={copyJson}>복사하기</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        {msg && <p className={msg.ok ? 'okmsg' : 'err'}>{msg.text}</p>}
      </section>

      <section>
        <h3 className="sh">🕘 생활 시간표</h3>
        <div className="timegrid">
          {SCHEDULE_FIELDS.map(([k, label]) => (
            <label key={k}>{label}<input type="time" value={toHHMM(settings.schedule[k])} onChange={(e) => setTime(k, e.target.value)} /></label>
          ))}
        </div>
        {schedErr && <p className="err">{schedErr}</p>}
        <button className="ghost sm" onClick={() => { setSchedErr(''); onSettings({ ...settings, schedule: { ...DEFAULT_SCHEDULE } }) }}>기본 시간표로</button>
      </section>

      <section>
        <h3 className="sh">🧑‍💼 아바타 이름</h3>
        <div className="nametable" role="table" aria-label="아바타 이름">
          <div className="nt-head" role="row"><span>업무</span><span>이름</span></div>
          {AVATARS.map((a) => (
            <label key={a.id} className="nt-row" role="row">
              <span className="nt-role">{a.role}</span>
              <span className="nt-name">
                <input value={settings.names[a.id] ?? a.name} maxLength={6} placeholder={defaultName(a.id)} onChange={(e) => setName(a.id, e.target.value)} aria-label={`${a.role} 이름`} />
                <img src={asset(`avatars/${a.id}-stand.webp`)} alt="" />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="sh">🧪 시험용 시각</h3>
        <p className="muted">아바타가 출근·점심·퇴근할 때 어떻게 움직이는지 미리 볼 수 있어요. 지금 {toHHMM(Math.floor(time.now))}{time.simulated ? ' (시험 시각)' : ' (실제 시각)'}</p>
        <input type="range" min={480} max={1110} value={Math.min(Math.max(Math.floor(time.now), 480), 1110)}
          onChange={(e) => { time.setPlaying(false); time.setSim(Number(e.target.value)) }} />
        <div className="btnrow">
          <button className="ghost" onClick={() => time.setPlaying((p) => !p)}>{time.playing ? '⏸ 멈춤' : '▶ 빨리감기'}</button>
          <button className="ghost" onClick={() => { time.setPlaying(false); time.setSim(null) }}>실제 시각으로</button>
          {([['출근', 540], ['점심', 720], ['커피', 900], ['퇴근', 1080]] as [string, number][]).map(([l, v]) => (
            <button key={l} className="ghost" onClick={() => { time.setPlaying(false); time.setSim(v) }}>{l} {toHHMM(v)}</button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="sh">🧹 초기화</h3>
        <button className="ghost danger" onClick={resetAll}>모든 데이터 지우기</button>
      </section>
    </div>
  )
}
