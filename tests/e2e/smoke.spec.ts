import { expect, test } from '@playwright/test';
test('canvas game mounts and displays HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TRAP RUNNER' })).toBeVisible();
  await expect(page.getByLabel('2D 횡스크롤 게임 화면')).toBeVisible();
  await expect(page.getByText('POSITION')).toBeVisible();
});

test('R restarts the run back to spawn', async ({ page }) => {
  // 스폰 Y(350)는 바닥(500) 위 공중이라 재시작 직후에도 자유낙하가 다시 시작된다 —
  // Y가 안정될 때까지(착지) 기다린 뒤 X만 스폰 값으로 돌아왔는지 확인한다.
  // ("65, 350" 문자열이 다시 나타나길 기다리면 착지 전의 한 프레임만 우연히 잡아야 해서 깨지기 쉽다.)
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  const grounded = page.locator('.hud span', { hasText: 'GROUNDED' });
  await expect(position).toBeVisible(); // GameController가 마운트되어 입력 리스너가 붙을 때까지 대기

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const moved = await position.textContent();
  expect(moved).not.toMatch(/^POSITION 65, /);

  await page.keyboard.press('KeyR');
  await expect(grounded).toHaveText('GROUNDED YES');
  await expect(position).toHaveText(/^POSITION 65, \d+$/);
});
