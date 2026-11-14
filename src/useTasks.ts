import { useCallback, useEffect, useState } from 'react'
import { dbDelete, dbGetAll, dbPut, dbReplaceAll } from './db'
import type { Task } from './types'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    dbGetAll()
      .then((t) => setTasks(t))
      .catch(() => setStorageError(true))
      .finally(() => setReady(true))
    // 브라우저가 저장소를 임의로 지우지 않도록 요청 (지원되는 경우)
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const save = useCallback((task: Task) => {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]))
    dbPut(task).catch(() => setStorageError(true))
  }, [])

  const remove = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    dbDelete(id).catch(() => setStorageError(true))
  }, [])

  /** 백업 복원·초기화용: 업무를 통째로 바꿈 (저장 실패 시 false) */
  const replaceAll = useCallback(async (next: Task[]) => {
    try {
      await dbReplaceAll(next)
      setTasks(next)
      return true
    } catch {
      setStorageError(true)
      return false
    }
  }, [])

  return { tasks, ready, storageError, save, remove, replaceAll }
}
