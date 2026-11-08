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
// 하늘에서 쏟아지는 적(#13): trigger에 들어오면 drops마다 delay 뒤 경고(World.ts의 SKY_DROP_WARNING), 그 뒤 x 위치의 화면 위에서 떨어져
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
// 따라 하는 그림자(#22): trigger에 처음 들어오면 SHADOW_DELAY_STEPS(0.7초) 늦게 플레이어의 위치를 그대로 따라오고, 그림자의 x가 endX를 넘으면 사라진다.
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
// 파이프(지형지물): 바닥 위에 선 단단한 기둥. rect의 아랫면이 받치는 바닥의 윗면에 닿는다. 충돌은 솔리드와 같다.
export type Pipe = Rect;
// 계단식 언덕(지형지물): y(받치는 바닥의 윗면) 위에 steps단으로 쌓은 언덕. 단마다 stepWidth만큼 안으로 들어가고 stepHeight만큼
// 높아지며, 꼭대기 단의 너비는 topWidth다. 경사가 아니라 사각형 단이라 단마다 점프해 오른다(단차 보조 없음 — docs/physics-spec.md).
export interface Hill { x: number; y: number; steps: number; stepWidth: number; stepHeight: number; topWidth: number }
// 움직임을 바꾸는 지형지물(함정 아님 — 보이는 그대로 동작한다). 셋 다 바닥 윗면에 겹쳐 두는 판정·그림 영역이다(얼음 #28과 같은 방식).
// 트램펄린: 타일 위에 서는 스텝에 위로 speed(px/s, 기본 720 — 최고 약 190px)로 튕긴다. 공중 좌우 조작은 평소대로.
export interface Trampoline { tile: Rect; speed: number }
// 컨베이어 벨트: 위에 서 있는 동안 수평 속도에 speed(px/s, +는 오른쪽)를 더한다. 뛰거나 떨어지면 평소대로.
export interface Conveyor { rect: Rect; speed: number }
// 바람 구간(환풍구): zone 안에서는 중력이 lift(px/s², 기본 800)만큼 약해지고 떨어지는 속도가 WIND_MAX_FALL로 묶인다 — 점프가 높고
// 길어지며 천천히 내려온다. 아랫면의 환풍구 그림은 zone 바닥(지형 윗면)에 그린다.
export interface WindZone { zone: Rect; lift: number }
// 적이 나오는 파이프(#31): trigger에 처음 들어오면 경고 뒤 pipe(level.pipes 중 하나) 입구에서 적이 올라와, 왼쪽으로 걸어 내려선 뒤
// 파이프 왼쪽에서 minX~maxX를 왕복한다.
export interface PipeEnemy { pipe: Rect; trigger: Rect; minX: number; maxX: number }
// 가라앉는 파이프(#32): 진짜 파이프처럼 그리는 파이프. 윗면에 선 뒤 delay(기본 0.3)초가 지나면 아래를 메운 땅 기둥과 함께 가라앉는다.
// level.solids에는 파이프 바로 아래에 파이프 너비만큼 틈이 있어야 한다. level.pipes에는 넣지 않는다.
export interface SinkingPipe { pipe: Rect; delay: number }
// 굴러 내려오는 돌(#33): trigger에 처음 들어오면 (x, y)(왼쪽 위, 언덕 꼭대기 위)에 돌이 나타나 왼쪽으로 굴러 계단을 내려오고, x가 endX 이하가 되면 사라진다.
export interface RollingStone { trigger: Rect; x: number; y: number; endX: number }
// 레벨 하나의 배치 전체. World는 이 객체를 받아 시뮬레이션하고 렌더러는 world.level을 그린다 —
// 레벨을 늘릴 때 전역 상수를 바꾸지 않고 객체를 하나 더 만들면 된다(docs/roadmap.md "새 맵 추가" 릴리스 2번).
export interface Level {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  solids: readonly Rect[];
  pipes: readonly Pipe[]; // 지형지물: 파이프
  hills: readonly Hill[]; // 지형지물: 계단식 언덕
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
  trampolines: readonly Trampoline[]; // 지형지물: 트램펄린
  conveyors: readonly Conveyor[]; // 지형지물: 컨베이어 벨트
  mudFloors: readonly Rect[]; // 지형지물: 진흙 바닥(위에서 걷기·점프가 느리고 낮아짐)
  windZones: readonly WindZone[]; // 지형지물: 바람 구간
  oneWayPlatforms: readonly Rect[]; // 지형지물: 한쪽 통과 발판(위에서만 막힘 — 아래·옆에서는 통과)
  pipeEnemies: readonly PipeEnemy[]; // #31 적이 나오는 파이프
  sinkingPipes: readonly SinkingPipe[]; // #32 가라앉는 파이프
  rollingStones: readonly RollingStone[]; // #33 굴러 내려오는 돌
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
    // 지형지물 구간(9880~10740, 체크포인트 7 뒤): 파이프 → 적이 나오는 파이프 → 가라앉는 파이프(10340-10400 틈) → 언덕과 굴러 내려오는 돌.
    // 스프링(11600)에 튕기면 약 10840에 떨어지므로 언덕은 그보다 앞(10740)에서 끝난다.
    // 9320-9480: 바람 구간이 있는 넓은 구덩이(160px — 평소 점프로는 못 건넌다).
    { x: 8800, y: 500, width: 520, height: 120 },
    { x: 9480, y: 500, width: 860, height: 120 },
    { x: 10400, y: 500, width: 1600, height: 120 },
  ],
  // 파이프: 맵 곳곳의 함정 없는 평지에 넘는 장애물로 흩어 둔다(프로젝트 오너 요청, 2026-11-07). 첫 화면에도 보이도록 스폰 뒤(왼쪽 끝)에
  // 하나 둔다 — 스폰과 숨겨진 블록 사이는 걸어서 숨겨진 블록에 닿는 길이고, 원래 구간(~1960)은 함정이 촘촘해 비운다
  // (조건부 함정 바로 뒤에 두면 파이프에 막혀 영역 안에 머물게 되어 함정이 된다).
  // 10160은 적이 나오는 파이프(#31). 스프링이 튕겨 보내는 자리(약 10840) 앞뒤는 비워 둔다.
  pipes: [
    { x: 10, y: 460, width: 40, height: 40 },
    { x: 4500, y: 450, width: 60, height: 50 },
    { x: 5950, y: 460, width: 40, height: 40 },
    { x: 9880, y: 450, width: 60, height: 50 },
    { x: 10160, y: 440, width: 60, height: 60 },
    { x: 11150, y: 450, width: 60, height: 50 },
  ],
  // 계단식 언덕: 도망가는 발판 너머(3380-3580)와 박자 발판 앞 평지(6950-7170)에 낮은 2단 언덕, 지형지물 구간의 2단 언덕
  // (10460-10740, 꼭대기에 오르면 굴러 내려오는 돌 #33).
  hills: [
    { x: 3380, y: 500, steps: 2, stepWidth: 50, stepHeight: 30, topWidth: 100 },
    { x: 6950, y: 500, steps: 2, stepWidth: 50, stepHeight: 40, topWidth: 120 },
    { x: 10460, y: 500, steps: 2, stepWidth: 60, stepHeight: 40, topWidth: 160 },
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
    { x: 10290, y: 500, text: '파이프는 안전' }, // 가라앉는 파이프
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
  // 얼음 바닥: 구덩이(6500) 앞 400px. 끝 가까이에서 키를 떼면 약 184px 미끄러져 떨어진다. 달리던 그대로 뛰어 건넌다.
  // 적이 나오는 파이프: 트리거(9980)를 지나면 파이프(10160) 입구에서 적이 올라와 내려선 뒤 10020~10160을 왕복한다.
  // 트리거 앞에서 기다렸다가 다가오는 적을 넘고, 적이 돌아서는 사이 파이프를 넘는다.
  // 움직임을 바꾸는 지형지물(2026-11-08): 가짜 클리어 바닥 너머 앞으로 미는 벨트(4120-4280), 파이프(4500)를 넘겨 주는
  // 트램펄린(4430), 보석 구덩이 앞 진흙(4620-4740 — 구덩이 앞 점프는 진흙을 벗어난 뒤).
  trampolines: [{ tile: { x: 4430, y: 500, width: 40, height: 20 }, speed: 720 }],
  conveyors: [{ rect: { x: 4120, y: 500, width: 160, height: 20 }, speed: 90 }],
  mudFloors: [{ x: 4620, y: 500, width: 120, height: 20 }],
  // 바람 구간: 그림자 뒤 넓은 구덩이(9320-9480) 위. 가장자리에서 뛰면 떠올라 천천히 내려오며 건너편에 닿는다.
  windZones: [{ zone: { x: 9300, y: 250, width: 200, height: 370 }, lift: 800 }],
  // 한쪽 통과 발판: 스프링 앞 평지(11250-11400) 위 70px. 올라가도 아래로 지나가도 된다(스프링에 튕겨 날아가는 길보다 낮다).
  oneWayPlatforms: [{ x: 11250, y: 430, width: 150, height: 12 }],
  pipeEnemies: [{ pipe: { x: 10160, y: 440, width: 60, height: 60 }, trigger: { x: 9980, y: 300, width: 40, height: 200 }, minX: 10020, maxX: 10160 }],
  // 가라앉는 파이프: 바닥 틈(10340-10400) 위. "파이프는 안전" 표지판 뒤에 있다. 올라서면 0.3초 뒤 가라앉으니 바로 다시 뛴다.
  sinkingPipes: [{ pipe: { x: 10340, y: 440, width: 60, height: 60 }, delay: 0.3 }],
  // 굴러 내려오는 돌: 언덕 꼭대기 왼쪽 끝(10520-10540)에 오르면 꼭대기 오른쪽(10640)에 나타나 왼쪽으로 굴러 내려오고 10410에서 사라진다
  // (가라앉는 파이프 오른쪽 끝 10400보다 앞에서 멈춘다 — traps-spec #33 "내려가기만 하는 길"). 꼭대기에서 돌을 넘는다.
  rollingStones: [{ trigger: { x: 10520, y: 320, width: 20, height: 100 }, x: 10640, y: 390, endX: 10410 }],
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
// 거리(약 147px)보다 넓어 가운데 낙하 발판을 반드시 밟고 유예 시간(World.ts의 FALL_TRIGGER_DELAY) 안에 다시 뛰어야 한다.
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
    { x: 12380, y: 500, width: 1460, height: 120 }, // 13840-14000: 바람 구간이 있는 넓은 구덩이
    { x: 14000, y: 500, width: 800, height: 120 }, // 도망가는 목표(예전 groundF 자리를 옮김), 14800-14900 구덩이
    { x: 14900, y: 500, width: 400, height: 120 },
  ],
  // 맵 곳곳의 함정 없는 평지에 흩어 둔 평범한 파이프·언덕(프로젝트 오너 요청, 2026-11-07). 화살이 지나가는 길(7000-8600)과
  // 돌덩이가 굴러가는 길(11400-13000)에는 두지 않는다 — 둘 다 지형을 무시해 파이프를 뚫고 지나가 보인다.
  pipes: [
    { x: 10, y: 460, width: 40, height: 40 }, // 스폰 뒤 왼쪽 끝(첫 화면)
    { x: 4650, y: 450, width: 50, height: 50 }, // 날려버리는 점프 구역 앞
    { x: 5600, y: 460, width: 50, height: 40 }, // 좌우 반전을 빠져나간 뒤
    { x: 10800, y: 450, width: 60, height: 50 }, // 세 번째 착지 발판 너머
  ],
  hills: [
    { x: 9450, y: 500, steps: 2, stepWidth: 50, stepHeight: 40, topWidth: 100 }, // 따라 뛰는 적 너머
    { x: 13300, y: 500, steps: 3, stepWidth: 50, stepHeight: 30, topWidth: 120 }, // 돌덩이가 멈춘 뒤(13000)
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
  // 좌우 반전: 구덩이(4900-5000)를 건너 조금 걸어간 곳. 반전된 채 →를 누르면 구역 경계에서 들락날락하며 지나가지 못한다.
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
  // 움직임을 바꾸는 지형지물(2026-11-08): 좌우 반전을 빠져나간 뒤 진흙(5420-5520), 언덕 너머 트램펄린(9720),
  // 도망가는 목표 앞 거꾸로 미는 벨트(14300-14550).
  trampolines: [{ tile: { x: 9720, y: 500, width: 40, height: 20 }, speed: 720 }],
  conveyors: [{ rect: { x: 14300, y: 500, width: 250, height: 20 }, speed: -60 }],
  mudFloors: [{ x: 5420, y: 500, width: 100, height: 20 }],
  // 바람 구간: 언덕 너머 넓은 구덩이(13840-14000) 위.
  windZones: [{ zone: { x: 13820, y: 250, width: 200, height: 370 }, lift: 800 }],
  // 한쪽 통과 발판: 세 번째 착지 발판 너머 평지(10620-10760) 위 70px.
  oneWayPlatforms: [{ x: 10620, y: 430, width: 140, height: 12 }],
  pipeEnemies: [],
  sinkingPipes: [],
  rollingStones: [],
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
  // 맵 곳곳의 함정 없는 평지에 흩어 둔 파이프·언덕(프로젝트 오너 요청, 2026-11-07). 돌덩이 길(5000-6300)·화살 길(9000-10330)·
  // 그림자 구간·내려오는 천장 통로와, 스프링이 튕겨 보내는 자리(약 15100) 근처는 비운다. 12900은 적이 나오는 파이프(#31).
  pipes: [
    { x: 10, y: 460, width: 40, height: 40 }, // 스폰 뒤 왼쪽 끝(첫 화면)
    { x: 250, y: 460, width: 40, height: 40 }, // 첫 사라지는 땅 앞
    { x: 6650, y: 460, width: 40, height: 40 }, // 얼음 앞 구덩이 전
    { x: 12900, y: 440, width: 60, height: 60 },
    { x: 15500, y: 450, width: 60, height: 50 }, // 스프링 앞
  ],
  hills: [{ x: 12300, y: 500, steps: 3, stepWidth: 50, stepHeight: 30, topWidth: 150 }], // 세 번째 착지 발판 너머
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
  // 적이 나오는 파이프: 언덕을 내려와 트리거(12680)를 지나면 파이프(12900)에서 적이 나와 언덕 아래(12650)부터 파이프까지 왕복한다. 박자 발판 앞
  // 체크포인트(13300)보다 앞이다.
  // 움직임을 바꾸는 지형지물(2026-11-08): 체크포인트 6 뒤 진흙(6450-6600), 언덕 앞 거꾸로 미는 벨트(12100-12280),
  // 적이 나오는 파이프 너머 트램펄린(13100).
  trampolines: [{ tile: { x: 13100, y: 500, width: 40, height: 20 }, speed: 720 }],
  conveyors: [{ rect: { x: 12100, y: 500, width: 180, height: 20 }, speed: -90 }],
  mudFloors: [{ x: 6450, y: 500, width: 150, height: 20 }],
  windZones: [],
  // 한쪽 통과 발판: 스프링 앞 평지(15150-15330) 위 70px(스프링에 튕겨 날아가는 길보다 낮다). 끝에서 내려와 파이프(15500) 앞에
  // 착지할 거리를 둔다.
  oneWayPlatforms: [{ x: 15150, y: 430, width: 180, height: 12 }],
  pipeEnemies: [{ pipe: { x: 12900, y: 440, width: 60, height: 60 }, trigger: { x: 12680, y: 300, width: 40, height: 200 }, minX: 12650, maxX: 12900 }],
  sinkingPipes: [],
  rollingStones: [],
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

// 레벨 4(지옥): 함정 30종을 셋씩 겹친 구간 G1~G9와 끝 구간(docs/game-design.md "난이도 곡선"). 위치는 해법의 점프마다
// 6프레임 이상 여유가 남도록 고정 스텝 시뮬레이션으로 맞췄다(tests/unit/world/Level4.test.ts의 시간 여유 측정).
export const LEVEL_4: Level = {
  width: 18600,
  height: 620,
  spawn: { x: 65, y: 350 },
  solids: [
    { x: 0, y: 500, width: 760, height: 120 }, // 시작
    { x: 1360, y: 500, width: 1480, height: 120 }, // G1 사라지는 땅(760-1360) 뒤 쏟아지는 적, 2840-2920 구덩이
    { x: 2920, y: 500, width: 580, height: 120 }, // G2 얼음(전체) 위 좌우 반전, 3500-3600 구덩이
    { x: 3600, y: 500, width: 1400, height: 120 }, // 솟아오르는 가시 → G3 박자 발판 구덩이(5000-5520)
    { x: 5520, y: 500, width: 3680, height: 120 }, // G4 내려오는 천장 통로·떨어지는 천장 → G5 무거운 신발 구덩이(9200-9260)
    { x: 9260, y: 500, width: 2340, height: 120 }, // G6 돌덩이·가짜 벽, 11600-12100 세 번째 착지 발판 다리
    { x: 11640, y: 470, width: 10, height: 30 }, // 세 번째 착지 발판 위 장애물 셋
    { x: 11810, y: 470, width: 10, height: 30 },
    { x: 11870, y: 470, width: 10, height: 30 },
    { x: 12100, y: 500, width: 800, height: 120 }, // G7 숨겨진 블록(12900-12980)
    { x: 12980, y: 500, width: 120, height: 120 }, // 13100-13300 낙하 발판 구덩이
    { x: 13300, y: 500, width: 1400, height: 120 }, // 기습 적 → G8 도망가는 발판 구덩이(14700-14960)
    { x: 14960, y: 500, width: 980, height: 120 }, // 스프링, 15940-16040은 날려버리는 점프가 떨어뜨리는 뒤쪽 구덩이
    { x: 16040, y: 500, width: 410, height: 120 }, // G9 조건부 함정·날려버리는 점프, 16450-16540 구덩이
    { x: 16540, y: 500, width: 610, height: 120 }, // 가짜 안전지대, 표지판, 가짜 체크포인트 — 17150-17450은 가짜 클리어 바닥
    { x: 17450, y: 500, width: 350, height: 120 }, // 도망가는 목표: 17800-17900·18150-18250 구덩이
    { x: 17900, y: 500, width: 250, height: 120 },
    { x: 18250, y: 500, width: 350, height: 120 },
  ],
  // 맵 곳곳의 함정 없는 평지에 흩어 둔 평범한 파이프·언덕(프로젝트 오너 요청, 2026-11-07). 겹친 함정 구간과, 체크포인트에서
  // 다음 함정까지의 길(그냥 하면 당하는지 확인하는 길)·그림자 길·화살 길·돌덩이 길은 비운다. 모두 해법의 6프레임 여유를 지킨다.
  pipes: [
    { x: 10, y: 460, width: 40, height: 40 }, // 스폰 뒤 왼쪽 끝(첫 화면)
    { x: 4350, y: 450, width: 50, height: 50 }, // 2구간 뒤, 체크포인트 1 앞
    { x: 12300, y: 460, width: 40, height: 40 }, // 돌덩이가 멈춘 뒤(12200), 체크포인트 3 앞
    { x: 14100, y: 450, width: 50, height: 50 }, // 기습 적 너머, 도망가는 발판 앞
    { x: 15400, y: 450, width: 60, height: 50 }, // 스프링 너머
  ],
  hills: [
    { x: 3950, y: 500, steps: 2, stepWidth: 50, stepHeight: 40, topWidth: 120 }, // 솟는 가시 너머
    { x: 8000, y: 500, steps: 3, stepWidth: 50, stepHeight: 30, topWidth: 100 }, // 떨어지는 천장 너머, 체크포인트 2 앞
  ],
  goal: { x: 17700, y: 440, width: 40, height: 60 },
  hazards: [{ x: 16680, y: 495, width: 80, height: 25 }],
  fallingPlatforms: [{ x: 13100, y: 480, width: 140, height: 20 }],
  hiddenBlocks: [{ x: 12900, y: 500, width: 80, height: 120 }],
  enemies: [],
  ambushes: [{ trigger: { x: 13420, y: 440, width: 40, height: 80 }, minX: 13600, maxX: 13760, y: 472 }],
  conditionalTraps: [{ zone: { x: 16380, y: 440, width: 50, height: 80 } }],
  checkpoints: [
    { zone: { x: 4600, y: 360, width: 40, height: 140 }, respawnX: 4600, respawnY: 350 },
    { zone: { x: 8450, y: 360, width: 40, height: 140 }, respawnX: 8450, respawnY: 350 },
    { zone: { x: 12450, y: 360, width: 40, height: 140 }, respawnX: 12450, respawnY: 350 },
    { zone: { x: 16200, y: 360, width: 40, height: 140 }, respawnX: 16200, respawnY: 350 },
  ],
  vanishingGrounds: [{ x: 760, y: 500, width: 600, height: 120 }],
  invisibleBlocks: [{ x: 14705, y: 420, width: 80, height: 20 }],
  fallingCeilings: [{ block: { x: 7600, y: 380, width: 40, height: 40 }, trigger: { x: 7570, y: 380, width: 70, height: 120 } }],
  dodgingPlatforms: [{ platform: { x: 14730, y: 480, width: 60, height: 20 }, trigger: { x: 14660, y: 380, width: 40, height: 100 }, to: { x: 14780, y: 480 } }],
  popUpSpikes: [{ spikes: { x: 3720, y: 476, width: 40, height: 24 }, trigger: { x: 3660, y: 400, width: 60, height: 100 } }],
  fakeCheckpoints: [{ x: 17000, y: 460, width: 40, height: 40 }], // 높이 40px — 넘는 출발 구간이 60px(레벨 3)보다 넓다
  goalHops: [
    { trigger: { x: 17620, y: 400, width: 40, height: 100 }, to: { x: 17980, y: 440, width: 40, height: 60 } },
    { trigger: { x: 17900, y: 400, width: 40, height: 100 }, to: { x: 18320, y: 440, width: 40, height: 60 } },
    { trigger: { x: 18240, y: 400, width: 40, height: 100 }, to: { x: 18540, y: 440, width: 40, height: 60 } },
  ],
  skyDrops: [{ trigger: { x: 1400, y: 400, width: 40, height: 100 }, drops: [
    { x: 1640, delay: 0, minX: 1600, maxX: 1760 }, { x: 2040, delay: 0.4, minX: 2000, maxX: 2160 },
  ] }],
  flingZones: [{ zone: { x: 16430, y: 300, width: 20, height: 200 }, vx: -420, vy: -720 }],
  reverseZones: [{ x: 3200, y: 300, width: 220, height: 200 }],
  springFloors: [{ tile: { x: 15020, y: 500, width: 40, height: 20 }, vx: -600, vy: -800 }],
  fakeGoals: [{ flag: { x: 17280, y: 440, width: 40, height: 60 }, floor: [{ x: 17150, y: 500, width: 300, height: 120 }] }],
  signs: [{ x: 9150, y: 500, text: '여기서 점프!' }, { x: 16900, y: 500, text: '진짜 끝!' }],
  boulders: [{ trigger: { x: 10500, y: 300, width: 40, height: 200 }, startX: 10260, endX: 12200, y: 440 }],
  fakeWalls: [{ x: 11000, y: 380, width: 40, height: 120 }],
  baitGems: [{ x: 5305, y: 485 }],
  landingSpikeZones: [{ x: 9160, y: 300, width: 40, height: 200 }],
  shadows: [{ trigger: { x: 500, y: 300, width: 40, height: 200 }, endX: 2700 }],
  heavyZones: [{ zone: { x: 9160, y: 300, width: 40, height: 200 }, jumpSpeed: 300 }],
  // 움직임을 바꾸는 지형지물(2026-11-08): 기습 적 너머 파이프 뒤 진흙(14180-14350), 스프링 너머 파이프 뒤 트램펄린(15500).
  // 트램펄린은 체크포인트 앞에 두지 않는다 — 튕겨 넘으면 체크포인트를 건너뛸 수 있다.
  trampolines: [{ tile: { x: 15500, y: 500, width: 40, height: 20 }, speed: 720 }],
  conveyors: [],
  mudFloors: [{ x: 14180, y: 500, width: 170, height: 20 }],
  windZones: [],
  // 한쪽 통과 발판: 진흙 너머 도망가는 발판 앞 평지(14380-14500) 위 70px. 끝에서 내려와 도망가는 발판 앞 점프 자리까지 착지할 거리를 둔다.
  oneWayPlatforms: [{ x: 14380, y: 430, width: 120, height: 12 }],
  pipeEnemies: [],
  sinkingPipes: [],
  rollingStones: [],
  iceFloors: [{ x: 2920, y: 500, width: 580, height: 20 }],
  arrowTraps: [{ trigger: { x: 5070, y: 300, width: 40, height: 200 }, arrows: [
    { y: 484, delay: 0.75, fromX: 5900, toX: 4900 },
    { y: 484, delay: 2.4, fromX: 5900, toX: 4900 },
  ] }],
  // 따라 뛰는 적은 기본 점프 속도(720) — 600·660으로 낮추면 제자리에서 넘길 수 있는 거리가 좁아진다(720: 30~70px, 600: 45px만).
  mirrorEnemies: [{ minX: 6800, maxX: 7300, y: 472, jumpSpeed: 720 }],
  countingPlatforms: [{ rect: { x: 11600, y: 500, width: 500, height: 20 }, landings: 3 }],
  // 내려오는 천장 65px/s: 머리(468)까지 약 5.9초. 해법(돌아선 적을 맞아 제자리에서 넘기고 빠져나감)은 약 5.4초 걸린다.
  descendingCeilings: [{ block: { x: 6600, y: 45, width: 800, height: 40 }, trigger: { x: 6560, y: 300, width: 40, height: 200 }, speed: 65, floorY: 500 }],
  rhythmPlatforms: [
    { rect: { x: 5070, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: 0 },
    { rect: { x: 5220, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: -0.6 },
    { rect: { x: 5370, y: 500, width: 80, height: 20 }, period: 1.8, onDuration: 1.4, offset: -1.2 },
  ],
};

// 플레이 순서. 클리어 후 "다음 레벨"로 다음 항목을 시작하고, 마지막 레벨 뒤에는 완료 화면에서 처음으로 돌아간다.
export const LEVELS: readonly Level[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

// 언덕을 겹치지 않는 세로 기둥으로 나눈다(왼쪽 단 → 꼭대기 → 오른쪽 단). 기둥마다 윗면에서 받치는 바닥까지 이어져,
// 바닥처럼 그리면 드러난 단의 윗면마다 풀이 난다(단을 가로로 쌓으면 아래 단의 풀이 위 단 밑으로 비친다).
export function hillColumns(h: Hill): Rect[] {
  const side = (i: number): number => (i + 1) * h.stepHeight;
  const left = Array.from({ length: h.steps - 1 }, (_, i) => ({ x: h.x + i * h.stepWidth, y: h.y - side(i), width: h.stepWidth, height: side(i) }));
  const topX = h.x + (h.steps - 1) * h.stepWidth;
  const top = { x: topX, y: h.y - h.steps * h.stepHeight, width: h.topWidth, height: h.steps * h.stepHeight };
  const right = left.map((c, i) => ({ ...c, x: topX + h.topWidth + (h.steps - 2 - i) * h.stepWidth })).reverse();
  return [...left, top, ...right];
}

// 움직이지 않는 지형 전체(바닥·블록, 파이프, 언덕 기둥). World가 충돌·지지 확인에 함께 쓴다.
export function staticSolids(level: Level): Rect[] {
  return [...level.solids, ...level.pipes, ...level.hills.flatMap(hillColumns)];
}
