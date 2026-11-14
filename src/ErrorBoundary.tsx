import { Component, type ReactNode } from 'react'
import { dbGetAll } from './db'
import { listSnapshots } from './autobackup'

/** 화면에서 예상치 못한 오류가 나도 하얀 화면 대신 안내를 보여 주고, 데이터를 파일로 꺼낼 수 있게 해요 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; saved: string }> {
  state = { error: null as Error | null, saved: '' }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error(error) }

  save = async () => {
    try {
      let tasks: unknown[] = []
      try { tasks = await dbGetAll() } catch { tasks = listSnapshots()[0]?.tasks ?? [] }
      const blob = new Blob([JSON.stringify({ app: 'mini-office-world', version: 1, exportedAt: new Date().toISOString(), tasks, settings: {} }, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `mini-office-rescue-${new Date().toISOString().slice(0, 10)}.json`
      a.click(); URL.revokeObjectURL(a.href)
      this.setState({ saved: `업무 ${tasks.length}건을 파일로 저장했어요.` })
    } catch { this.setState({ saved: '파일로 저장하지 못했어요.' }) }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>앗, 문제가 생겼어요 😢</h1>
        <p>등록한 업무는 이 기기에 그대로 남아 있어요. 아래 순서로 해 보세요.</p>
        <button onClick={() => location.reload()}>1. 앱 다시 열기</button>
        <button onClick={this.save}>2. 업무를 파일로 저장해 두기</button>
        <button onClick={async () => { try { (await navigator.serviceWorker?.getRegistrations())?.forEach((r) => r.unregister()); (await caches?.keys())?.forEach((k) => caches.delete(k)) } catch { /* 무시 */ } location.reload() }}>3. 앱 파일 새로 받기</button>
        {this.state.saved && <p className="ok">{this.state.saved}</p>}
        <small>{this.state.error.message}</small>
      </div>
    )
  }
}
