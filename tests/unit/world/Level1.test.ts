import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1 } from '../../../src/game/world/level';
import { playSolution, recordInputs } from './solution';
import { ceiling, dodge, DODGE, FAKE_CLEAR_AND_GEM, fakeFlag, FULL, ICE, RHYTHM, SHADOW, SPIKES, SPRING_AND_GOAL, TAUNTING, TO_FAKE_FLAG, VANISHING_AND_CEILING } from './level1Solution';

const IDLE = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };

// 레벨 1(쉬움): 원래 구간(숨겨진 블록·적·가짜 안전지대·낙하 발판·갑자기 출현하는 적·조건부 함정) 뒤에
// 새 함정 4종을 하나씩 소개한다 — 사라지는 땅 → 떨어지는 천장 → 솟아오르는 가시(좁은 16px) → 도망가는 발판.
// 맵 3배 확장(약올리는 함정 5번): 예전 목표 자리가 가짜 클리어가 되고, 그 뒤로 보석 → 천장 통로·가짜 벽 → 얼음 →
// 박자 발판 → 그림자 → 스프링 순서로 약올리는 함정을 하나씩 소개한다(표지판은 가짜 클리어·얼음·스프링 앞).
// 완료 기준: 해법 입력으로 스폰과 모든 체크포인트에서 사망 없이 목표까지.
const [cp1, cp2, cp3, cp4, cp5, cp6, cp7] = LEVEL_1.checkpoints;
function respawnAt(cp: typeof cp1): World {
  const world = new World(LEVEL_1);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true); // 게임의 사망 재시작 경로로 체크포인트에서 시작한다
  return world;
}

describe('LEVEL_1 (easy, extended)', () => {
  it('is about three times its old 4000px and introduces the taunting traps one by one', () => {
    expect(LEVEL_1.width).toBe(12000);
    expect(LEVEL_1.goal.x).toBeGreaterThan(11000);
    expect(LEVEL_1.vanishingGrounds.length + LEVEL_1.fallingCeilings.length + LEVEL_1.popUpSpikes.length + LEVEL_1.dodgingPlatforms.length).toBe(4);
    const taunting = [LEVEL_1.fakeGoals, LEVEL_1.signs, LEVEL_1.springFloors, LEVEL_1.fakeWalls, LEVEL_1.baitGems,
      LEVEL_1.descendingCeilings, LEVEL_1.iceFloors, LEVEL_1.rhythmPlatforms, LEVEL_1.shadows];
    expect(taunting.every((list) => list.length > 0)).toBe(true);
    expect(fakeFlag().x).toBe(3940); // 예전 목표 자리
  });

  it('can be finished from spawn with the solution inputs and no deaths', () => {
    const world = new World(LEVEL_1);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
  });

  it.each([
    ['checkpoint 1 (before the hazard)', cp1, FULL],
    ['checkpoint 2 (before the vanishing ground)', cp2, [{ run: 1950 }, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE, ...TAUNTING]],
    ['checkpoint 3 (before the dodging platform)', cp3, [...DODGE, ...TAUNTING]],
    ['checkpoint 4 (after the fake clear)', cp4, TAUNTING],
    ['checkpoint 5 (before the ice)', cp5, [...ICE, ...RHYTHM, ...SHADOW, ...SPRING_AND_GOAL]],
    ['checkpoint 6 (before the rhythm platforms)', cp6, [...RHYTHM, ...SHADOW, ...SPRING_AND_GOAL]],
    ['checkpoint 7 (after the shadow)', cp7, SPRING_AND_GOAL],
  ] as const)('can be finished from %s with no further deaths', (_, cp, steps) => {
    const world = respawnAt(cp);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1); // 체크포인트로 보내려고 일부러 낸 사망 1회뿐
  });

  it('catches a player who just holds right through the new traps (each is a real trap)', () => {
    // 떨어지는 천장: 체크포인트 2에서 →만 누르면 사라지는 땅은 지나지만 천장에 깔린다
    const a = respawnAt(cp2);
    for (let i = 0; i < 600 && a.deaths === 1; i++) a.update(1 / 60, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(ceiling.block);
    // 도망가는 발판: 체크포인트 3에서 원래 발판으로 뛰면 발판이 도망간다
    const b = respawnAt(cp3);
    playSolution(b, [{ run: dodge.trigger.x + dodge.trigger.width - 2 }, { right: 1 }]);
    b.update(1 / 60, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 14; i++) b.update(1 / 60, { horizontal: 1, jumpPressed: false, restartPressed: false });
    for (let i = 0; i < 200 && b.deaths === 1; i++) b.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(b.deathCause?.rect).toBe(dodge.platform);
  });

  it('catches the naive play at each taunting trap', () => {
    const step = (w: World, horizontal: -1 | 0 | 1, jumpPressed = false) => w.update(1 / 60, { horizontal, jumpPressed, restartPressed: false });
    const until = (w: World, horizontal: -1 | 0 | 1, stop: () => boolean) => { for (let i = 0; i < 1200 && !stop(); i++) step(w, horizontal); };
    // 가짜 클리어: 깃발에서 "다음 레벨"을 누르면 떨어진다
    const fake = respawnAt(cp3);
    playSolution(fake, [...DODGE, { run: fakeFlag().x + 10 }]);
    expect(fake.snapshot().cleared).toBe(true);
    expect(fake.cleared).toBe(false);
    fake.collapseFakeFloor();
    until(fake, 0, () => fake.deaths > 1);
    expect(fake.snapshot().deathKind).toBe('fakeClear');
    // 가짜 벽: 막다른 길인 줄 알고 벽 앞에서 멈추면 천장에 깔린다
    const wall = respawnAt(cp4);
    playSolution(wall, FAKE_CLEAR_AND_GEM);
    until(wall, 1, () => wall.player.x + wall.player.width >= LEVEL_1.fakeWalls[0].x);
    until(wall, 0, () => wall.deaths > 1);
    expect(wall.snapshot().deathKind).toBe('descendingCeiling');
    // 얼음: "멈추면 안전" 표지판 말대로 구덩이 앞에서 키를 떼면 미끄러져 떨어진다
    const ice = respawnAt(cp5);
    until(ice, 1, () => ice.player.x + ice.player.width >= 6460);
    until(ice, 0, () => ice.deaths > 1);
    expect(ice.snapshot().deathKind).toBe('ice');
    // 박자 발판: 늦게 올라타 그 위에서 머뭇거리면 발밑에서 사라진다(이미 사라진 발판으로 뛰어든 낙사는 원인 없는 낙사다)
    const rhythm = respawnAt(cp6);
    playSolution(rhythm, [{ run: 7398 }, { waitUntil: (w) => w.lifeTime % 2 > 0.4 && w.lifeTime % 2 < 0.45 }, { jump: true }]);
    until(rhythm, 0, () => rhythm.deaths > 1);
    expect(rhythm.snapshot().deathKind).toBe('rhythmPlatform');
    // 그림자: 구간 안에서 멈추면 2초 뒤 잡힌다
    const shadow = respawnAt(cp6);
    playSolution(shadow, [...RHYTHM, { run: 8100 }]);
    until(shadow, 0, () => shadow.deaths > 1);
    expect(shadow.snapshot().deathKind).toBe('shadow');
    // 스프링: 그냥 달려가면 튕겨 한참 뒤로 날아간다(죽지는 않는다)
    const spring = respawnAt(cp7);
    until(spring, 1, () => spring.flight !== null);
    expect(spring.taunt?.kind).toBe('springFloor');
    until(spring, 1, () => spring.flight === null);
    expect(spring.player.x).toBeLessThan(11300);
    expect(spring.deaths).toBe(1);
  });

  it('kills a player who goes for the bait gem in the pit', () => {
    const world = respawnAt(cp4);
    playSolution(world, [{ run: 4840 }]); // 구덩이로 걸어 들어가 보석에 닿는다
    for (let i = 0; i < 200 && world.deaths === 1; i++) world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(world.baitGems[0].taken).toBe(false); // 사망해 다시 나타났다
    expect(world.snapshot().deathKind).toBe('baitGem');
  });

  it('reaches the fake flag even with the inputs a step early or late (E2E replays them with a frame phase it cannot fix)', () => {
    // 브라우저의 가짜 시계는 16ms마다 프레임을 내고 고정 스텝은 1/60초라, E2E는 시작 위상에 따라 입력이 한 스텝 앞뒤로 밀릴 수 있다.
    const inputs = recordInputs(new World(LEVEL_1), TO_FAKE_FLAG);
    for (const shift of [-1, 0, 1]) {
      const world = new World(LEVEL_1);
      const shifted = shift < 0 ? inputs.slice(1) : [...Array(shift).fill(IDLE), ...inputs];
      for (const input of shifted) world.update(1 / 60, input);
      expect(world.deaths, `shift ${shift}`).toBe(0);
      expect(world.fakeClear, `shift ${shift}`).not.toBeNull();
    }
  });
});
