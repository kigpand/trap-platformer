---
paths:
  - "src/game/world/level.ts"
  - "tests/unit/world/Level*.test.ts"
  - "tests/unit/world/LevelRules.test.ts"
  - "tests/unit/world/*Solution.ts"
  - "tests/unit/world/solution.ts"
  - "tests/unit/world/tolerance.ts"
---
# 레벨 배치 지침
- 배치 전에 `docs/physics-spec.md`의 "레벨 배치 제약"(최대 점프 높이 81.375px, 단차 보조 없음 등)과 `docs/traps-spec.md`의 해당 함정 배치 제약을 확인합니다.
- 간격·높이를 넘을 수 있는지 수치로 추론하지 않습니다. `tests/unit/world/solution.ts`의 `playSolution`으로 스폰과 각 체크포인트에서 실제 입력으로 끝까지 가는 해법 테스트를 갱신해 확인합니다(좌표로 옮기는 테스트는 배치 결함을 놓칩니다).
- 함정 구간을 추가하면 "아무 생각 없이 하면 당하는지"(그 함정이 사망 원인이 되는지)도 테스트합니다(`Level4.test.ts`의 `naive` 패턴).
- 레벨 4는 해법의 점프마다 일찍·늦게 6프레임 이상의 여유를 `tolerance.ts`의 `jumpSlack`으로 보장합니다. 바꾼 점프 뒤로 해법 끝까지 확인하므로, 측정 범위·제한 시간을 줄이지 않습니다.
- 모든 레벨에 걸친 배치 규칙(재시작 화면 안의 가짜 안전지대, 돌덩이 생성 거리, 가짜 벽 높이, 착지 예측 가시 궤적, 떨어지는 천장 트리거 거리 등)은 `LevelRules.test.ts`가 확인합니다. 새 공통 규칙은 이 파일에 추가합니다.
- 배치를 바꾸면 `docs/game-design.md`의 레벨 설명과 `docs/traps-spec.md`의 배치 기록도 함께 고칩니다. 명세와 충돌하면 규칙을 조용히 바꾸지 말고 보고합니다.
