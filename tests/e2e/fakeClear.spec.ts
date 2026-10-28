import { expect, test, type Page } from '@playwright/test';
import { World, type InputState } from '../../src/game/world/World';
import { LEVEL_1 } from '../../src/game/world/level';
import { recordInputs } from '../unit/world/solution';
import { TO_FAKE_FLAG } from '../unit/world/level1Solution';

// 가짜 클리어(#14)를 실제 키보드 입력으로 끝까지 확인한다. 가짜 깃발은 레벨 1의 예전 목표 자리(3940)라 거기까지 실제로 가야 하는데,
// 실시간으로 키를 누르면 프레임 타이밍이 흔들려 순찰 적·함정 타이밍이 매번 달라진다. 그래서:
// 1. Playwright 가짜 시계를 페이지를 열기 전에 멈춰 두면, 게임 루프의 첫 프레임과 이후 16ms 간격 프레임이 정확히 정해진다.
// 2. 단위 테스트와 같은 해법(level1Solution.ts)을 Node의 World로 돌려 스텝마다 넣은 입력을 기록한다.
// 3. GameLoop의 누적 계산을 그대로 따라 해 프레임마다 몇 스텝이 도는지 알아내고, 그 스텝의 입력을 프레임 직전에 키로 넣는다.
// 그러면 브라우저의 World가 Node와 같은 입력을 같은 스텝 순서로 받는다.
const FRAME_MS = 16; // Playwright 가짜 시계의 requestAnimationFrame 간격
const STEP = 1 / 60;

// src/game/core/GameLoop.ts의 tick과 같은 계산으로, 프레임 시각마다 이번 프레임에 도는 스텝 수를 돌려준다.
function gameLoopSteps(): (now: number) => number {
  let previous: number | undefined;
  let accumulator = 0;
  return (now) => {
    if (previous === undefined) previous = now;
    accumulator += Math.min(0.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    let steps = 0;
    while (accumulator >= STEP && steps < 6) { accumulator -= STEP; steps++; }
    if (steps === 6) accumulator = 0;
    return steps;
  };
}

async function replay(page: Page, inputs: readonly InputState[], firstFrame: number): Promise<number> {
  const stepsAt = gameLoopSteps();
  let held: -1 | 0 | 1 = 0;
  const hold = async (horizontal: -1 | 0 | 1): Promise<void> => {
    if (horizontal === held) return;
    if (held === 1) await page.keyboard.up('ArrowRight');
    if (held === -1) await page.keyboard.up('ArrowLeft');
    if (horizontal === 1) await page.keyboard.down('ArrowRight');
    if (horizontal === -1) await page.keyboard.down('ArrowLeft');
    held = horizontal;
  };
  let next = 0;
  let now = firstFrame;
  while (next < inputs.length) {
    const steps = stepsAt(now);
    if (steps > 1) throw new Error(`a ${FRAME_MS}ms frame should run at most one step, got ${steps}`);
    if (steps === 1) {
      const input = inputs[next++];
      await hold(input.horizontal);
      if (input.jumpPressed) { await page.keyboard.down('Space'); await page.keyboard.up('Space'); } // 눌린 순간 큐에 들어가 이 스텝에 쓰인다
    }
    await page.clock.runFor(FRAME_MS);
    now += FRAME_MS;
  }
  await hold(0);
  return now;
}

test('a fake clear looks real, and "next level" drops the floor instead of advancing', async ({ page }) => {
  test.setTimeout(120_000);
  const inputs = recordInputs(new World(LEVEL_1), TO_FAKE_FLAG);
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000); // 페이지를 열기 전에 멈춘다 — 게임 루프는 아래 replay가 시계를 돌릴 때 처음 프레임을 받는다
  await page.goto('/');
  const hud = (label: string) => page.locator('.hud span', { hasText: label });
  await expect(hud('LEVEL')).toHaveText(/^LEVEL 1 \//);
  await expect(hud('POSITION')).toHaveText('POSITION 65, 350'); // 아직 한 스텝도 돌지 않았다

  await replay(page, inputs, 1008); // 1000에서 멈춘 시계의 첫 requestAnimationFrame은 1008

  // 진짜 클리어와 같은 화면: HUD 상태·다음 레벨 버튼·스크린 리더 알림
  await expect(hud('STATUS')).toHaveText(/^STATUS (NEW RECORD!|CLEAR!)$/);
  await expect(page.getByRole('button', { name: '다음 레벨 (N)' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('레벨 1 클리어!');

  // N을 누르면 다음 레벨 대신 바닥이 꺼져 떨어진다. 레벨은 그대로이고 기록도 저장하지 않는다.
  await page.keyboard.press('KeyN');
  await page.clock.runFor(3000);
  await expect(hud('FALLS')).toHaveText('FALLS 1');
  await expect(hud('LEVEL')).toHaveText(/^LEVEL 1 \//);
  await expect(page.getByRole('status')).toContainText('벌써 끝난 줄 알았지?');
  expect(await page.evaluate(() => localStorage.getItem('trap-runner:best:v2:1'))).toBeNull();
});
