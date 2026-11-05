---
name: implement-feature
description: 프로젝트의 명세·테스트·리뷰 인계 절차에 따라 범위가 정해진 게임플레이 기능 하나를 구현합니다.
---
# 게임플레이 기능 구현
1. AGENTS.md와 관련 문서(`docs/game-design.md`, `docs/traps-spec.md`, `docs/physics-spec.md`, `docs/architecture.md`)를 읽습니다. 명세와 요청이 충돌하면 구현 전에 보고하고 결정을 받습니다.
2. 완료 기준과 영향을 받는 모듈을 나열합니다. 크면 PR 여러 개로 나누고 순서를 알립니다.
3. `master`에서 기능 브랜치를 만듭니다.
4. 대표적인 경계 사례를 포함해 테스트를 추가하거나 갱신합니다. 영역별로 이 프로젝트의 도구를 씁니다:
   - 함정·레벨: `tests/unit/world/solution.ts`의 `playSolution`(스폰·체크포인트에서 실제 입력으로 완주), 레벨 4는 `tolerance.ts`의 `jumpSlack`(점프 여유 6프레임 이상)
   - 렌더링: `tests/unit/rendering/recorder.ts`로 그린 결과를 1px 격자로 비교(위장 함정은 진짜와 픽셀 단위로 같음)
   - 입력: `InputManager`에 읽기 함수를 바꿔 끼워 흉내 냄
5. 기준을 충족하는 최소한의 해결책을 구현합니다.
6. 변이 확인: 핵심 줄을 일부러 망가뜨려 새 테스트가 실패하는지 보고 되돌립니다. 결과를 PR에 적습니다.
7. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 실행하고, 브라우저 동작이 바뀌면 `pnpm test:e2e`도 실행합니다. 화면이 바뀌면 개발 서버(`.claude/launch.json`의 `trap-platformer-dev`)에서 캡처해 확인합니다. 실행하지 않은 명령은 통과했다고 쓰지 않습니다.
8. 관련 문서(`docs/`, 필요하면 README)를 함께 고치고, 한국어 PR(요약·주요 변경·테스트와 변이 확인·위험과 한계·재현 방법)을 엽니다. Codex 리뷰 인계 파일은 `codex-review-request` 스킬로 만듭니다. 병합은 프로젝트 오너가 요청할 때만 합니다.
범위가 정해진 게임 기능을 요청받았을 때 사용합니다. 프로젝트 결정을 우회하거나 누락된 게임플레이 규칙을 임의로 만드는 데 사용하지 않습니다.
