import type { PointerEvent } from 'react';
import type { TouchAction } from '../game/core/InputManager';

// 터치 기기용 이동·점프 버튼(CSS의 pointer: coarse에서만 보임). 누르고 있는 동안 입력이 유지되어야
// 하므로 click이 아니라 pointerdown/up을 쓴다. 포인터 캡처로 손가락이 버튼 밖으로 미끄러져도
// 떼는 순간 정확히 해제되고, cancel(스크롤 제스처·시스템 인터럽트)에서도 해제한다.
// 키보드 사용자는 실제 키가 있으므로 탭 순서에서는 뺀다.
const BUTTONS: readonly { action: TouchAction; label: string; symbol: string }[] = [
  { action: 'left', label: '왼쪽으로 이동', symbol: '◀' },
  { action: 'right', label: '오른쪽으로 이동', symbol: '▶' },
  { action: 'jump', label: '점프', symbol: '▲' },
];

export function TouchControls({ onTouch }: { onTouch: (action: TouchAction, pressed: boolean) => void }) {
  const press = (action: TouchAction) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); // 롱프레스 텍스트 선택·더블탭 확대 방지
    event.currentTarget.setPointerCapture(event.pointerId);
    onTouch(action, true);
  };
  const release = (action: TouchAction) => () => onTouch(action, false);
  return (
    <div className="touch-controls">
      {BUTTONS.map(({ action, label, symbol }) => (
        <button
          key={action}
          type="button"
          tabIndex={-1}
          aria-label={label}
          className={`touch-${action}`}
          onPointerDown={press(action)}
          onPointerUp={release(action)}
          onPointerCancel={release(action)}
          onLostPointerCapture={release(action)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
