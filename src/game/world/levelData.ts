import type { Level } from './level';

// level.ts와 따로 둔다: 테스트가 level 모듈을 통째로 mock할 때(FakeClearController.test.ts) mock 안에서 testLevel → defineLevel을
// 부르면 아직 만들어지는 중인 mock 모듈을 다시 기다려 멈췄다. 이 모듈은 Level 타입만 가져오므로(런타임 import 없음) 순환이 없다.

// 레벨 하나를 만든다. 크기·스폰·바닥·목표·체크포인트만 반드시 적고, 쓰지 않는 함정·지형지물 목록은 빈 목록으로 채운다 —
// 예전에는 레벨마다 쓰지 않는 필드까지 `[]`로 모두 적어야 해서, 필드를 하나 더할 때마다 네 레벨과 시험용 레벨을 고쳐야 했다.
// 새 필드는 Level에 더하고 EMPTY_FEATURES에 빈 목록을 더한다(빠뜨리면 EMPTY_FEATURES의 타입 오류).
type CoreKey = 'width' | 'height' | 'spawn' | 'solids' | 'goal' | 'checkpoints';
type FeatureKey = Exclude<keyof Level, CoreKey>;
export type LevelData = Pick<Level, CoreKey> & Partial<Pick<Level, FeatureKey>>;
const EMPTY_FEATURES: Pick<Level, FeatureKey> = {
  pipes: [],
  hills: [],
  hazards: [],
  fallingPlatforms: [],
  hiddenBlocks: [],
  enemies: [],
  ambushes: [],
  conditionalTraps: [],
  vanishingGrounds: [],
  invisibleBlocks: [],
  fallingCeilings: [],
  dodgingPlatforms: [],
  popUpSpikes: [],
  fakeCheckpoints: [],
  goalHops: [],
  skyDrops: [],
  flingZones: [],
  reverseZones: [],
  springFloors: [],
  fakeGoals: [],
  signs: [],
  boulders: [],
  fakeWalls: [],
  baitGems: [],
  landingSpikeZones: [],
  shadows: [],
  heavyZones: [],
  descendingCeilings: [],
  rhythmPlatforms: [],
  arrowTraps: [],
  mirrorEnemies: [],
  countingPlatforms: [],
  trampolines: [],
  conveyors: [],
  mudFloors: [],
  windZones: [],
  oneWayPlatforms: [],
  pipeEnemies: [],
  sinkingPipes: [],
  rollingStones: [],
  iceFloors: [],
};
export function defineLevel(data: LevelData): Level {
  return { ...EMPTY_FEATURES, ...data };
}
