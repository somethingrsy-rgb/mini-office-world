import { useEffect, useRef, useState } from 'react'

const HOLD_MS = 450 // 꾹 누르는 시간
const MOVE_CANCEL = 10 // 누르는 동안 이만큼 움직이면 스크롤로 보고 취소(px)

/**
 * 목록의 줄을 꾹 눌렀다가 위아래로 끌어서 순서를 바꾸는 기능.
 * ids: 지금 화면에 보이는 순서의 줄 id들 · onOrder: 놓았을 때 바뀐 순서를 돌려줘요
 */
export function useReorder(ids: string[], onOrder: (next: string[]) => void) {
  const rows = useRef<Record<string, HTMLElement | null>>({})
  const [drag, setDrag] = useState<{ id: string; dy: number; to: number } | null>(null)
  const idsRef = useRef(ids)
  idsRef.current = ids
  const onOrderRef = useRef(onOrder)
  onOrderRef.current = onOrder
  const finish = useRef<(commit: boolean) => void>(() => {})
  useEffect(() => () => finish.current(false), [])

  const setRow = (id: string) => (el: HTMLElement | null) => { rows.current[id] = el }

  const down = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 항상 위 작은 창처럼 다른 창에 있는 줄이면 그 창에 이벤트를 걸어요
    const win: Window = (e.currentTarget as HTMLElement).ownerDocument.defaultView ?? window
    const list = idsRef.current
    const from = list.indexOf(id)
    // 눌렀을 때의 각 줄 위치 (끌어도 줄은 DOM에서 옮기지 않고 transform만 바꿔요 → 손가락 추적이 끊기지 않아요)
    const rects = list.map((x) => {
      const r = rows.current[x]!.getBoundingClientRect()
      return { top: r.top, h: r.height, mid: r.top + r.height / 2 }
    })
    const sx = e.clientX, sy = e.clientY
    let active = false
    let to = from
    const hold = window.setTimeout(() => {
      active = true
      navigator.vibrate?.(15)
      setDrag({ id, dy: 0, to })
    }, HOLD_MS)

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVE_CANCEL) end(false)
        return
      }
      const dy = ev.clientY - sy
      const mid = rects[from].mid + dy
      to = 0
      for (let j = 0; j < rects.length; j++) if (j !== from && rects[j].mid < mid) to++
      setDrag({ id, dy, to })
    }
    const block = (ev: TouchEvent) => { if (active) ev.preventDefault() } // 끄는 동안 화면이 스크롤되지 않게
    const up = () => end(true)
    const cancel = () => end(false)
    function end(commit: boolean) {
      window.clearTimeout(hold)
      win.removeEventListener('pointermove', move)
      win.removeEventListener('pointerup', up)
      win.removeEventListener('pointercancel', cancel)
      win.removeEventListener('touchmove', block)
      finish.current = () => {}
      if (active && commit && to !== from) {
        const next = list.filter((x) => x !== id)
        next.splice(to, 0, id)
        onOrderRef.current(next)
      }
      active = false
      setDrag(null)
    }
    finish.current = end
    win.addEventListener('pointermove', move)
    win.addEventListener('pointerup', up)
    win.addEventListener('pointercancel', cancel)
    win.addEventListener('touchmove', block, { passive: false })
  }

  /** 끄는 중 i번째 줄이 얼마나 밀리는지(px) */
  const shift = (i: number): number => {
    if (!drag) return 0
    const from = ids.indexOf(drag.id)
    if (i === from) return drag.dy
    const h = (rows.current[drag.id]?.getBoundingClientRect().height ?? 60) + 8
    if (from < drag.to && i > from && i <= drag.to) return -h
    if (from > drag.to && i < from && i >= drag.to) return h
    return 0
  }

  return { setRow, down, drag, shift }
}
