import { newId, type Assignee, type Importance, type Status, type SubTask, type Task } from './types'
import { sanitizeSettings, type Settings } from './settings'

export const BACKUP_APP = 'mini-office-world'

export interface BackupFile {
  app: typeof BACKUP_APP
  version: 1
  exportedAt: string
  tasks: Task[]
  settings: Settings
}

export const makeBackup = (tasks: Task[], settings: Settings): BackupFile => ({
  app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), tasks, settings,
})

const STAFF = ['momo', 'luna', 'coco', 'mimi', 'kiki']
const asAssignee = (v: unknown): Assignee => (typeof v === 'string' && STAFF.includes(v) ? (v as Assignee) : null)
const asDate = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const asStr = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const asTime = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function cleanSub(raw: unknown): SubTask | null {
  const s = raw as Partial<SubTask>
  if (!s || typeof s !== 'object' || !asStr(s.title, 200).trim()) return null
  return { id: asStr(s.id, 80) || newId(), title: asStr(s.title, 200), due: asDate(s.due), assignee: asAssignee(s.assignee), done: !!s.done, doneAt: asTime(s.doneAt) }
}

function cleanTask(raw: unknown): Task | null {
  const t = raw as Partial<Task>
  if (!t || typeof t !== 'object' || !asStr(t.title, 200).trim()) return null
  const importance: Importance = t.importance === 'high' || t.importance === 'low' ? t.importance : 'normal'
  const status: Status = t.status === 'doing' || t.status === 'done' ? t.status : 'todo'
  return {
    id: asStr(t.id, 80) || newId(),
    title: asStr(t.title, 200),
    desc: asStr(t.desc, 5000),
    due: asDate(t.due),
    importance,
    status,
    assignee: asAssignee(t.assignee),
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(cleanSub).filter((s): s is SubTask => !!s) : [],
    createdAt: asTime(t.createdAt) ?? Date.now(),
    completedAt: status === 'done' ? asTime(t.completedAt) ?? Date.now() : null,
    startedAt: status === 'doing' ? asTime(t.startedAt) ?? Date.now() : null,
    workedMs: Math.max(0, asTime(t.workedMs) ?? 0),
    ...(asTime(t.updatedAt) ? { updatedAt: asTime(t.updatedAt)! } : {}),
  }
}

/** 백업 파일 내용을 검사해 업무·설정을 돌려줌. 형식이 맞지 않으면 Error */
export function parseBackup(text: string): { tasks: Task[]; settings: Settings; skipped: number } {
  let data: Partial<BackupFile>
  try { data = JSON.parse(text) } catch { throw new Error('백업 파일을 읽을 수 없어요. 올바른 파일인지 확인해 주세요.') }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.tasks)) throw new Error('MINI OFFICE WORLD 백업 파일이 아니에요.')
  const tasks: Task[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const raw of data.tasks) {
    const t = cleanTask(raw)
    if (!t) { skipped++; continue }
    if (seen.has(t.id)) t.id = newId()
    seen.add(t.id)
    tasks.push(t)
  }
  return { tasks, settings: sanitizeSettings(data.settings), skipped }
}

export const backupFileName = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `mini-office-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`
}
