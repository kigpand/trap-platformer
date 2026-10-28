import type { TauntKind } from '../world/World';

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
  baitGemPickup: '그거 장식인데?',
  flingJump: '점프 금지 구역이었어',
  reverseZone: '왼쪽이 오른쪽이야',
  springFloor: '다시 처음부터~',
};
