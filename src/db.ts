import type { Task } from './types'

const DB_NAME = 'mini-office-world'
const STORE = 'tasks'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB 미지원'))
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const dbGetAll = () => run<Task[]>('readonly', (s) => s.getAll())
export const dbPut = (t: Task) => run('readwrite', (s) => s.put(t))
export const dbDelete = (id: string) => run('readwrite', (s) => s.delete(id))

export const dbClear = () => run('readwrite', (s) => s.clear())

/** 전체 교체: 기존 업무를 모두 지우고 새 목록을 한 번에 저장 */
export function dbReplaceAll(tasks: Task[]): Promise<void> {
  return open().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const st = tx.objectStore(STORE)
        st.clear()
        tasks.forEach((t) => st.put(t))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}
