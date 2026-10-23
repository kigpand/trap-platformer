import { Component, type ReactNode } from 'react';

// 렌더 오류나 게임 루프 오류(GameCanvas가 렌더 단계로 다시 던진 것)로 흰 화면만 남지 않도록
// 안내와 "다시 시작" 버튼을 보여준다. 다시 시작하면 하위 트리를 새로 마운트해 게임을 처음부터 만든다.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app" role="alert">
        <h1>문제가 발생했습니다</h1>
        <p>게임 실행 중 오류가 발생해 멈췄습니다. 다시 시작해도 반복되면 페이지를 새로고침해 주세요.</p>
        <div className="controls">
          <button type="button" onClick={() => this.setState({ failed: false })}>다시 시작</button>
        </div>
      </main>
    );
  }
}
