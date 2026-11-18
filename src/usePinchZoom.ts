import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

const MIN = 1, MAX = 3
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))

/** 하우스 확대: 손가락 두 개로 벌리고 오므리기(핀치), 트랙패드 핀치(Ctrl+휠), 버튼.
 *  확대하면 stage 안에서 밀어서 움직여요. 세로·가로 화면 모두 같아요 */
export function usePinchZoom(stageRef: RefObject<HTMLElement | null>) {
  const [zoom, setZoomState] = useState(1)
  const zoomRef = useRef(1)
  const base = useRef({ w: 0, h: 0 }) // 확대하지 않았을 때의 하우스 크기
  const [, force] = useState(0)
  const setZoom = (z: number | ((p: number) => number)) => { const n = clamp(typeof z === 'function' ? z(zoomRef.current) : z); zoomRef.current = n; setZoomState(n) }

  // 확대 전 하우스 크기를 기억해 둬요 (확대 중에는 이 크기의 배수로 그려요)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      if (zoomRef.current !== 1) return
      const svg = el.querySelector('svg.house') as SVGElement | null
      if (svg && svg.clientWidth > 50) { base.current = { w: svg.clientWidth, h: svg.clientHeight }; force((n) => n + 1) }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('orientationchange', measure)
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', measure) }
  }, [stageRef])

  // 두 손가락 핀치
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const pts = new Map<number, { x: number; y: number }>()
    let startDist = 0, startZoom = 1
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) { startDist = dist(); startZoom = zoomRef.current }
    }
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2 && startDist > 10) { e.preventDefault(); setZoom(startZoom * (dist() / startDist)) }
    }
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) startDist = 0 }
    // 맥·윈도 트랙패드 핀치(Ctrl+휠)
    const wheel = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); setZoom((z) => z * Math.exp(-e.deltaY * 0.01)) } }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move, { passive: false })
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel) }
  }, [stageRef])

  const zoomed = zoom > 1.001 && base.current.w > 0
  const stageStyle: CSSProperties | undefined = zoomed
    ? { display: 'flex', height: base.current.h, overflow: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', touchAction: 'pan-x pan-y' }
    : { touchAction: 'pan-x pan-y' }
  const houseStyle: CSSProperties | undefined = zoomed
    ? { width: base.current.w * zoom, height: base.current.h * zoom, maxWidth: 'none', maxHeight: 'none', flex: 'none', margin: 'auto' }
    : undefined
  return { zoom, setZoom, stageStyle, houseStyle }
}
