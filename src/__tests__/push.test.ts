import { describe, expect, it } from 'vitest'
// @ts-expect-error 순수 자바스크립트 모듈(알림 문구)
import { buildMessages } from '../../push-sender/messages.mjs'

const t = (title: string, due: string | null, status = 'todo') => ({ title, due, status })

describe('아침 푸시 문구', () => {
  const today = '2026-11-16'
  it('오늘 마감과 2일 전 마감을 각각 알려요', () => {
    const m = buildMessages([t('예결위', '2026-11-16'), t('법안', '2026-11-18'), t('나중', '2026-12-30'), t('끝난일', '2026-11-16', 'done')], today)
    expect(m.map((x: { tag: string }) => x.tag)).toEqual(['brief', 'due0', 'due2'])
    expect(m[0].body).toContain('남은 업무 3건'); expect(m[1].title).toBe('오늘 마감 1건'); expect(m[1].body).toContain('예결위'); expect(m[2].body).toContain('법안')
  })
  it('기한이 지난 업무는 브리핑에 세어 줘요', () => {
    expect(buildMessages([t('x', '2026-11-10')], today)[0].body).toContain('기한 초과 1건')
  })
  it('남은 업무가 없으면 아무것도 보내지 않아요', () => {
    expect(buildMessages([t('끝', '2026-11-16', 'done')], today)).toEqual([])
    expect(buildMessages([], today)).toEqual([])
  })
  it('내 일정은 업무 건수에 세지 않고 오늘 일정으로만 알려줘요', () => {
    const m = buildMessages([t('업무', null), { title: '회의', due: today, status: 'todo', kind: 'event', time: '14:00' }], today)
    expect(m[0].body).toContain('남은 업무 1건'); expect(m[0].body).toContain('오늘 일정 1건'); expect(m[0].body).toContain('14:00 회의')
    expect(m.map((x: { tag: string }) => x.tag)).toEqual(['brief'])
  })
  it('오늘 일정(시간·제목·장소 메모)을 업무 건수보다 위에 보여줘요', () => {
    const m = buildMessages([t('업무', null), { title: '유엘 병원', desc: '3층 접수\n서류', due: today, status: 'todo', kind: 'event', time: '10:30' }, { title: '점심 약속', due: today, status: 'todo', kind: 'event' }, { title: '내일 일정', due: '2026-11-17', status: 'todo', kind: 'event', time: '09:00' }], today)
    const lines = m[0].body.split('\n')
    expect(m[0].title).toBe('오늘의 일정·업무 브리핑')
    expect(lines[0]).toBe('오늘 일정 2건'); expect(lines[1]).toBe('· 10:30 유엘 병원 · 3층 접수'); expect(lines[2]).toBe('· 점심 약속'); expect(lines[3]).toContain('남은 업무 1건')
    expect(m[0].body).not.toContain('내일 일정')
  })
  it('일정만 있어도 아침 브리핑을 보내요', () => {
    const m = buildMessages([{ title: '치과', due: today, status: 'todo', kind: 'event', time: '15:00' }], today)
    expect(m).toHaveLength(1); expect(m[0].body).toBe('오늘 일정 1건\n· 15:00 치과')
  })
  it('1일 전은 따로 보내지 않아요', () => {
    expect(buildMessages([t('내일', '2026-11-17')], today).map((x: { tag: string }) => x.tag)).toEqual(['brief'])
  })
})
