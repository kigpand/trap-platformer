import type { DeathStatKind, TauntKind } from '../world/World';

// 놀리는 사망 메시지(docs/game-design.md 표). 캔버스 위쪽 표시와 스크린 리더 사망 알림이 같은 문구를 쓴다.
export const TAUNTS: Readonly<Record<TauntKind, string>> = {
  hiddenBlock: '거기 바닥 있는 줄 알았지?',
  fallingPlatform: '오래 서 있으면 무너져~',
  ambush: '깜짝이야!',
  hazard: '그 바닥을 믿었어?',
  conditional: '거기서 왜 쉬어?',
  enemy: '부딪히면 아파',
  vanishingGround: '멈추면 떨어진다니까',
  invisibleBlock: '머리 조심!',
  dodgingPlatform: '발판도 살고 싶대',
  fallingCeiling: '위를 좀 봐',
  popUpSpikes: '뾰족한 거 처음 봐?',
  fakeCheckpoint: '저장 안 됐는데?',
  fleeingGoal: '목표가 도망갔어 ㅋ',
  skyDrop: '오늘 날씨: 적',
  fakeClear: '벌써 끝난 줄 알았지?',
  boulder: '뒤도 좀 봐',
  baitGem: '보석이 그렇게 좋았어?',
  landingSpikes: '착지 지점 예약 완료~',
  shadow: '너의 적은 너야',
  heavyShoes: '오늘따라 몸이 무겁네',
  ice: '브레이크 고장',
  descendingCeiling: '납작해졌네',
  rhythmPlatform: '박자 놓쳤어~',
  arrow: '화살은 피하라고 있는 거야',
  mirrorEnemy: '나도 뛸 줄 알아',
  countingPlatform: '삼세번이야',
  pipeEnemy: '파이프에도 누가 살아',
  sinkingPipe: '서 있으면 가라앉아',
  rollingStone: '언덕엔 돌이 굴러',
  baitGemPickup: '그거 장식인데?',
  flingJump: '점프 금지 구역이었어',
  reverseZone: '왼쪽이 오른쪽이야',
  springFloor: '다시 처음부터~',
};

// 당한 함정 통계(클리어 화면·스크린 리더)에 쓰는 이름. 함정 이름은 docs/traps-spec.md의 번호별 제목을 따른다.
export const DEATH_NAMES: Readonly<Record<DeathStatKind, string>> = {
  hiddenBlock: '숨겨진 블록',
  fallingPlatform: '낙하하는 발판',
  ambush: '갑자기 출현하는 적',
  hazard: '가짜 안전지대',
  conditional: '조건부 함정',
  enemy: '왕복하는 적',
  vanishingGround: '사라지는 땅',
  invisibleBlock: '투명 블록',
  dodgingPlatform: '도망가는 발판',
  fallingCeiling: '떨어지는 천장',
  popUpSpikes: '솟아오르는 가시',
  fakeCheckpoint: '가짜 체크포인트',
  fleeingGoal: '도망가는 목표',
  skyDrop: '하늘에서 쏟아지는 적',
  fakeClear: '가짜 클리어',
  flingJump: '날려버리는 점프',
  reverseZone: '좌우 반전 구간',
  boulder: '따라오는 돌덩이',
  baitGem: '미끼 보물',
  landingSpikes: '착지 예측 가시',
  shadow: '따라 하는 그림자',
  heavyShoes: '무거운 신발 구간',
  ice: '얼음 바닥',
  descendingCeiling: '내려오는 천장',
  rhythmPlatform: '박자 발판',
  arrow: '화살 발사대',
  mirrorEnemy: '따라 뛰는 적',
  countingPlatform: '세 번째 착지에 무너지는 발판',
  pipeEnemy: '적이 나오는 파이프',
  sinkingPipe: '가라앉는 파이프',
  rollingStone: '굴러 내려오는 돌',
  fall: '그냥 떨어짐',
};

// 이번 런의 원인별 사망을 많이 당한 순서로(같으면 이름순) 정렬한다.
export function rankDeaths(byKind: Partial<Record<DeathStatKind, number>>): { kind: DeathStatKind; name: string; count: number }[] {
  return (Object.keys(byKind) as DeathStatKind[])
    .map((kind) => ({ kind, name: DEATH_NAMES[kind], count: byKind[kind] ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}
