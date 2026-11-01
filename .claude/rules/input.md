---
paths:
  - "src/game/core/InputManager.ts"
  - "src/components/TouchControls.tsx"
  - "tests/unit/core/InputManager.test.ts"
---
# 입력 지침
- 점프·재시작·일시정지 등 동작은 새로 누르는 순간에 한 번만 발생합니다(키 반복·버튼 유지로 다시 발생하지 않음).
- 키보드·터치·게임패드는 같은 결과(`consume()`)로 합치되, 한 입력 소스를 떼도 다른 소스의 입력이 풀리지 않게 합니다.
- 창 포커스를 잃거나 탭이 숨으면(`blur`, `visibilitychange`) 눌린 입력을 비웁니다. 게임패드는 이벤트 대신 상태를 읽으므로, 그 뒤에도 쥐고 있던 버튼이 다시 발생하지 않게 직전 상태를 유지합니다.
- 연결이 끊긴 게임패드의 입력은 바로 풀립니다. 버튼 번호는 표준 배치(standard mapping) 기준입니다.
- 브라우저 단축키(Ctrl/Cmd 조합)와 포커스된 버튼의 Space 활성화는 가로채지 않습니다.
- 리스너는 `dispose()`에서 모두 해제합니다. 브라우저 API는 생성자 인자로 바꿔 끼울 수 있게 해 단위 테스트에서 흉내 냅니다.
