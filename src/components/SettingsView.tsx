import { useEffect, useRef, useState } from 'react'
import { AVATARS, defaultName, type AvatarId } from '../avatars'
import { asset } from '../assets'
import { backupFileName, makeBackup, parseBackup } from '../backup'
import { DEFAULT_SCHEDULE } from '../schedule'
import { BACKDROPS, SKINS, DEFAULT_SETTINGS, getLastBackup, markBackup, validateSchedule, type Settings } from '../settings'
import type { Task } from '../types'
import { CURRENT_BUILD, fetchLatestBuild, updateApp } from '../update'
import { listSnapshots, takeSnapshot } from '../autobackup'
import { disablePush, enablePush, isIOS, isStandalone, pushEnabled, pushSupported } from '../push'
import { setSoundPrefs, useSoundPrefs } from '../audio'
import { clearSyncConfig, setSyncConfig, syncRequest, useSyncStatus } from '../sync'

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }

const SCHEDULE_FIELDS: [keyof typeof DEFAULT_SCHEDULE, string][] = [
  ['arrive', '출근'], ['lunchStart', '점심 시작'], ['lunchEnd', '점심 끝'],
  ['coffeeStart', '커피타임 시작'], ['coffeeEnd', '커피타임 끝'], ['leave', '퇴근'],
]

interface Props {
  tasks: Task[]
  guide: boolean
  onGuide: (v: boolean) => void
  settings: Settings
  onSettings: (s: Settings) => void
  onReplace: (tasks: Task[], settings: Settings) => Promise<boolean>
  onBackedUp: () => void
  /** 시험용 시각 조절(화면 위 시계를 없애면서 설정 안으로 옮겼어요) */
  time: { now: number; simulated: boolean; playing: boolean; setSim: (v: number | null) => void; setPlaying: (v: boolean | ((p: boolean) => boolean)) => void }
}

export default function SettingsView({ tasks, guide, onGuide, settings, onSettings, onReplace, onBackedUp, time }: Props) {
  const sound = useSoundPrefs()
  const sync = useSyncStatus()
  const [snaps, setSnaps] = useState(listSnapshots)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  useEffect(() => { void pushEnabled().then(setPushOn) }, [])
  const [syncRepo, setSyncRepo] = useState(sync.repo)
  const [syncToken, setSyncToken] = useState('')
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
        <h3 className="sh">🔊 소리</h3>
        <div className="chips">
          <button className={`chip sm ${sound.bgm ? 'on imp-normal' : ''}`} onClick={() => setSoundPrefs({ ...sound, bgm: !sound.bgm })}>🎵 배경음악 {sound.bgm ? '켜짐' : '꺼짐'}</button>
          <button className={`chip sm ${sound.sfx ? 'on imp-normal' : ''}`} onClick={() => setSoundPrefs({ ...sound, sfx: !sound.sfx })}>🔔 효과음 {sound.sfx ? '켜짐' : '꺼짐'}</button>
        </div>
        <p className="muted">아침 6시~저녁 6시에는 낮 음악, 저녁 6시~아침에는 밤 음악이 나와요. 업무를 분배하거나 완료·대기할 때 효과음이 울려요. 이 설정은 이 기기에만 저장돼요.</p>
      </section>

      <section>
        <h3 className="sh">☁️ 배경 (라이트 모드)</h3>
        <div className="skins">
          {BACKDROPS.map(([k, l]) => (
            <button key={k} className={`skin ${settings.backdrop === k ? 'on' : ''}`} onClick={() => onSettings({ ...settings, backdrop: k })} aria-pressed={settings.backdrop === k}>
              <img src={asset(k === 'cotton' ? 'bg.webp' : `bg-${k}.webp`)} alt="" loading="lazy" style={{ objectFit: 'cover', borderRadius: 10 }} />
              <span>{l}</span>
            </button>
          ))}
        </div>
        <p className="muted">다크 모드는 밤하늘 배경 하나예요.</p>
      </section>

      <section>
        <h3 className="sh">🏠 하우스 그림</h3>
        <div className="skins">
          {SKINS.map(([k, l]) => (
            <button key={k} className={`skin ${settings.skin === k ? 'on' : ''}`} onClick={() => onSettings({ ...settings, skin: k })} aria-pressed={settings.skin === k}>
              <img src={asset(k === 'default' ? 'house.webp' : `house-${k}.webp`)} alt="" loading="lazy" />
              <span>{l}</span>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={() => onGuide(!guide)}>{guide ? '📏 바닥 맞춤 선 끄기' : '📏 바닥 맞춤 선 켜기'}</button>
        <p className="muted">켜면 하우스 위에 층마다 눈금선이 그려져요. 빨간 선이 아바타 발 높이고, 파랑은 위로, 초록은 아래로 10단위씩이에요. 바닥(카펫)이 어느 선에 오면 좋을지 알려주세요.</p>
        <p className="muted">다크 모드에서는 같은 그림이 밤 분위기로 어두워져요. 방을 눌러 크게 볼 때 나오는 방 그림은 아직 기본 그림이에요.</p>
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
        <h3 className="sh">🔔 아침 푸시 알림</h3>
        <p className="muted">평일 아침 9시쯤 휴대폰으로 알려 줘요: 오늘의 업무 브리핑, 마감 2일 전, 마감 당일. 앱을 열지 않아도 와요. (먼저 아래 "기기 동기화"가 연결되어 있어야 해요)</p>
        {isIOS() && !isStandalone() && <p className="err">아이폰은 사파리의 공유 버튼 → "홈 화면에 추가"로 앱을 설치하고, 설치한 앱을 열어서 켜야 해요.</p>}
        <div className="btnrow">
          {pushOn
            ? <button className="ghost" disabled={pushBusy} onClick={async () => { setPushBusy(true); try { await disablePush(); setPushOn(false); setPushMsg('알림을 껐어요.') } finally { setPushBusy(false) } }}>알림 끄기</button>
            : <button className="primary" disabled={pushBusy || !pushSupported()} onClick={async () => { setPushBusy(true); setPushMsg(''); try { await enablePush(); setPushOn(true); setPushMsg('알림을 켰어요. 다음 평일 아침부터 와요.') } catch (e) { setPushMsg((e as Error).message) } finally { setPushBusy(false) } }}>{pushBusy ? '켜는 중…' : '🔔 알림 켜기'}</button>}
        </div>
        <p className={`muted ${pushMsg && !pushOn ? 'err' : ''}`}>{pushOn ? '✅ 이 기기에서 알림을 받고 있어요.' : !pushSupported() ? '이 브라우저는 푸시 알림을 지원하지 않아요.' : ''} {pushMsg}</p>
      </section>

      <section>
        <h3 className="sh">🔁 기기 동기화</h3>
        <p className="muted">GitHub 비공개 저장소에 업무·설정을 저장해서 아이패드·휴대폰·PC가 같은 내용을 보게 해요. 앱을 켤 때, 바꾼 뒤 2초 뒤, 1분마다 자동으로 맞춰요. 같은 저장소와 토큰을 각 기기에 한 번씩 넣어 주세요.</p>
        <div className="syncform">
          <input value={syncRepo} onChange={(e) => setSyncRepo(e.target.value)} placeholder="저장소 이름 (예: 내아이디/mini-office-data)" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <input value={syncToken} onChange={(e) => setSyncToken(e.target.value)} type="password" placeholder={sync.hasToken ? '토큰 저장됨 (바꿀 때만 입력)' : 'GitHub 토큰'} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </div>
        <div className="btnrow">
          <button className="primary" disabled={!syncRepo.trim() || (!syncToken.trim() && !sync.hasToken)} onClick={() => { setSyncConfig(syncRepo, syncToken); setSyncToken(''); syncRequest() }}>저장하고 동기화</button>
          <button className="ghost" disabled={sync.state === 'off' || sync.state === 'syncing'} onClick={() => syncRequest()}>지금 동기화</button>
          {sync.state !== 'off' && <button className="ghost" onClick={() => { clearSyncConfig(); setSyncRepo(''); setSyncToken('') }}>해제</button>}
        </div>
        <p className={`muted ${sync.state === 'error' ? 'err' : ''}`}>
          {sync.state === 'off' && '아직 연결하지 않았어요.'}
          {sync.state === 'idle' && '연결 정보를 저장했어요.'}
          {sync.state === 'syncing' && '동기화하는 중…'}
          {sync.state === 'ok' && `✅ 동기화됐어요 (${new Date(sync.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`}
          {sync.state === 'error' && `⚠️ ${sync.text}`}
        </p>
      </section>

      <section>
        <h3 className="sh">🛟 자동 백업 (이 기기)</h3>
        <p className="muted">업무가 바뀌면 30분에 한 번, 지우거나 리셋·복원하기 직전에는 꼭 한 번씩 이 기기에 저장해 둬요. 최근 12개까지 보관해요. 브라우저 데이터를 지우면 함께 사라지니 파일 백업도 가끔 하세요.</p>
        <button className="ghost" onClick={() => { takeSnapshot(tasks, settings, '직접 저장', true); setSnaps(listSnapshots()) }}>지금 한 번 저장</button>
        {snaps.length === 0 ? <p className="muted">아직 자동 백업이 없어요.</p> : (
          <ul className="snaplist">
            {snaps.map((sn) => (
              <li key={sn.at}>
                <span><b>{new Date(sn.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</b> · 업무 {sn.tasks.length}건<small> · {sn.reason}</small></span>
                <button className="ghost sm" onClick={async () => {
                  if (!window.confirm(`${new Date(sn.at).toLocaleString('ko-KR')} 상태로 되돌릴까요?\n지금 상태는 자동 백업에 한 번 더 남겨 둬요.`)) return
                  takeSnapshot(tasks, settings, '되돌리기 전', true)
                  if (await onReplace(sn.tasks, { ...sn.settings, theme: settings.theme, skin: settings.skin, backdrop: settings.backdrop })) { say(true, `업무 ${sn.tasks.length}건으로 되돌렸어요.`); setSnaps(listSnapshots()) }
                }}>되돌리기</button>
              </li>
            ))}
          </ul>
        )}
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
        <p className="muted">이름을 눌러서 바꿀 수 있어요. 최대 6글자예요.</p>
        <div className="namecards">
          {AVATARS.map((a) => (
            <label key={a.id} className="namecard">
              <img src={asset(`avatars/${a.id}-stand.webp`)} alt="" />
              <span className="nc-body">
                <small className="nc-role">{a.role}</small>
                <input value={settings.names[a.id] ?? a.name} maxLength={6} placeholder={defaultName(a.id)} onChange={(e) => setName(a.id, e.target.value)} aria-label={`${a.role} 이름`} />
              </span>
              <span className="nc-edit" aria-hidden>✎</span>
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
