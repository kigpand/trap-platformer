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
