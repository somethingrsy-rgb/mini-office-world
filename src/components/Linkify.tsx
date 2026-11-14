import type { ReactNode } from 'react'

// http(s):// 로 시작하거나 www. 로 시작하는 주소. 띄어쓰기·줄바꿈에서 끝나요
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"'“”‘’]+)/gi

/** 주소 끝에 붙은 문장부호(. , ) ] ! ? 등)는 링크에서 빼요 */
function splitTrailing(raw: string): [string, string] {
  const m = raw.match(/[.,;:!?)\]}>」』]+$/)
  if (!m) return [raw, '']
  // 주소 안에 여는 괄호가 있는 경우(위키 주소 등)에는 닫는 괄호를 살려요
  let url = raw.slice(0, raw.length - m[0].length)
  let tail = m[0]
  while (tail.startsWith(')') && (url.match(/\(/g)?.length ?? 0) > (url.match(/\)/g)?.length ?? 0)) { url += ')'; tail = tail.slice(1) }
  return [url, tail]
}

/** http·https 주소만 링크로 만들어요 (javascript: 같은 위험한 주소는 만들지 않아요) */
const toHref = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

/** 글 속의 인터넷 주소를 눌러서 열 수 있는 링크로 바꿔 보여 줘요 */
export default function Linkify({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  text.replace(URL_RE, (match, _g, offset: number) => {
    if (offset > last) parts.push(text.slice(last, offset))
    const [url, tail] = splitTrailing(match)
    parts.push(
      <a key={offset} className="link" href={toHref(url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {url}
      </a>,
    )
    if (tail) parts.push(tail)
    last = offset + match.length
    return match
  })
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
