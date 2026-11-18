import { beforeEach, describe, expect, it } from 'vitest'
import { parseDue, parseEventLine, parseQuick, parseQuickLine, parseTime } from '../quick'
import { daysBetween, dueInfo, addDays, startOfWeek } from '../dates'
import { makeBackup, parseBackup } from '../backup'
import { DEFAULT_SETTINGS } from '../settings'
import { route, spreadSpots, getActivity } from '../schedule'
import { listSnapshots, takeSnapshot } from '../autobackup'
import type { Task } from '../types'

const task = (id: string, over: Partial<Task> = {}): Task => ({ id, title: id, desc: '', due: null, importance: 'normal', status: 'todo', assignee: 'momo', subtasks: [], createdAt: 1, completedAt: null, ...over })

describe('빠른 분배 입력', () => {
  it('분류/제목/상세//마감일을 읽어요', () => {
    const e = parseQuickLine('국회/강승규/순익계산//11.25', '2026-11-01')
    expect(e.ok).toBe(true); expect(e.assignee).toBe('momo'); expect(e.title).toBe('강승규'); expect(e.desc).toBe('순익계산'); expect(e.due).toBe('2026-11-25')
  })
  it('주소가 들어간 상세내용이 마감일을 망치지 않아요', () => {
    const e = parseQuickLine('민원/강지원/https://a.com/x/y//11.30', '2026-11-01')
    expect(e.ok).toBe(true); expect(e.desc).toBe('https://a.com/x/y'); expect(e.due).toBe('2026-11-30')
  })
  it('분류가 없으면 오류로 보고 줄바꿈은 여러 건이에요', () => {
    expect(parseQuickLine('ㅇㅇ//11.30').ok).toBe(false)
    expect(parseQuick('예산/가\n법/나').length).toBe(2)
  })
  it('없는 날짜는 null', () => { expect(parseDue('11.31', '2026-11-01')).toBeNull(); expect(parseDue('내일', '2026-11-01')).toBe('2026-11-02') })
})

describe('날짜', () => {
  it('마감 계산', () => {
    expect(daysBetween('2026-11-01', '2026-11-03')).toBe(2)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(dueInfo({ due: '2026-11-01', status: 'todo' }, '2026-11-03').level).toBe('overdue')
    expect(dueInfo({ due: '2026-11-01', status: 'done' }, '2026-11-03').level).toBe('done')
  })
})

describe('빠른 일정 입력', () => {
  it('시간을 여러 형식으로 읽어요', () => {
    expect(parseTime('14:00')).toBe('14:00'); expect(parseTime('9:30')).toBe('09:30'); expect(parseTime('14시')).toBe('14:00')
    expect(parseTime('오후 2시')).toBe('14:00'); expect(parseTime('오전 9시 30분')).toBe('09:30'); expect(parseTime('오후 12시')).toBe('12:00'); expect(parseTime('오전 12시')).toBe('00:00')
    expect(parseTime('25:00')).toBeNull(); expect(parseTime('11.25')).toBeNull()
  })
  it('일정내용/시간/날짜를 읽어요', () => {
    expect(parseEventLine('부서 회의/14:00/11.25', '2026-11-15', '2026-11-01')).toEqual({ title: '부서 회의', date: '2026-11-25', time: '14:00' })
    expect(parseEventLine('점심 약속/오후 12시', '2026-11-15', '2026-11-01')).toEqual({ title: '점심 약속', date: '2026-11-15', time: '12:00' })
    expect(parseEventLine('치과/11.25/오후 3시', '2026-11-15', '2026-11-01')).toEqual({ title: '치과', date: '2026-11-25', time: '15:00' })
    expect(parseEventLine('  ', '2026-11-15')).toBeNull()
  })
  it('읽지 못한 칸은 제목에 남겨요', () => { expect(parseEventLine('자료/https:/a.com//11.25', '2026-11-15', '2026-11-01')?.title).toContain('a.com') })
})

describe('주간 시작', () => {
  it('주는 일요일에 시작해요', () => {
    expect(startOfWeek('2026-11-15')).toBe('2026-11-15') // 일요일
    expect(startOfWeek('2026-11-18')).toBe('2026-11-15') // 수요일
    expect(startOfWeek('2026-11-21')).toBe('2026-11-15') // 토요일
    expect(startOfWeek('2026-11-22')).toBe('2026-11-22')
  })
})

describe('백업 파일', () => {
  it('내보낸 파일을 그대로 다시 읽을 수 있어요', () => {
    const r = parseBackup(JSON.stringify(makeBackup([task('a'), task('b', { status: 'done', completedAt: 5 })], DEFAULT_SETTINGS)))
    expect(r.tasks.map((t) => t.id)).toEqual(['a', 'b']); expect(r.skipped).toBe(0)
  })
  it('엉뚱한 파일은 거절해요', () => {
    expect(() => parseBackup('{"a":1}')).toThrow(); expect(() => parseBackup('깨진 파일')).toThrow()
  })
})

describe('아바타 이동·자리', () => {
  it('접수실 벽(347)으로는 층을 오르내리지 않아요', () => {
    const pts = route({ x: 200, y: 1002 }, { x: 300, y: 690 })
    expect(pts.some((p) => p.x === 347)).toBe(false); expect(pts.some((p) => p.x === 662)).toBe(true)
  })
  it('쉬는 아바타 5명은 서로 겹치지 않아요', () => {
    const ids = ['momo', 'luna', 'coco', 'mimi', 'kiki', 'user'] as const
    const acts = Object.fromEntries(ids.map((id) => [id, getActivity(id, 600, null, undefined, null, true, 0)])) as Record<(typeof ids)[number], ReturnType<typeof getActivity>>
    const out = spreadSpots(acts)
    const xs = ids.filter((i) => i !== 'user' && out[i].spot.y < 550).map((i) => out[i].spot.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(60)
  })
  it('눌러서 같은 자리로 보내거나 결과 확인 칸에 모여도 서로 겹치지 않아요', () => {
    const ids = ['momo', 'luna', 'coco', 'mimi', 'kiki', 'user'] as const
    const mk = (over: Record<string, unknown>) => Object.fromEntries(ids.map((id) => [id, { ...getActivity(id, 600, null, undefined, null, true, 0), ...over }])) as Record<(typeof ids)[number], ReturnType<typeof getActivity>>
    for (const acts of [mk({ spot: { x: 500, y: 690, face: 'r' }, pose: 'stand' }), mk({ event: 'finish' })]) {
      const fin = Object.fromEntries(ids.map((id) => [id, { ...acts[id], spot: id === 'user' ? acts[id].spot : { ...acts[id].spot, x: 800, y: 1002 } }])) as typeof acts
      const out = spreadSpots(fin)
      const pts = ids.filter((i) => i !== 'user').map((i) => out[i].spot)
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const near = Math.abs(pts[i].y - pts[j].y) < 26 && Math.abs(pts[i].x - pts[j].x) < 65
        expect(near).toBe(false)
      }
    }
  })
  it('대기 중에는 정원(바깥)으로 나가지 않아요', () => {
    for (const slot of Array.from({ length: 60 }, (_, i) => i * 4)) for (const id of ['momo', 'luna', 'coco', 'mimi', 'kiki'] as const) {
      expect(getActivity(id, 600, null, undefined, null, true, slot).spot.y).toBeLessThan(550)
    }
  })
})

describe('자동 백업', () => {
  beforeEach(() => { const m = new Map<string, string>(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } })
  it('같은 내용은 다시 저장하지 않고, 30분 안에는 건너뛰어요', () => {
    expect(takeSnapshot([task('a')], DEFAULT_SETTINGS, '자동', false, 1000)).toBe(true)
    expect(takeSnapshot([task('a')], DEFAULT_SETTINGS, '자동', false, 99999999)).toBe(false)
    expect(takeSnapshot([task('a'), task('b')], DEFAULT_SETTINGS, '자동', false, 2000)).toBe(false)
    expect(takeSnapshot([task('a'), task('b')], DEFAULT_SETTINGS, '자동', true, 2000)).toBe(true)
  })
  it('빈 상태는 자동으로 남기지 않아 좋은 백업을 밀어내지 않아요', () => {
    takeSnapshot([task('a')], DEFAULT_SETTINGS, '자동', false, 1000)
    expect(takeSnapshot([], DEFAULT_SETTINGS, '자동', false, 9e9)).toBe(false); expect(listSnapshots()[0].tasks.length).toBe(1)
  })
  it('최대 12개만 보관해요', () => {
    for (let i = 0; i < 20; i++) takeSnapshot([task('t' + i)], DEFAULT_SETTINGS, 'x', true, i)
    expect(listSnapshots().length).toBe(12); expect(listSnapshots()[0].tasks[0].id).toBe('t19')
  })
})
