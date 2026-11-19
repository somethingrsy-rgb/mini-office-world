// 윈도우 목록 한 줄("F0|id:L:T:R:B;...")을 풀고, 전체 화면 상태가 연달아 두 번 같을 때만 바뀐 것으로 쳐요 (깜빡임 방지)
function parseLine(line) {
  const i = line.indexOf('|')
  if (i < 0) return { full: false, segs: line }
  return { full: line[0] === 'F' && line[1] === '1', segs: line.slice(i + 1) }
}
function makeDebounce(onChange, need = 2) {
  let cur = false, cand = false, n = 0
  return (v) => {
    if (v === cur) { n = 0; return }
    if (v !== cand) { cand = v; n = 0 }
    if (++n >= need) { cur = v; n = 0; onChange(cur) }
  }
}
module.exports = { parseLine, makeDebounce }
