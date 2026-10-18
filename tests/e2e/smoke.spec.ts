import { expect, test } from '@playwright/test';
test('canvas game mounts and displays HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TRAP RUNNER' })).toBeVisible();
  await expect(page.getByLabel('2D 횡스크롤 게임 화면')).toBeVisible();
  await expect(page.getByText('POSITION')).toBeVisible();
});

test('P pauses and resumes the simulation', async ({ page }) => {
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const beforePause = await position.textContent();

  await page.keyboard.press('KeyP');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const whilePaused = await position.textContent();
  expect(whilePaused).toBe(beforePause); // 일시 정지 중에는 입력이 무시되고 위치가 바뀌지 않는다

  await page.keyboard.press('KeyP');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const afterResume = await position.textContent();
  expect(afterResume).not.toBe(whilePaused); // 재개 후에는 다시 입력이 반영된다
});

test('R still restarts the run while paused', async ({ page }) => {
  // 코덱스 리뷰: 이동 -> P(정지) -> R(재시작) -> P(재개) 순서로 재현되는
  // "정지 중 재시작 요청이 사라지는" 버그의 회귀 테스트.
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  const spawnPosition = await position.textContent();

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const moved = await position.textContent();
  expect(moved).not.toBe(spawnPosition);

  await page.keyboard.press('KeyP'); // 정지
  await page.keyboard.press('KeyR'); // 정지 중 재시작
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyP'); // 재개

  await expect(position).toHaveText(spawnPosition!);
});
