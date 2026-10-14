# 아키텍처

## 실행 흐름
`GameCanvas (React)` 마운트 -> `GameController`가 캔버스·입력·RAF 연결 -> `World`의 `update`를 고정 시간 간격으로 실행 -> `CanvasRenderer`가 `World`를 그림 -> 값이 변경될 때만 스냅샷 콜백이 React HUD 갱신.

## 모듈
- `game/core/GameController.ts`: 생명주기, 스케줄러, 입력 및 월드 조율
- `game/core/GameLoop.ts`: 고정 시간 간격 처리를 위한 RAF 누적기와 최대 따라잡기 한도
- `game/core/InputManager.ts`: 키보드 상태와 점프 키를 새로 누르는 순간 감지
- `game/physics/`: 순수 사각형 겹침 판정과 축별 이동 충돌 해소
- `game/entities/Player.ts`: 플레이어 상태와 갱신 함수
- `game/entities/Enemy.ts`: 적 패트롤 상태와 갱신 함수(중력 없는 단순 왕복)
- `game/world/`: 레벨 배치(플랫폼·목표·체크포인트·함정(5종)·적, `level.ts`)와 `World` 상태 갱신(목표 도달, 위험지대/적 접촉, 붕괴 타이머, 갑자기 출현하는 적의 경고·등장, 조건부 트리거의 체류 시간, 체크포인트 기반 재시작 위치 포함)
- `game/rendering/`: 그리기 전용 렌더러와 카메라
- `components/`: React 캔버스 마운트와 HUD. 프레임별 물리 처리는 담당하지 않음

## 의존성 방향
`React -> GameController -> World / Physics / Renderer` 구조이며, 물리 로직은 렌더링에 의존하지 않습니다. 월드와 물리 로직은 TypeScript만 사용합니다. `GameController`가 브라우저 의존 API를 조율합니다.

## 결정 사항
- MVP에는 Canvas 2D를 사용하며, Phaser/Three.js는 사용하지 않습니다.
- 시뮬레이션은 고정 60 Hz로 실행하고 RAF마다 한 번 렌더링합니다.
- ECS나 이벤트 버스 추상화를 도입하기 전에 모듈과 함수를 직접 사용합니다.
- 공유 패키지에 대한 구체적인 필요가 생기기 전까지 모노레포를 도입하지 않습니다.
