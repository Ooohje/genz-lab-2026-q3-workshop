import { Component } from 'react'
import { clearSession } from '../lib/session'

/**
 * 행사장에서 하얀 화면만은 피한다.
 *
 * 참여자는 개발자도구를 못 열고 진행자에게 "안 돼요"라고만 말할 수 있다.
 * 무슨 일이 났는지 화면에 보여주고, 스스로 복구할 버튼을 준다.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[GenZLab] 화면 오류', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-[20px] bg-surface p-[24px] text-center">
        <span className="text-[48px]">😵</span>
        <h1 className="text-[24px] font-bold text-ink">화면에 문제가 생겼어요</h1>
        <p className="max-w-[300px] text-[13px] leading-[1.6] text-muted">
          아래 버튼을 눌러 다시 불러오세요. 진행 상황은 서버에 저장돼 있어 그대로 이어집니다.
        </p>

        <div className="flex w-full max-w-[300px] flex-col gap-[10px]">
          <button
            onClick={() => window.location.reload()}
            className="h-[56px] rounded-cta bg-brand text-[17px] font-bold text-white"
          >
            다시 불러오기
          </button>
          <button
            onClick={() => { clearSession(); window.location.reload() }}
            className="h-[56px] rounded-cta border-2 border-line bg-white text-[17px] font-bold text-muted"
          >
            처음부터 다시 로그인
          </button>
        </div>

        <p className="num max-w-[300px] break-words text-[11px] text-muted">
          {String(this.state.error?.message ?? this.state.error)}
        </p>
      </div>
    )
  }
}
