import { Fragment } from 'react'
import { asset } from '../assets'

/** 글 속의 ⟦아바타id⟧ 표시를 그 아바타의 담당 업무 아이콘(국회·예산·법·민원) 그림으로 바꿔 보여 줘요 */
const TOKEN = /⟦(momo|luna|coco|mimi)⟧/g

export default function RichText({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  text.replace(TOKEN, (m, id: string, offset: number) => {
    if (offset > last) out.push(<Fragment key={`t${offset}`}>{text.slice(last, offset)}</Fragment>)
    out.push(<img key={`i${offset}`} className="emo" src={asset(`ui/role-${id}.webp`)} alt="" />)
    last = offset + m.length
    return m
  })
  if (last < text.length) out.push(<Fragment key="end">{text.slice(last)}</Fragment>)
  return <>{out}</>
}

/** 접근성 이름처럼 그림을 못 쓰는 곳용: 표시를 지워요 */
export const stripTokens = (text: string) => text.replace(TOKEN, '').replace(/\s{2,}/g, ' ').trim()
