# 아키텍처

## 실행 흐름
`GameCanvas (React)` 마운트 -> `GameController`가 캔버스·입력·RAF 연결 -> `World`의 `update`를 고정 시간 간격으로 실행 -> `CanvasRenderer`가 `World`를 그림 -> 값이 변경될 때만 스냅샷 콜백이 React HUD 갱신.

## 모듈
- `game/core/GameController.ts`: 생명주기, 스케줄러, 입력 및 월드 조율. 현재 레벨 번호를 들고, 클리어 후 다음 레벨 요청이 오면 `LEVELS`의 다음 레벨로 새 `World`를 만든다. 레벨별 최고 기록 저장도 맡는다
- `game/core/GameLoop.ts`: 고정 시간 간격 처리를 위한 RAF 누적기와 최대 따라잡기 한도. 렌더 콜백에 디버그용 프레임 지표(FPS, 프레임당 스텝 수)를 함께 전달. update/render 중 예외가 나면 루프를 멈추고 `onError`로 알린다
- `game/core/InputManager.ts`: 키보드 상태와 점프 키를 새로 누르는 순간 감지. 게임패드는 이벤트 대신 `consume()`마다 `navigator.getGamepads()`를 읽어(표준 배치 버튼 번호) 패드별 직전 버튼 상태와 비교해 새로 누른 순간만 잡고, 끊긴 패드의 상태는 버림(읽기 함수는 테스트에서 바꿔 끼움)
- `game/physics/`: 순수 사각형 겹침 판정과 축별 이동 충돌 해소
- `game/entities/Player.ts`: 플레이어 상태와 갱신 함수
- `game/entities/Enemy.ts`: 적 패트롤 상태와 갱신 함수(중력 없는 단순 왕복)
- `game/world/`: 레벨 데이터와 시뮬레이션. 함정 하나하나의 동작은 `docs/traps-spec.md`, 레벨 구성은 `docs/game-design.md`가 기준이다.
  - `level.ts`: `Level` 타입과 `LEVEL_1`~`LEVEL_4`, 진행 순서 `LEVELS`. 레벨 하나의 크기·스폰·지형·목표·체크포인트·함정 30종·적 배치를 한 객체로 묶는다(레벨을 늘릴 때 전역 상수를 바꾸지 않고 객체를 하나 더 만든다). 레벨은 `levelData.ts`의 `defineLevel(data)`로 만들어, 쓰지 않는 함정·지형지물 목록은 적지 않는다(빈 목록으로 채워짐). 지형지물(`pipes` 파이프, `hills` 계단식 언덕, 움직임을 바꾸는 `trampolines`·`conveyors`·`mudFloors`·`windZones`, 한쪽 통과 발판 `oneWayPlatforms`)도 여기 두며, `staticSolids(level)`가 바닥·블록·파이프·언덕 기둥(`hillColumns`)을 움직이지 않는 지형 하나로 합친다.
  - `World.ts`: `new World(level)`로 레벨을 받아 고정 스텝마다 `update`한다. `update`는 순서가 정해진 일곱 단계(`tickTimers` → `updateCollapses` → `applyInput` → `moveAndLand` → `updateTraps` → `saveCheckpoints` → `resolveOutcome`)를 차례로 부르고(`updateTraps`는 다시 함정 무리별 메서드 아홉 개를 정해진 순서로 부른다 — 같은 스텝 안에서 뒤 함정이 앞 함정의 결과를 보므로 순서가 동작의 일부다), 목숨마다 새로 만드는 함정·적 상태는 생성자와 `reset()`이 같은 `createLifeState(level)`로 만든다(새 함정 상태는 `LifeState`에 더한다). 렌더러는 `world.level`과 `World`의 상태를 읽기만 한다. 충돌·지지 확인은 `world.terrain`(= `staticSolids(level)`)과 `dynamicSolids()`를 함께 쓴다.
    - 상태: 플레이어, 적, 함정마다의 상태 목록(`World.vanishingGrounds`, `World.shadows` 등), 현재 목표 위치(`World.goal`), 목숨마다 새로 세는 시간(`World.lifeTime`), 체크포인트 재시작 위치.
    - 함정이 만들고 없애는 솔리드는 `dynamicSolids()` 한 목록으로 충돌·지지 확인·천장 착지에 함께 쓴다. 이동 규칙을 바꾸는 함정(얼음·무거운 신발·강제 비행 `World.flight`·좌우 반전 `World.reverse`)은 `World.update`에서 그 구역 안에서만 적용한다 — 입력 소스와 상관없이 같은 규칙이 걸린다.
    - 사망 원인 표시(`deathCause`): 함정·적에 당하면 원인 영역을, 낙사는 3초 안에 무너진 함정을 기억해 렌더러가 경고색으로 그린다.
    - 착지 예측 가시는 순수 함수 `simulateJump`로 궤적을 미리 계산한다(`World`와 배치 규칙 테스트가 함께 씀). 박자 발판의 켜짐 계산 `rhythmPhase`는 렌더러와 공유한다.
    - 가짜 클리어(`World.fakeClear`)는 스냅샷으로 진짜 클리어처럼 보이고, `GameController`가 다음 레벨 요청을 `collapseFakeFloor()`로 바꾼다.
    - 소리를 모르고 일어난 일만 기록한다(아래 `game/audio/`).
- `game/rendering/`: 그리기 전용. `World`를 바꾸지 않는다(영역 지침 `.claude/rules/rendering.md`).
  - `CanvasRenderer.ts`: 한 프레임을 그리는 순서와 카메라 변환. 길이 방향으로 늘어나는 것은 화면과 겹치는 것만 그린다(`tests/unit/rendering/budget.test.ts`가 프레임당 그리기 양을 묶음). 화면 흔들림·파편은 렌더러만 가진 그림 상태로, `GameController`가 고정 스텝마다 `stepEffects`로 흘린다(일시정지 중 멈춤, `prefers-reduced-motion`이면 흔들지 않음).
  - `terrain.ts`(땅·블록 질감, 파이프 — 언덕은 기둥마다 땅으로 그림), `props.ts`(깃발·목표·가시·표지판), `background.ts`(시차 밤 도시 배경), `Sprites.ts`(플레이어·적 픽셀 스프라이트): 위장 함정과 가짜는 진짜와 같은 함수·같은 프레임으로 그려 같은 자리에서 픽셀 단위로 같다(`terrain.test.ts`·`props.test.ts`).
  - `taunts.ts`: 사망 원인 종류별 놀리는 문구(`TauntKind`). 캔버스와 App의 스크린 리더 알림이 함께 쓰며, 게임 로직은 문구를 모르고 원인 종류만 내보낸다.
- `game/world/viewport.ts`: 화면 폭과 카메라 위치 계산. 렌더러(그릴 영역)와 `World`(플레이어가 지금 볼 수 있는 영역 판단)가 같은 계산을 써야 해서, 월드가 렌더링에 의존하지 않도록 월드 쪽에 둔다
- `game/audio/SoundPlayer.ts`: Web Audio 오실레이터로 합성한 효과음과 배경 음악 루프(외부 음원 없음), 음소거·음량 상태. 배경 음악은 `GameController`가 매 스텝 `updateMusic(!paused)`로 짧게 앞서 예약하며, 멈출 때는 음악 버스를 페이드아웃해 예약된 음까지 끊는다. `World`는 소리를 모르고 update 중 일어난 일(`WorldEvent`: 점프·사망·체크포인트·클리어)과 위치가 있는 함정 이벤트(`TrapEvent`: `{ kind, rect }`)만 기록하며, `GameController`가 `drainEvents()`·`drainTrapEvents()`로 꺼내 재생한다. 함정 이벤트는 화면 밖 소리 규칙(`world/viewport.ts`의 `isWithinHearing`, 렌더러와 같은 카메라 계산)으로 거른다
- `components/`: React 캔버스 마운트와 HUD. 프레임별 물리 처리는 담당하지 않음. `TouchControls`는 터치 기기용 이동·점프 버튼(포인터 캡처로 누름/뗌을 추적해 `InputManager.setTouch`로 전달). `ErrorBoundary`는 렌더 오류와 게임 루프 오류(`GameCanvas`가 렌더 단계로 다시 던진 것)를 잡아 복구 안내와 "다시 시작"(하위 트리 재마운트)을 보여줌

## 테스트 구조
- `tests/unit/`: Vitest. 물리·충돌(`physics/`), 함정·적·레벨(`world/`), 그리기(`rendering/`), 입력·루프·생명주기(`core/`), 플레이어·적(`entities/`), 소리(`audio/`), HUD·화면(`App.test.ts`), 검색용 메타데이터(`seo.test.ts`).
- 도우미: `tests/unit/world/fixtures.ts`의 `testLevel`(함정 하나만 둔 작은 레벨)·`standAt`, `solution.ts`의 `playSolution`(스폰·체크포인트에서 실제 입력으로 완주하는 해법 실행), `level1Solution.ts`~`level4Solution.ts`(레벨별 해법 입력 — 레벨 테스트와 `pnpm slack`이 함께 씀), `tolerance.ts`의 `jumpSlack`(해법 점프마다 일찍·늦게 허용 프레임), `tests/unit/rendering/recorder.ts`(fillRect를 1px 격자로 펼쳐 그린 결과 비교).
- `tests/e2e/`: Playwright. 실제 브라우저에서 입력·일시정지·재시작·게임패드(흉내)와 가짜 클리어를 확인한다.

## 의존성 방향
`React -> GameController -> World / Physics / Renderer` 구조이며, 물리 로직은 렌더링에 의존하지 않습니다. 월드와 물리 로직은 TypeScript만 사용합니다. `GameController`가 브라우저 의존 API를 조율합니다.

## 결정 사항
- MVP에는 Canvas 2D를 사용하며, Phaser/Three.js는 사용하지 않습니다.
- 시뮬레이션은 고정 60 Hz로 실행하고 RAF마다 한 번 렌더링합니다.
- ECS나 이벤트 버스 추상화를 도입하기 전에 모듈과 함수를 직접 사용합니다.
- 공유 패키지에 대한 구체적인 필요가 생기기 전까지 모노레포를 도입하지 않습니다.
