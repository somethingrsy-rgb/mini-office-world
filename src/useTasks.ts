import { useCallback, useEffect, useState } from 'react'
import { dbDelete, dbGetAll, dbPut } from './db'
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

  return { tasks, ready, storageError, save, remove }
}
