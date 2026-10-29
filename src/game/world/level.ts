import type { Rect } from '../physics/AABB';
export interface EnemyPatrol { minX: number; maxX: number; y: number }
export interface AmbushEnemy extends EnemyPatrol { trigger: Rect }
export interface ConditionalTrap { zone: Rect }
export interface Checkpoint { zone: Rect; respawnX: number; respawnY: number }
// 떨어지는 천장(docs/traps-spec.md #9): 공중의 블록과, 들어서면 블록이 떨어지는 트리거 영역.
export interface FallingCeiling { block: Rect; trigger: Rect }
// 도망가는 발판(#8): 공중에서 trigger에 들어오면 platform이 to 위치(왼쪽 위 좌표)로 한 번 미끄러진다.
export interface DodgingPlatform { platform: Rect; trigger: Rect; to: { x: number; y: number } }
// 솟아오르는 가시(#10): trigger(가시 앞 60px)에 들어오면 spikes(높이 24px)가 솟는다.
export interface PopUpSpike { spikes: Rect; trigger: Rect }
// 도망가는 목표(#12): 순서대로, trigger에 들어오면 목표가 to로 뛰어 달아난다.
export interface GoalHop { trigger: Rect; to: Rect }
// 하늘에서 쏟아지는 적(#13): trigger에 들어오면 drops마다 delay 뒤 0.4초 경고, 그 뒤 x 위치의 화면 위에서 떨어져
// 착지하면 minX~maxX를 왕복한다.
export interface SkyDrop { x: number; delay: number; minX: number; maxX: number }
export interface SkyDropGroup { trigger: Rect; drops: readonly SkyDrop[] }
// 날려버리는 점프(#15): zone 안에서 바닥에 선 채 점프하면 보통 점프 대신 (vx, vy)로 강제 비행한다.
export interface FlingZone { zone: Rect; vx: number; vy: number }
// 뒷걸음 스프링 바닥(#17): tile 위에 서면 (vx, vy)로 강제 비행한다. tile은 바닥 윗면에 겹쳐 두는 장식·판정 영역이다.
export interface SpringFloor { tile: Rect; vx: number; vy: number }
// 가짜 클리어(#14): flag는 목표와 똑같이 그리는 깃발, floor는 이 함정이 가진 솔리드(가짜 클리어 중 N을 누르면 사라진다).
export interface FakeGoal { flag: Rect; floor: readonly Rect[] }
// 가짜 안내 표지판(#18): 동작 없는 장식. x는 기둥 위치, y는 기둥이 서는 바닥 높이, text는 12자 이하.
export interface Sign { x: number; y: number; text: string }
// 따라오는 돌덩이(#19): trigger에 처음 들어오면 startX에 60×60으로 나타나 고정 높이 y(윗면)에서 오른쪽으로 굴러가고,
// 오른쪽 끝이 endX에 닿으면 사라진다. 배치 제약: startX + 60 ≤ trigger.x − 160.
export interface Boulder { trigger: Rect; startX: number; endX: number; y: number }
// 미끼 보물(#21): 20×20 보석의 왼쪽 위 좌표. 점수 없는 장식이다.
export interface BaitGem { x: number; y: number }
// 따라 하는 그림자(#22): trigger에 처음 들어오면 2초 늦게 플레이어의 위치를 그대로 따라오고, 그림자의 x가 endX를 넘으면 사라진다.
export interface Shadow { trigger: Rect; endX: number }
// 무거운 신발 구간(#24): zone 안에서 바닥에 선 채 뛰면 점프 초기 속도가 −jumpSpeed가 된다(기본 300).
export interface HeavyZone { zone: Rect; jumpSpeed: number }
// 내려오는 천장(#25): trigger에 처음 들어오면 block이 speed(px/s, 기본 60)로 내려와 아랫면이 floorY에 닿으면 멈춘다.
export interface DescendingCeiling { block: Rect; trigger: Rect; speed: number; floorY: number }
// 박자 발판(#27): 목숨이 시작된 뒤 t초에 ((t + offset) mod period) < onDuration이면 나타나 있다(솔리드).
export interface RhythmPlatform { rect: Rect; period: number; onDuration: number; offset: number }
// 화살 발사대(#26): trigger에 처음 들어온 뒤 화살마다 delay초에 경고, 0.4초 뒤 fromX(화살 왼쪽 끝)에서 나타나 toX를 향해
// 360px/s로 날아가고 toX에 닿으면 사라진다. y는 화살(30×6) 윗면. 지형을 무시한다.
export interface Arrow { y: number; delay: number; fromX: number; toX: number }
export interface ArrowTrap { trigger: Rect; arrows: readonly Arrow[] }
// 따라 뛰는 적(#29): 일반 왕복 적(minX~maxX, 높이 y)이지만, 플레이어가 점프 입력으로 바닥을 떠나면 400px 안에서 바닥에 있을 때
// −jumpSpeed(기본 720)로 뛰고 중력을 받아 y로 내려온다.
export interface MirrorEnemy { minX: number; maxX: number; y: number; jumpSpeed: number }
// 세 번째 착지에 무너지는 발판(#30): 공중에서 이 발판에 착지한 횟수가 landings(기본 3)가 되는 스텝에 사라진다.
export interface CountingPlatform { rect: Rect; landings: number }
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
  dodgingPlatforms: readonly DodgingPlatform[]; // #8 도망가는 발판
  popUpSpikes: readonly PopUpSpike[]; // #10 솟아오르는 가시
  fakeCheckpoints: readonly Rect[]; // #11 가짜 체크포인트(깃발 영역, 점프로 넘을 수 있는 높이)
  goalHops: readonly GoalHop[]; // #12 도망가는 목표(goal에서 출발해 차례로 달아남)
  skyDrops: readonly SkyDropGroup[]; // #13 하늘에서 쏟아지는 적
  flingZones: readonly FlingZone[]; // #15 날려버리는 점프
  reverseZones: readonly Rect[]; // #16 좌우 반전 구간
  springFloors: readonly SpringFloor[]; // #17 뒷걸음 스프링 바닥
  fakeGoals: readonly FakeGoal[]; // #14 가짜 클리어
  signs: readonly Sign[]; // #18 가짜 안내 표지판
  boulders: readonly Boulder[]; // #19 따라오는 돌덩이
  fakeWalls: readonly Rect[]; // #20 가짜 벽(솔리드 아님, 높이 81.375px 초과)
  baitGems: readonly BaitGem[]; // #21 미끼 보물
  landingSpikeZones: readonly Rect[]; // #23 착지 예측 가시(구역 안에서 뛰면 착지 지점에 가시)
  shadows: readonly Shadow[]; // #22 따라 하는 그림자
  heavyZones: readonly HeavyZone[]; // #24 무거운 신발 구간
  descendingCeilings: readonly DescendingCeiling[]; // #25 내려오는 천장
  rhythmPlatforms: readonly RhythmPlatform[]; // #27 박자 발판
  arrowTraps: readonly ArrowTrap[]; // #26 화살 발사대
  mirrorEnemies: readonly MirrorEnemy[]; // #29 따라 뛰는 적
  countingPlatforms: readonly CountingPlatform[]; // #30 세 번째 착지에 무너지는 발판
  iceFloors: readonly Rect[]; // #28 얼음 바닥(바닥 윗면에 겹쳐 두는 판정·장식 영역, 스프링 타일과 같은 방식)
}

export const LEVEL_1: Level = {
  width: 12000,
  height: 620,
  spawn: { x: 65, y: 350 },
  // ground1a/ground1b: 숨겨진 블록(hiddenBlocks)이 메우는 틈(300-380)으로 나뉜 시작 구간.
  // ground2: 적·체크포인트·위험지대·gap1 점프 착지 구간. ground3: 낙하 발판 다리 너머, 목표 구간.
  solids: [
    { x: 0, y: 500, width: 300, height: 120 },
    { x: 380, y: 500, width: 140, height: 120 },
    { x: 620, y: 500, width: 570, height: 120 },
    { x: 1290, y: 500, width: 670, height: 120 },
    // 함정 확장 구간(1960~): ground4는 떨어지는 천장·솟아오르는 가시, ground5는 도망가는 발판 너머 예전 목표 구간.
    { x: 2240, y: 500, width: 760, height: 120 },
    { x: 3260, y: 500, width: 540, height: 120 },
    // 약올리는 함정 구간(3800~, 맵 3배 확장): 예전 목표 자리(3940)는 가짜 클리어 깃발이 되고, 그 아래 3800-4100은
    // 가짜 깃발의 바닥(fakeGoals.floor)이다. 그 뒤로 보석 구덩이 → 내려오는 천장 통로 → 얼음 → 박자 발판 → 그림자 → 스프링.
    { x: 4100, y: 500, width: 700, height: 120 }, // 4800-4900 보석 구덩이
    { x: 4900, y: 500, width: 700, height: 120 }, // 내려오는 천장 통로(5150-5450), 5600-5700 구덩이
    { x: 5700, y: 500, width: 800, height: 120 }, // 끝 400px(6100-6500)가 얼음, 6500-6600 구덩이
    { x: 6600, y: 500, width: 800, height: 120 }, // 7400-7800 박자 발판 구덩이
    { x: 7800, y: 500, width: 500, height: 120 }, // 그림자 구간: 8300-8400·8700-8800 구덩이
    { x: 8400, y: 500, width: 300, height: 120 },
    { x: 8800, y: 500, width: 3200, height: 120 },
  ],
  goal: { x: 11900, y: 440, width: 40, height: 60 },
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
  // 중간 체크포인트: 적 구간(850)과 위험지대(1060) 사이 평지에 배치. 위험지대와 160px 띄워, 재시작 위치(공중 y 350)에서
  // →를 누른 채 떨어져도 착지한 뒤 위험지대를 넘을 거리가 남는다(원래 950이라 재시작 직후 위험지대에 그대로 착지했다). 접촉하면 이후 사망 시
  // 레벨 시작점 대신 여기서 다시 시작한다(수동 재시작(R)은 체크포인트를 초기화하고 처음부터 시작).
  // 영역 위쪽(360)은 바닥(500)에서 최대 점프 높이(81.375px)로 올라간 발 위치(약 419)보다 높아, 점프로
  // 넘어가도 반드시 닿는다 — 가짜 안전지대 사망 후 표시가 재시작 화면 안에 들어오도록(physics-spec "레벨 배치 제약").
  // 영역 아래쪽은 바닥(500)에서 끝나 깃발이 가짜 체크포인트와 같은 높이로 선다.
  checkpoints: [
    { zone: { x: 900, y: 360, width: 40, height: 140 }, respawnX: 900, respawnY: 350 },
    // 함정 확장 구간마다 둔 체크포인트: 사라지는 땅 앞, 도망가는 발판 앞.
    { zone: { x: 1800, y: 360, width: 40, height: 140 }, respawnX: 1800, respawnY: 350 },
    { zone: { x: 2760, y: 360, width: 40, height: 140 }, respawnX: 2760, respawnY: 350 },
    // 약올리는 함정 구간: 가짜 클리어가 풀린 뒤(4060 너머), 구덩이 건너 얼음 앞, 박자 발판 앞(지켜볼 수 있는 평지), 그림자 끝 뒤.
    { zone: { x: 4300, y: 360, width: 40, height: 140 }, respawnX: 4300, respawnY: 350 },
    { zone: { x: 5800, y: 360, width: 40, height: 140 }, respawnX: 5800, respawnY: 350 },
    { zone: { x: 6800, y: 360, width: 40, height: 140 }, respawnX: 6800, respawnY: 350 },
    { zone: { x: 9700, y: 360, width: 40, height: 140 }, respawnX: 9700, respawnY: 350 },
  ],
  // 레벨 1은 새 함정을 하나씩 소개하는 쉬운 단계다(docs/game-design.md "레벨 진행" 난이도 곡선).
  // 사라지는 땅: ground3 끝(1960)에서 ground4(2240)까지 7칸. 멈추지 않고 달리면 지나간다.
  vanishingGrounds: [{ x: 1960, y: 500, width: 280, height: 120 }],
  invisibleBlocks: [],
  // 떨어지는 천장: 그냥 지나가면 깔린다. 트리거에 살짝 들어갔다 물러서 떨어뜨린 뒤 넘는다(높이 40px).
  fallingCeilings: [{ block: { x: 2450, y: 380, width: 40, height: 40 }, trigger: { x: 2420, y: 380, width: 70, height: 120 } }],
  // 도망가는 발판: ground4 끝(3000)과 ground5(3260) 사이 260px 구덩이. 제자리 점프로 먼저 도망가게 한 뒤 바뀐 자리로 뛴다.
  dodgingPlatforms: [{ platform: { x: 3030, y: 480, width: 60, height: 20 }, trigger: { x: 2960, y: 380, width: 40, height: 100 }, to: { x: 3120, y: 480 } }],
  // 솟아오르는 가시: 레벨 1은 좁은 가시(16px)로 넘을 여유를 넉넉히 준다.
  popUpSpikes: [{ spikes: { x: 2640, y: 476, width: 16, height: 24 }, trigger: { x: 2580, y: 400, width: 60, height: 100 } }],
  fakeCheckpoints: [],
  goalHops: [],
  skyDrops: [],
  flingZones: [],
  reverseZones: [],
  // 뒷걸음 스프링 바닥: 목표(11900) 직전. 밟는 순간 세게 튕겨 약 710px 뒤 평지에 떨어진다(구덩이·함정 없음). 타일을 점프로 넘는다.
  springFloors: [{ tile: { x: 11600, y: 500, width: 40, height: 20 }, vx: -600, vy: -800 }],
  // 가짜 클리어: 예전 목표 자리. 바닥(3800-4100)이 깃발 좌우 80px보다 넓게 덮어, N을 누르면 어디서든 떨어진다.
  fakeGoals: [{ flag: { x: 3940, y: 440, width: 40, height: 60 }, floor: [{ x: 3800, y: 500, width: 300, height: 120 }] }],
  // 가짜 안내 표지판: 짝이 되는 함정 바로 앞. 조작 규칙에 대해서는 거짓말하지 않는다.
  signs: [
    { x: 3700, y: 500, text: '여기가 끝!' }, // 가짜 클리어
    { x: 6000, y: 500, text: '멈추면 안전' }, // 얼음(멈추면 미끄러져 떨어진다)
    { x: 11450, y: 500, text: '거의 다 왔어!' }, // 스프링
  ],
  boulders: [],
  // 가짜 벽: 내려오는 천장 통로 끝을 막은 것처럼 보이는 벽(높이 120 > 최대 점프). 멈칫하면 천장에 깔린다. 그대로 지나간다.
  fakeWalls: [{ x: 5400, y: 380, width: 40, height: 120 }],
  // 미끼 보물: 구덩이(4800-4900) 안, 바닥 높이 바로 아래. 먹으려면 구덩이로 떨어져야 한다. 보통 점프로 넘으면 한참 위를 지난다.
  baitGems: [{ x: 4840, y: 485 }],
  landingSpikeZones: [],
  // 따라 하는 그림자: 박자 발판을 건넌 뒤 7900부터 9200까지. 그 사이에는 달리며 넘는 구덩이(100px)만 있다.
  shadows: [{ trigger: { x: 7900, y: 300, width: 40, height: 200 }, endX: 9200 }],
  heavyZones: [],
  // 얼음 바닥: 구덩이(6500) 앞 400px. 끝 가까이에서 키를 떼면 약 73px 미끄러져 떨어진다. 달리던 그대로 뛰어 건넌다.
  iceFloors: [{ x: 6100, y: 500, width: 400, height: 20 }],
  arrowTraps: [],
  mirrorEnemies: [],
  countingPlatforms: [],
  // 내려오는 천장: 통로(5150-5450) 위 블록이 화면 위쪽(아랫면 130)에서 150px/s로 빠르게 내려온다 — 서 있는 머리(468)까지
  // 338px, 약 2.25초. 트리거(5110)에서 통로를 빠져나가기까지 달려서 약 1.74초라 0.5초 여유가 있다(traps-spec #25).
  descendingCeilings: [{ block: { x: 5150, y: 90, width: 300, height: 40 }, trigger: { x: 5110, y: 300, width: 40, height: 200 }, speed: 150, floorY: 500 }],
  // 박자 발판: 2초 주기에 1.2초 나타난다. 두 번째는 0.5초 늦게 — 나타나 있는 시간이 0.7초 겹친다(traps-spec #27: 0.3초 이상).
  rhythmPlatforms: [
    { rect: { x: 7480, y: 500, width: 80, height: 20 }, period: 2, onDuration: 1.2, offset: 0 },
    { rect: { x: 7640, y: 500, width: 80, height: 20 }, period: 2, onDuration: 1.2, offset: -0.5 },
  ],
};

// 레벨 2: 레벨 1과 다른 함정 조합(낙하 발판·갑자기 출현하는 적·가짜 안전지대 + 왕복 적)과 순서.
// 레벨 1은 낙하 발판 아래 틈을 그냥 뛰어넘을 수도 있었지만, 여기서는 구덩이(400-640, 240px)가 평지 점프
// 거리(약 147px)보다 넓어 가운데 낙하 발판을 반드시 밟고 0.4초 안에 다시 뛰어야 한다.
// 배치 제약(docs/physics-spec.md "레벨 배치 제약")과 도달 가능성은 tests/unit/world/Level2.test.ts가 검증한다.
export const LEVEL_2: Level = {
  width: 15300,
  height: 620,
  spawn: { x: 65, y: 350 },
  // groundA: 시작 구간. groundB: 갑자기 출현하는 적·체크포인트·가짜 안전지대·왕복 적 구간. groundC: 틈(1760-1860) 너머 목표 구간.
  solids: [
    { x: 0, y: 500, width: 400, height: 120 },
    { x: 640, y: 500, width: 1120, height: 120 },
    { x: 1860, y: 500, width: 290, height: 120 },
    // 함정 확장 구간(2150~). groundD: 가시·가짜 체크포인트, groundE: 천장·적.
    { x: 2230, y: 500, width: 670, height: 120 },
    { x: 3260, y: 500, width: 640, height: 120 },
    // 약올리는 함정 구간(4160~, 맵 3배 확장). 예전 끝(도망가는 목표)은 레벨 끝(14,600~)으로 옮겼다.
    { x: 4160, y: 500, width: 240, height: 120 }, // 4400-4500: 날려버리는 점프가 떨어뜨리는 뒤쪽 구덩이
    { x: 4500, y: 500, width: 400, height: 120 }, // 끝 20px(4880-4900)이 날려버리는 점프 구역, 4900-5000 구덩이
    { x: 5000, y: 500, width: 1200, height: 120 }, // 좌우 반전(5150-5390), 끝 20px(6180-6200)이 무거운 신발 구역, 6200-6300 구덩이
    { x: 6300, y: 500, width: 3800, height: 120 }, // 착지 예측 가시 → 화살 → 따라 뛰는 적, 10100-10160 구덩이 너머 세 번째 착지 발판
    { x: 6700, y: 460, width: 40, height: 40 }, // 착지 예측 가시 앞 턱(높이 40)
    { x: 10240, y: 470, width: 10, height: 30 }, // 세 번째 착지 발판 위 장애물 두 개
    { x: 10400, y: 470, width: 10, height: 30 },
    { x: 10550, y: 500, width: 1750, height: 120 }, // 따라오는 돌덩이, 12300-12380 구덩이
    { x: 12380, y: 500, width: 2420, height: 120 }, // 도망가는 목표(예전 groundF 자리를 옮김), 14800-14900 구덩이
    { x: 14900, y: 500, width: 400, height: 120 },
  ],
  goal: { x: 14680, y: 440, width: 40, height: 60 }, // 다가가면 도망간다(goalHops)
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
  enemies: [{ minX: 1500, maxX: 1600, y: 472 }, { minX: 3700, maxX: 3800, y: 472 }], // 두 번째: 천장 너머 groundE. 천장 블록을 넘어 착지하는 곳(약 3660)과 띄운다
  // 갑자기 출현하는 적: 구덩이를 건넌 직후 트리거(720-760). 등장 구간(960-1060)은 트리거보다 200px 앞이라
  // 경고 0.3초 안에 들이닥치지 않고, 체크포인트(1100) 앞에서 끝나 재시작 위치와 겹치지 않는다. 구간이 짧아
  // 등장 직후 곧 방향을 돌려 플레이어와 마주 오므로, 뒤에서 따라잡다 등에 떨어지는 일 없이 넘을 수 있다.
  ambushes: [
    { trigger: { x: 720, y: 440, width: 40, height: 80 }, minX: 960, maxX: 1060, y: 472 },
  ],
  conditionalTraps: [],
  // 체크포인트: 영역 위쪽(360)이 점프 최고점의 발 위치(약 419)보다 높아 건너뛸 수 없다(physics-spec "레벨 배치 제약").
  checkpoints: [
    { zone: { x: 1100, y: 360, width: 40, height: 140 }, respawnX: 1100, respawnY: 350 },
    // 함정 확장 구간마다 둔 체크포인트: 투명 블록 앞, 가시·가짜 체크포인트 앞, 천장 앞, 도망가는 목표 앞.
    { zone: { x: 1900, y: 360, width: 40, height: 140 }, respawnX: 1900, respawnY: 350 },
    { zone: { x: 2290, y: 360, width: 40, height: 140 }, respawnX: 2290, respawnY: 350 },
    { zone: { x: 3300, y: 360, width: 40, height: 140 }, respawnX: 3300, respawnY: 350 },
    { zone: { x: 4200, y: 360, width: 40, height: 140 }, respawnX: 4200, respawnY: 350 },
    // 약올리는 함정 구간: 좌우 반전 앞, 무거운 신발 앞, 착지 예측 가시 앞, 화살 앞, 따라 뛰는 적 앞, 세 번째 착지 발판 앞,
    // 돌덩이 앞(돌덩이가 나타나는 11,400보다 뒤), 도망가는 목표 앞.
    { zone: { x: 5060, y: 360, width: 40, height: 140 }, respawnX: 5060, respawnY: 350 },
    { zone: { x: 5900, y: 360, width: 40, height: 140 }, respawnX: 5900, respawnY: 350 },
    { zone: { x: 6350, y: 360, width: 40, height: 140 }, respawnX: 6350, respawnY: 350 },
    { zone: { x: 7250, y: 360, width: 40, height: 140 }, respawnX: 7250, respawnY: 350 },
    { zone: { x: 8650, y: 360, width: 40, height: 140 }, respawnX: 8650, respawnY: 350 },
    { zone: { x: 9950, y: 360, width: 40, height: 140 }, respawnX: 9950, respawnY: 350 },
    { zone: { x: 11300, y: 360, width: 40, height: 140 }, respawnX: 11300, respawnY: 350 },
    { zone: { x: 14200, y: 360, width: 40, height: 140 }, respawnX: 14200, respawnY: 350 },
  ],
  // 레벨 2(보통): 새 함정 7종을 모두 쓰고, 레벨 1보다 타이밍을 좁힌다(docs/game-design.md "난이도 곡선").
  // 사라지는 땅: groundD 끝(2900)~groundE(3260) 9칸.
  vanishingGrounds: [{ x: 2900, y: 500, width: 360, height: 120 }],
  // 투명 블록: groundC 끝(2150)의 80px 구덩이 바로 위. 가장자리에서 뛰는 보통 점프(오른쪽 끝 2130~2150)는 머리를 찧고
  // 떨어진다. 시뮬레이션 실측으로 오른쪽 끝 2084~2126(43px)에서 일찍 뛰면 블록 아래를 지나 건너편에 착지한다.
  invisibleBlocks: [{ x: 2140, y: 420, width: 80, height: 20 }],
  fallingCeilings: [{ block: { x: 3560, y: 380, width: 40, height: 40 }, trigger: { x: 3530, y: 380, width: 70, height: 120 } }],
  // 도망가는 발판: groundE 끝(3900)~groundF(4160) 260px 구덩이.
  dodgingPlatforms: [{ platform: { x: 3930, y: 480, width: 60, height: 20 }, trigger: { x: 3860, y: 380, width: 40, height: 100 }, to: { x: 4020, y: 480 } }],
  // 솟아오르는 가시: 레벨 1(16px)보다 넓은 24px.
  popUpSpikes: [{ spikes: { x: 2560, y: 476, width: 24, height: 24 }, trigger: { x: 2500, y: 400, width: 60, height: 100 } }],
  // 가짜 체크포인트: 진짜 체크포인트(2290) 뒤. 높이 50px로 점프로 넘을 수 있다.
  fakeCheckpoints: [{ x: 2780, y: 450, width: 40, height: 50 }],
  // 도망가는 목표: 레벨 끝(14,680)에서 다가가면 구덩이(14,800-14,900) 건너로, 거기서 다시 끝으로 달아난다(예전 끝 구간을 그대로 옮김).
  goalHops: [
    { trigger: { x: 14600, y: 400, width: 40, height: 100 }, to: { x: 15040, y: 440, width: 40, height: 60 } },
    { trigger: { x: 14960, y: 400, width: 40, height: 100 }, to: { x: 15240, y: 440, width: 40, height: 60 } },
  ],
  skyDrops: [],
  // 날려버리는 점프: 구덩이(4900) 앞 20px. 그 안에서 뛰면 뒤로 높이 날아가 뒤쪽 구덩이(4400-4500)에 떨어진다. 일찍 뛰어 넘는다.
  flingZones: [{ zone: { x: 4880, y: 300, width: 20, height: 200 }, vx: -420, vy: -720 }],
  // 좌우 반전: 구덩이(4900-5000)를 건너 조금 걸어간 곳. 반전된 채 →를 누르면 방금 건넌 구덩이로 걸어 돌아간다.
  reverseZones: [{ x: 5150, y: 300, width: 240, height: 200 }],
  springFloors: [],
  fakeGoals: [],
  signs: [],
  // 따라오는 돌덩이: 트리거(11,700) 160px 넘게 뒤(11,400)에서 나타나 13,000까지. 길에는 달리며 넘는 구덩이(80px) 하나뿐.
  boulders: [{ trigger: { x: 11700, y: 300, width: 40, height: 200 }, startX: 11400, endX: 13000, y: 440 }],
  fakeWalls: [],
  baitGems: [],
  // 착지 예측 가시: 턱(6700) 앞 60px. 그 안에서 뛰면 착지 지점에 가시. 구역 앞에서 뛰면 턱 위에 내려선다.
  landingSpikeZones: [{ x: 6620, y: 300, width: 60, height: 200 }],
  shadows: [],
  // 무거운 신발: 구덩이(6200) 앞 20px(구덩이 100px — 일찍 뛰는 출발 구간 27px, traps-spec #24 실측).
  heavyZones: [{ zone: { x: 6180, y: 300, width: 20, height: 200 }, jumpSpeed: 300 }],
  iceFloors: [],
  // 화살 발사대: 트리거(7,400)를 지나면 오른쪽 화면 밖에서 낮은 화살(0.3초 뒤 경고) → 높은 화살(1.8초 뒤 경고).
  // 낮은 화살은 점프로 넘고, 높은 화살은 뛰지 않고 지나가게 둔다. 길(7,000-8,630)에는 솔리드가 없다.
  arrowTraps: [{ trigger: { x: 7400, y: 300, width: 40, height: 200 }, arrows: [
    { y: 484, delay: 0.3, fromX: 8600, toX: 7000 },
    { y: 450, delay: 1.8, fromX: 8600, toX: 7000 },
  ] }],
  // 따라 뛰는 적: 8,800-9,300 순찰. 넘으려고 뛰면 같이 높이 뛴다 — 다가올 때 제자리에서 뛰면 머리 위로 넘어간다.
  mirrorEnemies: [{ minX: 8800, maxX: 9300, y: 472, jumpSpeed: 720 }],
  // 세 번째 착지 발판: 구덩이(10,100-10,160) 너머 10,160-10,550, 장애물 두 개(10,240·10,400). 구덩이 끝에서 바로 뛰면
  // 발판 착지 → 장애물 두 번 넘기로 세 번째 착지에 무너진다. 발끝까지 버티다 늦게 뛰면(9~25px 내밂, 실측) 첫 장애물까지 넘어 두 번만 착지한다.
  countingPlatforms: [{ rect: { x: 10160, y: 500, width: 390, height: 20 }, landings: 3 }],
  descendingCeilings: [],
  rhythmPlatforms: [],
};

// 레벨 3(어려움): 새 함정 8종을 명세 기본 크기로, 쉴 틈 없이 이어 붙인다(docs/game-design.md "난이도 곡선").
// 출발 구간 실측: 40px 가시 10px, 높이 60px 가짜 체크포인트 12px, 투명 블록을 피하는 이른 점프 23px.
// 해법과 도달 가능성은 tests/unit/world/Level3.test.ts가 검증한다.
export const LEVEL_3: Level = {
  width: 16800,
  height: 620,
  spawn: { x: 65, y: 350 },
  solids: [
    { x: 0, y: 500, width: 500, height: 120 }, // groundA: 시작
    { x: 900, y: 500, width: 400, height: 120 }, // groundB: 사라지는 땅 바로 뒤 가시
    { x: 1400, y: 500, width: 1500, height: 120 }, // groundC: 투명 블록 구덩이 너머 — 쏟아지는 적·가짜 체크포인트·천장·가시
    { x: 3160, y: 500, width: 240, height: 120 }, // groundD: 도망가는 발판 너머 짧은 발판
    { x: 3800, y: 500, width: 1200, height: 120 }, // groundE: 사라지는 땅 뒤 가짜 안전지대·쏟아지는 적
    // 약올리는 함정 구간(5,100~, 맵 3배 확장): 14~30번을 둘씩 섞어 둔다. 예전 마지막 구간(도망가는 목표)은 레벨 끝으로 옮겼다(+11,200).
    { x: 5100, y: 500, width: 1200, height: 120 }, // 돌덩이 + 길 가운데 가짜 벽, 6300-6400 구덩이
    { x: 6400, y: 500, width: 470, height: 120 }, // 6870-6990: 날려버리는 점프가 떨어뜨리는 뒤쪽 구덩이
    { x: 6990, y: 500, width: 410, height: 120 }, // 얼음(7000-7380) 끝 20px이 날려버리는 점프 구역, 7400-7480 구덩이
    { x: 7480, y: 500, width: 820, height: 120 }, // 그림자 안에 좌우 반전, 8300-8380 구덩이
    { x: 8380, y: 500, width: 1620, height: 120 }, // 화살 세 발, 끝 20px(9980-10000)이 무거운 신발 구역, 10000-10100 구덩이
    { x: 10100, y: 500, width: 1500, height: 120 }, // 따라 뛰는 적 → 착지 예측 가시(턱 11300), 11600-11660 구덩이
    { x: 11300, y: 460, width: 40, height: 40 }, // 착지 예측 가시 앞 턱
    { x: 11740, y: 470, width: 10, height: 30 }, // 세 번째 착지 발판 위 장애물 두 개
    { x: 11900, y: 470, width: 10, height: 30 },
    { x: 12050, y: 500, width: 1350, height: 120 }, // 13400-13920: 박자 발판 세 개가 놓인 구덩이
    { x: 13920, y: 500, width: 780, height: 120 }, // 내려오는 천장 통로(14100-14400), 14700-15000은 두 번째 가짜 클리어 바닥
    { x: 15000, y: 500, width: 1200, height: 120 }, // 스프링(15700), 끝에 도망가는 목표
    { x: 16300, y: 500, width: 500, height: 120 }, // groundF(옮김): 마지막 구덩이 너머 — 가시와 도망가는 목표
  ],
  goal: { x: 16150, y: 440, width: 40, height: 60 }, // 다가가면 두 번 달아난다(goalHops)
  // 가짜 안전지대: 두 번째 사라지는 땅이 끝나자마자. 달리던 그대로 뛰어 넘어야 한다. 체크포인트 3(3350)에서
  // 재시작한 화면(오른쪽 끝 3926) 안에 들어오도록 둔다 — 사망 원인 표시를 재시작 직후 바로 본다(physics-spec 배치 제약).
  hazards: [{ x: 3840, y: 495, width: 80, height: 25 }],
  fallingPlatforms: [],
  hiddenBlocks: [],
  enemies: [],
  ambushes: [],
  conditionalTraps: [],
  checkpoints: [
    { zone: { x: 1100, y: 360, width: 40, height: 140 }, respawnX: 1100, respawnY: 350 },
    { zone: { x: 2080, y: 360, width: 40, height: 140 }, respawnX: 2080, respawnY: 350 },
    { zone: { x: 3350, y: 360, width: 40, height: 140 }, respawnX: 3350, respawnY: 350 }, // groundD 끝, 가짜 안전지대가 화면 안
    { zone: { x: 4100, y: 360, width: 40, height: 140 }, respawnX: 4100, respawnY: 350 },
    // 약올리는 함정 구간마다(함정 쌍 앞).
    { zone: { x: 5150, y: 360, width: 40, height: 140 }, respawnX: 5150, respawnY: 350 },
    { zone: { x: 6450, y: 360, width: 40, height: 140 }, respawnX: 6450, respawnY: 350 },
    { zone: { x: 7500, y: 360, width: 40, height: 140 }, respawnX: 7500, respawnY: 350 },
    { zone: { x: 9240, y: 360, width: 40, height: 140 }, respawnX: 9240, respawnY: 350 },
    { zone: { x: 10150, y: 360, width: 40, height: 140 }, respawnX: 10150, respawnY: 350 },
    { zone: { x: 11450, y: 360, width: 40, height: 140 }, respawnX: 11450, respawnY: 350 },
    { zone: { x: 13300, y: 360, width: 40, height: 140 }, respawnX: 13300, respawnY: 350 },
    { zone: { x: 13950, y: 360, width: 40, height: 140 }, respawnX: 13950, respawnY: 350 },
    { zone: { x: 15050, y: 360, width: 40, height: 140 }, respawnX: 15050, respawnY: 350 },
    { zone: { x: 15900, y: 360, width: 40, height: 140 }, respawnX: 15900, respawnY: 350 },
  ],
  vanishingGrounds: [{ x: 500, y: 500, width: 400, height: 120 }, { x: 3400, y: 500, width: 400, height: 120 }],
  // 투명 블록: groundB 끝(1300)의 100px 구덩이. 가장자리 점프는 찧고, 가장자리 46~24px 앞의 이른 점프(23px)만 지나간다.
  invisibleBlocks: [{ x: 1290, y: 420, width: 80, height: 20 }],
  fallingCeilings: [{ block: { x: 2500, y: 380, width: 40, height: 40 }, trigger: { x: 2470, y: 380, width: 70, height: 120 } }],
  dodgingPlatforms: [{ platform: { x: 2930, y: 480, width: 60, height: 20 }, trigger: { x: 2860, y: 380, width: 40, height: 100 }, to: { x: 3020, y: 480 } }],
  // 솟아오르는 가시(40px, 명세 기본 크기): 사라지는 땅 직후, 천장 직후, 마지막 구간.
  popUpSpikes: [
    { spikes: { x: 1000, y: 476, width: 40, height: 24 }, trigger: { x: 940, y: 400, width: 60, height: 100 } },
    { spikes: { x: 2700, y: 476, width: 40, height: 24 }, trigger: { x: 2640, y: 400, width: 60, height: 100 } },
    { spikes: { x: 16600, y: 476, width: 40, height: 24 }, trigger: { x: 16540, y: 400, width: 60, height: 100 } },
  ],
  fakeCheckpoints: [{ x: 2300, y: 440, width: 40, height: 60 }],
  goalHops: [
    { trigger: { x: 16070, y: 400, width: 40, height: 100 }, to: { x: 16440, y: 440, width: 40, height: 60 } },
    { trigger: { x: 16400, y: 400, width: 40, height: 100 }, to: { x: 16740, y: 440, width: 40, height: 60 } },
  ],
  // 하늘에서 쏟아지는 적: 순찰 구간 사이에 기다릴 자리(160px)를 둔다(traps-spec #13 배치 제약).
  skyDrops: [
    { trigger: { x: 1450, y: 400, width: 40, height: 100 }, drops: [
      { x: 1600, delay: 0, minX: 1560, maxX: 1680 }, { x: 1880, delay: 0.25, minX: 1840, maxX: 1960 },
    ] },
    { trigger: { x: 4200, y: 400, width: 40, height: 100 }, drops: [
      { x: 4400, delay: 0, minX: 4360, maxX: 4480 }, { x: 4700, delay: 0.25, minX: 4660, maxX: 4780 },
    ] },
  ],
  // 날려버리는 점프: 얼음 끝 20px. 미끄러지며 일찍 뛰어야 하고, 구역에서 뛰면 뒤쪽 구덩이(6870-6990)로 날아간다.
  flingZones: [{ zone: { x: 7380, y: 300, width: 20, height: 200 }, vx: -420, vy: -720 }],
  // 좌우 반전: 그림자 구간 한가운데. 걸리면 머뭇거리지 말고 ←로 빠져나가야 그림자에 안 잡힌다.
  reverseZones: [{ x: 7900, y: 300, width: 240, height: 200 }],
  // 뒷걸음 스프링 바닥: 마지막 구간 앞. 밟는 순간 세게 튕겨 약 710px 뒤(15,140 근처) 평지에 떨어진다 — 두 번째 가짜 클리어 바닥(~15,000)보다 뒤.
  springFloors: [{ tile: { x: 15850, y: 500, width: 40, height: 20 }, vx: -600, vy: -800 }],
  // 두 번째 가짜 클리어: 천장 통로를 지나 "진짜 끝!" 표지판 뒤. 바닥(14700-15000)이 깃발 좌우 80px보다 넓다.
  fakeGoals: [{ flag: { x: 14830, y: 440, width: 40, height: 60 }, floor: [{ x: 14700, y: 500, width: 300, height: 120 }] }],
  signs: [
    { x: 11150, y: 500, text: '여기서 점프!' }, // 착지 예측 가시 구역(11220-11280) 바로 앞
    { x: 14600, y: 500, text: '진짜 끝!' }, // 두 번째 가짜 클리어
  ],
  // 따라오는 돌덩이: 트리거(5300)보다 240px 뒤(5000)에서 나타나 6300까지. 길 가운데 가짜 벽(5800)에서 멈칫하면 깔린다.
  boulders: [{ trigger: { x: 5300, y: 300, width: 40, height: 200 }, startX: 5000, endX: 6300, y: 440 }],
  fakeWalls: [{ x: 5800, y: 380, width: 40, height: 120 }],
  // 미끼 보물: 박자 발판 첫째와 둘째 사이 구덩이 안.
  baitGems: [{ x: 13575, y: 485 }],
  // 착지 예측 가시: "여기서 점프!" 표지판 바로 뒤, 턱(11300) 앞 60px.
  landingSpikeZones: [{ x: 11220, y: 300, width: 60, height: 200 }],
  // 따라 하는 그림자: 7550-8800. 안에 좌우 반전과 달리며 넘는 구덩이(8300-8380).
  shadows: [{ trigger: { x: 7550, y: 300, width: 40, height: 200 }, endX: 8800 }],
  // 무거운 신발: 화살 구간 끝, 구덩이(10000) 앞 20px.
  heavyZones: [{ zone: { x: 9980, y: 300, width: 20, height: 200 }, jumpSpeed: 300 }],
  iceFloors: [{ x: 7000, y: 500, width: 380, height: 20 }],
  // 화살 세 발: 낮은 것 → 높은 것 → 낮은 것. 길(9000-10330)에는 솔리드가 없다.
  arrowTraps: [{ trigger: { x: 9300, y: 300, width: 40, height: 200 }, arrows: [
    { y: 484, delay: 0.2, fromX: 10300, toX: 9000 },
    { y: 450, delay: 1.2, fromX: 10300, toX: 9000 },
    { y: 484, delay: 2.4, fromX: 10300, toX: 9000 },
  ] }],
  mirrorEnemies: [{ minX: 10400, maxX: 10900, y: 472, jumpSpeed: 720 }],
  // 세 번째 착지 발판: 레벨 2와 같은 배치(구덩이 60px, 장애물 80·240px) — 발끝까지 버티다 늦게 뛰어야 두 번만 착지한다.
  countingPlatforms: [{ rect: { x: 11660, y: 500, width: 390, height: 20 }, landings: 3 }],
  // 내려오는 천장: 레벨 1보다 빠른 170px/s, 화면 맨 위(아랫면 85)에서. 머리(468)까지 383px, 약 2.25초. 통로를 달려 빠져나가기까지 약 1.74초.
  descendingCeilings: [{ block: { x: 14100, y: 45, width: 300, height: 40 }, trigger: { x: 14060, y: 300, width: 40, height: 200 }, speed: 170, floorY: 500 }],
  // 박자 발판 세 개: 1.8초 주기에 1.4초, 차례로 0.6초씩 늦게(이웃과 0.8초 겹침). 첫 발판이 나타날 무렵 연달아 뛰어야 한다.
  // 처음엔 1.0초였는데 착지 뒤 다시 뛸 여유가 0~1프레임뿐이라(시뮬레이션 실측) 사람 손으로는 사실상 불가능해, 착지마다 0~9프레임 여유가 생기는 1.4초로 늘렸다.
  rhythmPlatforms: [
    { rect: { x: 13470, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: 0 },
    { rect: { x: 13620, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: -0.6 },
    { rect: { x: 13770, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: -1.2 },
  ],
};

// 플레이 순서. 클리어 후 "다음 레벨"로 다음 항목을 시작하고, 마지막 레벨 뒤에는 완료 화면에서 처음으로 돌아간다.
export const LEVELS: readonly Level[] = [LEVEL_1, LEVEL_2, LEVEL_3];
