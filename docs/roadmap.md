# 로드맵

## 1주 차 — 기반 구축
- [x] Vite + React + TypeScript 프로젝트 골격 구성
- [x] Claude/Codex 공통 지침과 명세
- [x] 최소한의 Canvas 그리기, 입력, 물리, 바닥·천장·벽 충돌
- [x] 충돌 단위 테스트와 Playwright 기본 동작 확인 테스트 템플릿
- [x] 의존성 설치 및 로컬 검증 실행
- [x] 고속 이동 충돌 처리 전략 결정과 테스트 고정 (서브스텝 방식 유지, ADR-0002)
- [x] 디버그 오버레이 및 물리 지표 개선 (FPS, 프레임당 물리 스텝 수, 플레이어 속도 — `GameLoop.ts`/`CanvasRenderer.ts`)

## 2주 차 — 게임플레이
- [x] 목표 지점과 클리어 상태 (`GOAL`, `World.cleared`)
- [x] 중간 체크포인트 (`CHECKPOINTS`, `World.activeCheckpoint` — 사망 시 체크포인트에서 재시작, 수동 재시작(R)은 초기화)
- [x] 함정 5/5종 (`docs/traps-spec.md` 구현 현황 참고 — 조건부 함정 트리거는 "체류" 조건만)
- [x] 적 이동과 충돌

## 3주 차 — 콘텐츠
- [x] 독자적인 완성 레벨 1개 (시작-목표, 함정 5종, 적, 체크포인트 모두 배치 — `src/game/world/level.ts`)
- [ ] 여건이 되면 맵 2–4개 추가
- [x] 독자적인 스프라이트와 프레임 애니메이션 (코드로 정의한 픽셀 스프라이트, 걷기 2프레임 + idle/jump, 좌우 반전 — `game/rendering/Sprites.ts`)
- [ ] 독자적인 효과음·배경 음악과 음소거·음량 설정

## 4주 차 — 완성도 개선 및 출시
- [x] 입력 경계 사례, 브라우저 표시 상태, 일시 정지·재개 (`InputManager.ts`의 P 키·`clearInput()`, `GameController.ts`의 `visibilitychange` 강제 일시정지)
- [x] 성능 분석, 충돌 회귀 테스트 및 E2E 테스트 (`GameLoop.ts`의 프레임 델타 상한·스텝 상한·누적기 리셋 회귀 테스트, 좌/우 벽 충돌 테스트 보강, 재시작 E2E 테스트)
- [ ] 반응형 레이아웃 개선, 접근성, 배포 및 README 데모
