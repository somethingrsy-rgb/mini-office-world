import { useCallback, useEffect, useRef, useState } from 'react'
import { dbDelete, dbGetAll, dbPut, dbReplaceAll } from './db'
import type { Task } from './types'
import { stampWork } from './worktime'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const ref = useRef<Task[]>([]) // 가장 최근 업무 목록 (연달아 저장해도 이전 상태를 정확히 알기 위해)

  useEffect(() => {
    dbGetAll()
      .then((t) => {
        // 이 기능이 생기기 전부터 '진행 중'이던 업무는 지금부터 시간을 세요
        const fixed = t.map((x) => (x.status === 'doing' && !x.startedAt ? { ...x, startedAt: Date.now(), workedMs: x.workedMs ?? 0 } : x))
        fixed.forEach((x, i) => { if (x !== t[i]) dbPut(x).catch(() => {}) })
        ref.current = fixed
        setTasks(fixed)
      })
      .catch(() => setStorageError(true))
      .finally(() => setReady(true))
    // 브라우저가 저장소를 임의로 지우지 않도록 요청 (지원되는 경우)
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const save = useCallback((input: Task) => {
    const prevTask = ref.current.find((t) => t.id === input.id)
    const task = stampWork(prevTask, input) // 진행 시작·대기·완료에 맞춰 일한 시간을 갱신
    ref.current = prevTask ? ref.current.map((t) => (t.id === task.id ? task : t)) : [...ref.current, task]
    setTasks(ref.current)
    dbPut(task).catch(() => setStorageError(true))
  }, [])

  const remove = useCallback((id: string) => {
    ref.current = ref.current.filter((t) => t.id !== id)
    setTasks(ref.current)
    dbDelete(id).catch(() => setStorageError(true))
  }, [])

  /** 백업 복원·초기화용: 업무를 통째로 바꿈 (저장 실패 시 false) */
  const replaceAll = useCallback(async (next: Task[]) => {
    try {
      await dbReplaceAll(next)
      ref.current = next
      setTasks(next)
      return true
    } catch {
      setStorageError(true)
      return false
    }
  }, [])

  return { tasks, ready, storageError, save, remove, replaceAll }
}
