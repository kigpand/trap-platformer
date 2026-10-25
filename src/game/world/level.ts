import type { Rect } from '../physics/AABB';
export interface EnemyPatrol { minX: number; maxX: number; y: number }
export interface AmbushEnemy extends EnemyPatrol { trigger: Rect }
export interface ConditionalTrap { zone: Rect }
export interface Checkpoint { zone: Rect; respawnX: number; respawnY: number }
// 떨어지는 천장(docs/traps-spec.md #9): 공중의 블록과, 들어서면 블록이 떨어지는 트리거 영역.
export interface FallingCeiling { block: Rect; trigger: Rect }
// 레벨 하나의 배치 전체. World는 이 객체를 받아 시뮬레이션하고 렌더러는 world.level을 그린다 —
// 레벨을 늘릴 때 전역 상수를 바꾸지 않고 객체를 하나 더 만들면 된다(docs/roadmap.md "새 맵 추가" 릴리스 2번).
export interface Level {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  solids: readonly Rect[];
  goal: Rect;
  hazards: readonly Rect[];
  fallingPlatforms: readonly Rect[];
  hiddenBlocks: readonly Rect[];
  enemies: readonly EnemyPatrol[];
  ambushes: readonly AmbushEnemy[];
  conditionalTraps: readonly ConditionalTrap[];
  checkpoints: readonly Checkpoint[];
  // 함정 확장(docs/traps-spec.md 6~13번). 레벨 1·2는 연장 전까지 비워 둔다(docs/roadmap.md 함정 확장 5번).
  vanishingGrounds: readonly Rect[]; // #6 사라지는 땅: 40px 칸으로 나뉘어 연쇄 붕괴하는 바닥 구간
  invisibleBlocks: readonly Rect[]; // #7 투명 블록
  fallingCeilings: readonly FallingCeiling[]; // #9 떨어지는 천장
}

export const LEVEL_1: Level = {
  width: 1800,
  height: 620,
  spawn: { x: 65, y: 350 },
  // ground1a/ground1b: 숨겨진 블록(hiddenBlocks)이 메우는 틈(300-380)으로 나뉜 시작 구간.
  // ground2: 적·체크포인트·위험지대·gap1 점프 착지 구간. ground3: 낙하 발판 다리 너머, 목표 구간.
  solids: [
    { x: 0, y: 500, width: 300, height: 120 },
    { x: 380, y: 500, width: 140, height: 120 },
    { x: 620, y: 500, width: 570, height: 120 },
    { x: 1290, y: 500, width: 510, height: 120 },
  ],
  goal: { x: 1740, y: 440, width: 40, height: 60 },
  // 가짜 안전지대: 실제 바닥(ground2) 위에 겹쳐진 위장 타일. 걸어서 그대로 도달 가능하며
  // 시각적으로는 일반 바닥과 동일하게 그려짐 (docs/traps-spec.md #4)
  hazards: [{ x: 1060, y: 495, width: 80, height: 25 }],
  // 낙하하는 발판: ground2 가장자리(1190)에서 ground3 방향으로 낮게 이어지는 다리.
  // 최대 점프 높이(약 81px)보다 낮아 ground2 가장자리에서 뛰면 바로 착지한다 (docs/traps-spec.md #2)
  fallingPlatforms: [{ x: 1190, y: 480, width: 150, height: 20 }],
  // 숨겨진 블록: ground1의 틈(300-380)을 완전히 채워 평소엔 일반 바닥과 이음매 없이 동일하다.
  // 점프 없이 걸어서 그대로 접촉하며, 사라지면 진짜 구덩이가 생긴다 (docs/traps-spec.md #1)
  hiddenBlocks: [{ x: 300, y: 500, width: 80, height: 120 }],
  // 적: ground2 위를 왕복. y는 바닥(500)에 발이 닿는 높이(500-28), 위험지대(1060-1140)와 겹치지 않는
  // 구간을 왕복한다 (docs/traps-spec.md 적 충돌 규칙)
  enemies: [{ minX: 700, maxX: 850, y: 472 }],
  // 갑자기 출현하는 적: 트리거 영역(1400-1440) 진입 시 0.3초 경고 후 등장한다. 등장 위치(1550)는
  // 트리거보다 150px 앞이라 전력 질주해도 0.3초 경고보다 먼저 들이닥치지 않는다 (docs/traps-spec.md #3)
  ambushes: [
    { trigger: { x: 1400, y: 440, width: 40, height: 80 }, minX: 1550, maxX: 1650, y: 472 },
  ],
  // 조건부 함정 트리거: "영역 내 1초 이상 체류" 조건(docs/traps-spec.md #5의 두 예시 중 선택 —
  // 스위치 순서 조합은 상태 머신이 필요해 범위를 벗어남). 폭 50px은 210px/s로 지나가면 약 0.24초라
  // 평범하게 통과하면 안전하고, 멈춰 서 있을 때만 위험하다. 발동 시 가짜 안전지대와 같은 즉시 사망.
  conditionalTraps: [
    { zone: { x: 1670, y: 440, width: 50, height: 80 } },
  ],
  // 중간 체크포인트: 적 구간(850)과 위험지대(1060) 사이 평지에 배치. 접촉하면 이후 사망 시
  // 레벨 시작점 대신 여기서 다시 시작한다(수동 재시작(R)은 체크포인트를 초기화하고 처음부터 시작).
  // 영역 위쪽(360)은 바닥(500)에서 최대 점프 높이(81.375px)로 올라간 발 위치(약 419)보다 높아, 점프로
  // 넘어가도 반드시 닿는다 — 가짜 안전지대 사망 후 표시가 재시작 화면 안에 들어오도록(physics-spec "레벨 배치 제약").
  checkpoints: [
    { zone: { x: 950, y: 360, width: 40, height: 160 }, respawnX: 950, respawnY: 350 },
  ],
  vanishingGrounds: [],
  invisibleBlocks: [],
  fallingCeilings: [],
};

// 레벨 2: 레벨 1과 다른 함정 조합(낙하 발판·갑자기 출현하는 적·가짜 안전지대 + 왕복 적)과 순서.
// 레벨 1은 낙하 발판 아래 틈을 그냥 뛰어넘을 수도 있었지만, 여기서는 구덩이(400-640, 240px)가 평지 점프
// 거리(약 147px)보다 넓어 가운데 낙하 발판을 반드시 밟고 0.4초 안에 다시 뛰어야 한다.
// 배치 제약(docs/physics-spec.md "레벨 배치 제약")과 도달 가능성은 tests/unit/world/Level2.test.ts가 검증한다.
export const LEVEL_2: Level = {
  width: 2200,
  height: 620,
  spawn: { x: 65, y: 350 },
  // groundA: 시작 구간. groundB: 갑자기 출현하는 적·체크포인트·가짜 안전지대·왕복 적 구간. groundC: 틈(1760-1860) 너머 목표 구간.
  solids: [
    { x: 0, y: 500, width: 400, height: 120 },
    { x: 640, y: 500, width: 1120, height: 120 },
    { x: 1860, y: 500, width: 340, height: 120 },
  ],
  goal: { x: 2140, y: 440, width: 40, height: 60 },
  // 가짜 안전지대: groundB 위 위장 타일. 앞(1100)에 건너뛸 수 없는 체크포인트가 있어, 이 함정으로
  // 죽으면 체크포인트에서 재시작하고 강조 표시가 화면 안에 보인다(docs/traps-spec.md #4). 체크포인트와
  // 200px 띄운다 — 재시작 위치(공중 y 350)에서 →를 누른 채 떨어져도 착지한 뒤 점프할 거리가 남도록.
  hazards: [{ x: 1300, y: 495, width: 80, height: 25 }],
  // 낙하하는 발판: 구덩이 가운데 징검다리. 바닥보다 20px 높아 양쪽에서 점프로 오르내린다(docs/traps-spec.md #2).
  fallingPlatforms: [{ x: 480, y: 480, width: 80, height: 20 }],
  hiddenBlocks: [],
  // 왕복 적: 가짜 안전지대 너머. 위험지대를 넘어 착지하는 지점(약 1400)과 순찰 구간(1500-1600)을 띄워,
  // 체크포인트에서 재시작해 적의 순찰 위치가 초기화돼도 착지하자마자 부딪히지 않게 한다. 적을 넘어 착지한
  // 뒤에도 groundB 끝(1760)까지 다시 점프할 거리가 남는다.
  enemies: [{ minX: 1500, maxX: 1600, y: 472 }],
  // 갑자기 출현하는 적: 구덩이를 건넌 직후 트리거(720-760). 등장 구간(960-1060)은 트리거보다 200px 앞이라
  // 경고 0.3초 안에 들이닥치지 않고, 체크포인트(1100) 앞에서 끝나 재시작 위치와 겹치지 않는다. 구간이 짧아
  // 등장 직후 곧 방향을 돌려 플레이어와 마주 오므로, 뒤에서 따라잡다 등에 떨어지는 일 없이 넘을 수 있다.
  ambushes: [
    { trigger: { x: 720, y: 440, width: 40, height: 80 }, minX: 960, maxX: 1060, y: 472 },
  ],
  conditionalTraps: [],
  // 체크포인트: 영역 위쪽(360)이 점프 최고점의 발 위치(약 419)보다 높아 건너뛸 수 없다(physics-spec "레벨 배치 제약").
  checkpoints: [
    { zone: { x: 1100, y: 360, width: 40, height: 160 }, respawnX: 1100, respawnY: 350 },
  ],
  vanishingGrounds: [],
  invisibleBlocks: [],
  fallingCeilings: [],
};

// 플레이 순서. 클리어 후 "다음 레벨"로 다음 항목을 시작하고, 마지막 레벨 뒤에는 완료 화면에서 처음으로 돌아간다.
export const LEVELS: readonly Level[] = [LEVEL_1, LEVEL_2];
