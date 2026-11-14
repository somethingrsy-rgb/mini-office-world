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
  it('1일 전은 따로 보내지 않아요', () => {
    expect(buildMessages([t('내일', '2026-11-17')], today).map((x: { tag: string }) => x.tag)).toEqual(['brief'])
  })
})
