# 아키텍처

## 실행 흐름
`GameCanvas (React)` 마운트 -> `GameController`가 캔버스·입력·RAF 연결 -> `World`의 `update`를 고정 시간 간격으로 실행 -> `CanvasRenderer`가 `World`를 그림 -> 값이 변경될 때만 스냅샷 콜백이 React HUD 갱신.

## 모듈
- `game/core/GameController.ts`: 생명주기, 스케줄러, 입력 및 월드 조율. 현재 레벨 번호를 들고, 클리어 후 다음 레벨 요청이 오면 `LEVELS`의 다음 레벨로 새 `World`를 만든다. 레벨별 최고 기록 저장도 맡는다
- `game/core/GameLoop.ts`: 고정 시간 간격 처리를 위한 RAF 누적기와 최대 따라잡기 한도. 렌더 콜백에 디버그용 프레임 지표(FPS, 프레임당 스텝 수)를 함께 전달. update/render 중 예외가 나면 루프를 멈추고 `onError`로 알린다
- `game/core/InputManager.ts`: 키보드 상태와 점프 키를 새로 누르는 순간 감지
- `game/physics/`: 순수 사각형 겹침 판정과 축별 이동 충돌 해소
- `game/entities/Player.ts`: 플레이어 상태와 갱신 함수
- `game/entities/Enemy.ts`: 적 패트롤 상태와 갱신 함수(중력 없는 단순 왕복)
- `game/world/`: 레벨 배치(`level.ts`의 `Level` 타입과 `LEVEL_1` — 크기·스폰·플랫폼·목표·체크포인트·함정(5종)·적을 한 객체로 묶음)와 `World` 상태 갱신(`new World(level)`로 레벨을 받아 시뮬레이션하며, 렌더러는 `world.level`을 그린다. 목표 도달, 위험지대/적 접촉과 사망 원인 표시(`deathCause` — 모든 함정·적, 낙사는 3초 안에 무너진 함정), 하늘에서 쏟아지는 적(등장할 때만 중력, 착지 후 일반 적처럼 왕복), 도망가는 발판·솟아오르는 가시·가짜 체크포인트·도망가는 목표(`World.goal`이 현재 목표 위치를 들고 렌더러가 그것을 그림), 착지 예측 가시(순수 함수 `simulateJump` — 점프 순간 플레이어 상태를 복사해 update와 같은 순서·같은 솔리드 목록으로 궤적을 미리 계산. `World`의 가시 위치와 배치 규칙 테스트가 함께 씀), 가짜 벽·미끼 보물(`World.fakeWalls`·`World.baitGems` — 솔리드가 아닌 미끼, 겹침·획득 상태는 그 목숨 동안만), 따라오는 돌덩이(`World.boulders` — 지형과 상관없이 고정 높이로 굴러가며 솔리드가 아님), 가짜 클리어(`World.fakeClear` — 스냅샷의 cleared·멈춘 시간으로 진짜 클리어처럼 보이고, `GameController`가 다음 레벨 요청을 `collapseFakeFloor()`로 바꾸며 저장 없이 기록 화면만 흉내 냄), 강제 비행(`World.flight` — 날려버리는 점프·스프링 바닥이 좌우 입력 대신 정해진 수평 속도를 넣고 발동 다음 스텝부터의 첫 착지에서 끝남)과 좌우 반전(`World.reverse` — 구역에 처음 겹칠 때 들어온 쪽을 기억해 걸고 반대편으로 빠져나가면 풀림. 입력 소스와 상관없이 `World`가 좌우를 뒤집으므로 터치 버튼도 같이 반전), 사라지는 땅·투명 블록·떨어지는 천장(함정이 만들고 없애는 솔리드는 `dynamicSolids()` 한 목록으로 충돌·지지 확인·천장 착지에 공유), 붕괴 타이머, 갑자기 출현하는 적의 경고·등장, 조건부 트리거의 체류 시간, 체크포인트 기반 재시작 위치 포함)
- `game/rendering/`: 그리기 전용 렌더러. `taunts.ts`는 사망 원인 종류별 놀리는 문구와 죽지 않는 스프링 바닥의 문구(`TauntKind`, 캔버스와 App의 스크린 리더 알림이 함께 씀 — 게임 로직은 문구를 모르고 원인 종류만 내보낸다)
- `game/world/viewport.ts`: 화면 폭과 카메라 위치 계산. 렌더러(그릴 영역)와 `World`(플레이어가 지금 볼 수 있는 영역 판단)가 같은 계산을 써야 해서, 월드가 렌더링에 의존하지 않도록 월드 쪽에 둔다
- `game/audio/SoundPlayer.ts`: Web Audio 오실레이터로 합성한 효과음과 배경 음악 루프(외부 음원 없음), 음소거·음량 상태. 배경 음악은 `GameController`가 매 스텝 `updateMusic(!paused)`로 짧게 앞서 예약하며, 멈출 때는 음악 버스를 페이드아웃해 예약된 음까지 끊는다. `World`는 소리를 모르고 update 중 일어난 일(`WorldEvent`: 점프·사망·체크포인트·클리어)만 기록하며, `GameController`가 `drainEvents()`로 꺼내 재생한다
- `components/`: React 캔버스 마운트와 HUD. 프레임별 물리 처리는 담당하지 않음. `TouchControls`는 터치 기기용 이동·점프 버튼(포인터 캡처로 누름/뗌을 추적해 `InputManager.setTouch`로 전달). `ErrorBoundary`는 렌더 오류와 게임 루프 오류(`GameCanvas`가 렌더 단계로 다시 던진 것)를 잡아 복구 안내와 "다시 시작"(하위 트리 재마운트)을 보여줌

## 의존성 방향
`React -> GameController -> World / Physics / Renderer` 구조이며, 물리 로직은 렌더링에 의존하지 않습니다. 월드와 물리 로직은 TypeScript만 사용합니다. `GameController`가 브라우저 의존 API를 조율합니다.

## 결정 사항
- MVP에는 Canvas 2D를 사용하며, Phaser/Three.js는 사용하지 않습니다.
- 시뮬레이션은 고정 60 Hz로 실행하고 RAF마다 한 번 렌더링합니다.
- ECS나 이벤트 버스 추상화를 도입하기 전에 모듈과 함수를 직접 사용합니다.
- 공유 패키지에 대한 구체적인 필요가 생기기 전까지 모노레포를 도입하지 않습니다.
