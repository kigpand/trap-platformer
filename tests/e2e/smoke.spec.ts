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
  await expect(position).toBeVisible(); // GameController가 마운트되어 입력 리스너가 붙을 때까지 대기
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const beforePause = await position.textContent();
  expect(beforePause).not.toMatch(/^POSITION 65, /); // 정지 전에 실제로 이동했는지 확인

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(50); // keydown 직후 홀드를 바로 시작하면 정지가 적용되기 전 한 프레임이 더 움직일 수 있다
  const pausedBaseline = await position.textContent();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const whilePaused = await position.textContent();
  expect(whilePaused).toBe(pausedBaseline); // 일시 정지 중에는 입력이 무시되고 위치가 바뀌지 않는다

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(50);
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
  await expect(position).toBeVisible();
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

test('the on-screen pause/restart buttons work the same as the keyboard shortcuts', async ({ page }) => {
  // 키보드가 없는(터치) 사용자와 스크린 리더 사용자를 위한 버튼 — docs/game-design.md는
  // 가상 D-패드 등 이동 조작의 터치 지원은 추가 목표로 미루지만, 정지/재시작 버튼은
  // 이번 접근성 작업의 범위다.
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  const pauseButton = page.getByRole('button', { name: '일시정지/재개 (P)' });
  const restartButton = page.getByRole('button', { name: '재시작 (R)' });
  await expect(position).toBeVisible();

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  const moved = await position.textContent();
  expect(moved).not.toMatch(/^POSITION 65, /);

  await pauseButton.click();
  await page.waitForTimeout(50);
  const pausedBaseline = await position.textContent();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  expect(await position.textContent()).toBe(pausedBaseline); // 정지 버튼을 누른 뒤에는 입력이 반영되지 않는다

  await restartButton.click(); // 정지 중에도 재시작 버튼은 바로 적용된다
  expect(await position.textContent()).toMatch(/^POSITION 65, /);
});

test('Space activates a focused button instead of being swallowed as a jump', async ({ page }) => {
  // 코덱스 리뷰: 전역 입력 리스너가 포커스된 버튼에서도 Space를 가로채 점프로 소비하고
  // preventDefault()를 호출해서, 키보드 사용자가 버튼을 Space로 "누를" 수 없었다.
  // 버튼 포커스 중에도 방향키는 게임으로 전달되므로, 위치 변화로 정지 여부를 구분할 수 있다.
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  const pauseButton = page.getByRole('button', { name: '일시정지/재개 (P)' });
  await expect(position).toBeVisible();
  await pauseButton.focus();

  await page.keyboard.press('Space'); // 버튼 활성화 → 정지
  await page.waitForTimeout(50);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).toHaveText(/^POSITION 65, /); // 정지 상태라 이동하지 않는다

  await page.keyboard.press('Space'); // 다시 활성화 → 재개
  await page.waitForTimeout(50);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /); // 버튼에 포커스가 남아 있어도 이동 입력이 반영된다
});

test('movement keys still work after clicking an on-screen button with the mouse', async ({ page }) => {
  // 클릭 후 포커스가 버튼에 남아도 방향키 입력이 게임에 전달되어야 한다.
  await page.goto('/');
  const position = page.locator('.hud span', { hasText: 'POSITION' });
  await expect(position).toBeVisible();
  await page.getByRole('button', { name: '재시작 (R)' }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /);
});
