import { expect, test, type Page } from '@playwright/test';

// POSITION·GROUNDED는 B(충돌 박스 표시)를 켰을 때만 HUD에 보인다. 키 리스너가 붙기 전에 누른 B는 사라지므로
// 보일 때까지 다시 누른다(이미 보이면 누르지 않아 도로 꺼지지 않는다). 컨트롤러를 새로 만들면 다시 꺼진다.
async function showDebugHud(page: Page): Promise<void> {
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  await expect(async () => {
    if (!(await position.isVisible())) await page.keyboard.press('KeyB');
    await expect(position).toBeVisible({ timeout: 500 });
  }).toPass();
}
test('canvas game mounts and displays HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TRAP RUNNER' })).toBeVisible();
  await expect(page.getByLabel('2D 횡스크롤 게임 화면')).toBeVisible();
  await expect(page.locator('.hud .hud-stat', { hasText: 'LEVEL' })).toBeVisible();
  // 위치·착지 상태는 디버그 정보라 평소에는 보이지 않고, B를 누르면 나타났다가 다시 누르면 사라진다.
  await expect(page.locator('.hud .hud-stat', { hasText: 'POSITION' })).toHaveCount(0);
  await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveCount(0);
  await showDebugHud(page);
  await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toBeVisible();
  await page.keyboard.press('KeyB');
  await expect(page.locator('.hud .hud-stat', { hasText: 'POSITION' })).toHaveCount(0);
});

test('P pauses and resumes the simulation', async ({ page }) => {
  await page.goto('/');
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
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
  // 스폰(Y 350)은 공중이라 시작 직후의 좌표는 낙하 중 값이다. 그 값을 기준으로 저장하면 재시작 후
  // 정확히 같은 낙하 프레임을 잡아야만 통과해 부하가 걸리면 실패했다 — 착지를 기다린 뒤 X만 비교한다.
  await page.goto('/');
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  const grounded = page.locator('.hud .hud-stat', { hasText: 'GROUNDED' });
  await expect(grounded).toHaveText('GROUNDED YES');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /);

  await page.keyboard.press('KeyP'); // 정지
  await page.keyboard.press('KeyR'); // 정지 중 재시작
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyP'); // 재개

  await expect(grounded).toHaveText('GROUNDED YES');
  await expect(position).toHaveText(/^POSITION 65, \d+$/); // 재시작 요청이 사라졌다면 이동한 X에 그대로 남는다
});

test('R restarts the run back to spawn', async ({ page }) => {
  // 스폰 Y(350)는 바닥(500) 위 공중이라 재시작 직후에도 자유낙하가 다시 시작된다 —
  // Y가 안정될 때까지(착지) 기다린 뒤 X만 스폰 값으로 돌아왔는지 확인한다.
  // ("65, 350" 문자열이 다시 나타나길 기다리면 착지 전의 한 프레임만 우연히 잡아야 해서 깨지기 쉽다.)
  await page.goto('/');
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  const grounded = page.locator('.hud .hud-stat', { hasText: 'GROUNDED' });
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
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
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
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
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
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  await expect(position).toBeVisible();
  await page.getByRole('button', { name: '재시작 (R)' }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /);
});

test('pause and mute state are shown on the HUD buttons and in the pause menu', async ({ page }) => {
  // 정지 표시가 캔버스 안에만 있으면 스크린 리더와 HUD에서 상태를 알 수 없었다. 이제 정지하면 게임 위에 일시정지 창이 뜬다.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const pauseMenu = page.getByRole('dialog', { name: '일시정지' });
  const pauseButton = page.getByRole('button', { name: '일시정지/재개 (P)' });
  const muteButton = page.getByRole('button', { name: '음소거 (M)' });
  await expect(pauseMenu).toHaveCount(0);
  await expect(muteButton).toHaveAttribute('aria-pressed', 'false');

  await pauseButton.click();
  await expect(pauseMenu).toBeVisible();
  await expect(pauseButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveText(/일시정지됨/);
  await pauseMenu.getByRole('button', { name: '소리 끄기 (M)' }).click(); // 정지 창의 소리 버튼은 HUD 음소거와 같은 상태
  await expect(muteButton).toHaveAttribute('aria-pressed', 'true');
  await expect(pauseMenu.getByRole('button', { name: '소리 켜기 (M)' })).toBeVisible();
  await pauseMenu.getByRole('button', { name: '계속하기 (P)' }).click();
  await expect(pauseMenu).toHaveCount(0);
  await expect(pauseButton).toHaveAttribute('aria-pressed', 'false');
  await pauseButton.click();
  await page.keyboard.press('KeyP'); // 키보드로도 닫힌다
  await expect(pauseMenu).toHaveCount(0);

  await muteButton.click();
  await expect(muteButton).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('KeyM');
  await expect(muteButton).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('KeyM');
  await expect(muteButton).toHaveAttribute('aria-pressed', 'false');

  await page.getByLabel('2D 횡스크롤 게임 화면').click(); // 버튼 포커스를 해제해 Space가 버튼이 아닌 점프로 가게 한다
  await page.keyboard.press('Space'); // 첫 키 입력에서 AudioContext를 준비하고 점프 효과음을 재생해도 오류가 없어야 한다
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('a crash inside the game loop shows a recovery screen instead of a frozen page, and restart recovers', async ({ page }) => {
  // RAF 콜백 안의 예외는 이전에는 아무 안내 없이 게임을 멈춘 채 남겼다.
  await page.goto('/');
  await showDebugHud(page);
  // 테스트 전용 훅 없이 실제 그리기 단계에서 예외를 일으킨다.
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __fillRect?: typeof CanvasRenderingContext2D.prototype.fillRect };
    proto.__fillRect = proto.fillRect;
    proto.fillRect = () => { throw new Error('forced render failure'); };
  });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('문제가 발생했습니다');

  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __fillRect?: typeof CanvasRenderingContext2D.prototype.fillRect };
    if (proto.__fillRect) proto.fillRect = proto.__fillRect;
  });
  await alert.getByRole('button', { name: '다시 시작' }).click();
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  await showDebugHud(page); // 새 컨트롤러는 디버그 보기가 꺼진 채 시작한다
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /); // 새 게임 루프가 실제로 돌고 있다
});

test('the mute setting survives a page reload', async ({ page }) => {
  await page.goto('/');
  const muted = page.getByRole('button', { name: '음소거 (M)' });
  await expect(muted).toHaveAttribute('aria-pressed', 'false');
  await muted.click();
  await expect(muted).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(muted).toHaveAttribute('aria-pressed', 'true');
  await showDebugHud(page); // 키 리스너가 붙을 때까지 기다린다
  await page.keyboard.press('KeyM');
  await expect(muted).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(muted).toHaveAttribute('aria-pressed', 'false');
});

test('the volume setting survives a page reload', async ({ page }) => {
  // 음량은 일시정지 창에서 바꾼다.
  await page.goto('/');
  const slider = page.getByRole('slider');
  const label = page.locator('label.volume');
  await page.getByRole('button', { name: '일시정지/재개 (P)' }).click();
  await expect(label).toContainText('음량 80%');
  await slider.fill('35');
  await expect(label).toContainText('음량 35%');
  await page.reload();
  await page.getByRole('button', { name: '일시정지/재개 (P)' }).click();
  await expect(label).toContainText('음량 35%');
  await expect(slider).toHaveValue('35');
});

test('the game still runs and mute still toggles when localStorage is blocked', async ({ page }) => {
  // 시크릿 모드·사이트 데이터 차단 환경에서는 localStorage 접근 자체가 예외를 던진다.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  const muted = page.getByRole('button', { name: '음소거 (M)' });
  await expect(muted).toHaveAttribute('aria-pressed', 'false');
  await expect(async () => { // 키 리스너가 붙기 전에 누른 M은 사라지므로 바뀔 때까지 다시 누른다
    if ((await muted.getAttribute('aria-pressed')) === 'false') await page.keyboard.press('KeyM');
    await expect(muted).toHaveAttribute('aria-pressed', 'true', { timeout: 500 });
  }).toPass();
  await expect(page.getByRole('alert')).toHaveCount(0); // 오류 복구 화면으로 넘어가지 않는다
});

test('the run timer counts while playing and stops while paused', async ({ page }) => {
  await page.goto('/');
  const time = page.locator('.hud .hud-stat', { hasText: 'TIME' });
  await expect(time).not.toHaveText('TIME 0.0s'); // 시작하면 흐른다
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(100);
  const paused = await time.textContent();
  await page.waitForTimeout(500);
  expect(await time.textContent()).toBe(paused); // 정지 중에는 멈춘다
  await page.keyboard.press('KeyR'); // 정지 중 재시작도 새 런으로 시간을 되돌린다
  await expect(time).toHaveText('TIME 0.0s');
});

test('shows the stored best record, and ignores a corrupted one', async ({ page }) => {
  const best = page.locator('.hud .hud-stat', { hasText: 'BEST' });
  await page.addInitScript(() => localStorage.setItem('trap-runner:best:v2:1', JSON.stringify({ time: 12.3, deaths: 2 })));
  await page.goto('/');
  await expect(best).toHaveText('BEST 12.3s / 2 FALLS');

  await page.addInitScript(() => localStorage.setItem('trap-runner:best:v2:1', '{not json'));
  await page.reload();
  await expect(best).toHaveText('BEST —');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('picks up a best record saved in another tab right away', async ({ page, context }) => {
  // storage 이벤트는 같은 브라우저의 다른 탭에서 저장했을 때만 온다 — 같은 컨텍스트에 탭을 하나 더 열어 저장한다.
  await page.goto('/');
  const best = page.locator('.hud .hud-stat', { hasText: 'BEST' });
  await expect(best).toHaveText('BEST —');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => localStorage.setItem('trap-runner:best:v2:1', JSON.stringify({ time: 42.5, deaths: 3 })));
  await expect(best).toHaveText('BEST 42.5s / 3 FALLS'); // 새로고침 없이
  await other.close();
});

test('touch controls are hidden on a desktop (fine pointer) layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '오른쪽으로 이동' })).toBeHidden();
});

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  // 실제 터치 이벤트(CDP)로 누르고 있다가 뗀다 — 합성 PointerEvent로는 포인터 캡처를 검증할 수 없다.
  async function holdTouch(page: import('@playwright/test').Page, name: string, ms: number): Promise<void> {
    const box = await page.getByRole('button', { name }).boundingBox();
    if (!box) throw new Error(`${name} button is not visible`);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('holding the on-screen right button moves the player, and releasing stops it', async ({ page }) => {
    await page.goto('/');
    await showDebugHud(page);
    const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
    const grounded = page.locator('.hud .hud-stat', { hasText: 'GROUNDED' });
    await expect(grounded).toHaveText('GROUNDED YES');
    await holdTouch(page, '오른쪽으로 이동', 300);
    await expect(position).not.toHaveText(/^POSITION 65, /);
    await page.waitForTimeout(100); // touchEnd가 다음 프레임에 반영될 때까지 한 프레임(약 4px) 이동이 남을 수 있다
    const afterRelease = await position.textContent();
    await page.waitForTimeout(300);
    expect(await position.textContent()).toBe(afterRelease); // 손을 떼면 멈춘다(입력이 눌린 채 남지 않는다)
  });

  test('lifting one of two fingers on the same move button keeps moving until the last finger lifts', async ({ page }) => {
    // 코덱스 리뷰: 포인터를 구분하지 않고 해제해서, ▶를 두 손가락으로 누른 뒤 하나만 떼도 이동이 멈췄다.
    await page.goto('/');
    await showDebugHud(page);
    const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
    await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveText('GROUNDED YES');
    const box = await page.getByRole('button', { name: '오른쪽으로 이동' }).boundingBox();
    if (!box) throw new Error('right button is not visible');
    const first = { x: box.x + box.width * 0.3, y: box.y + box.height / 2, id: 1 };
    const second = { x: box.x + box.width * 0.7, y: box.y + box.height / 2, id: 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] }); // 첫 손가락만 뗀다
    await page.waitForTimeout(100);
    const oneFingerLeft = await position.textContent();
    await page.waitForTimeout(300);
    expect(await position.textContent()).not.toBe(oneFingerLeft); // 남은 손가락으로 계속 이동한다
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); // 마지막 손가락
    await page.waitForTimeout(100);
    const released = await position.textContent();
    await page.waitForTimeout(300);
    expect(await position.textContent()).toBe(released);
  });

  test('tapping the on-screen jump button jumps', async ({ page }) => {
    await page.goto('/');
    await showDebugHud(page);
    const grounded = page.locator('.hud .hud-stat', { hasText: 'GROUNDED' });
    await expect(grounded).toHaveText('GROUNDED YES');
    await holdTouch(page, '점프', 50);
    await expect(grounded).toHaveText('GROUNDED NO');
  });
});

test('shows the keyboard help on a desktop layout, not the touch help', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Space / ↑ / W 점프')).toBeVisible();
  await expect(page.getByText('◀ ▶ 버튼을 누르고 있는 동안 이동')).toBeHidden();
});

// 2026-11-28 리뷰: 휴대폰 가로에서는 게임이 화면 너비를 채워 높이를 넘었고, ◀ ▶ ▲가 그 아래(화면 밖)에 있어 스크롤해야 조작할 수 있었다.
test.describe('on a touch device in landscape', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

  test('fits the game and all three touch buttons on screen without scrolling, and the buttons still move the player', async ({ page }) => {
    await page.goto('/');
    const inside = async (selector: string): Promise<void> => {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      if (!box) return;
      expect(box.y, selector).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, selector).toBeLessThanOrEqual(390);
      expect(box.x, selector).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, selector).toBeLessThanOrEqual(844);
    };
    for (const selector of ['.game-shell', '.touch-left', '.touch-right', '.touch-jump']) await inside(selector);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await showDebugHud(page);
    const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
    await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveText('GROUNDED YES');
    const box = await page.getByRole('button', { name: '오른쪽으로 이동' }).boundingBox();
    if (!box) throw new Error('right button is not visible');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(position).not.toHaveText(/^POSITION 65, /);
  });
});

test.describe('help text on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('shows the touch help instead of keyboard shortcuts', async ({ page }) => {
    // 터치 기기에는 키보드가 없어 단축키 안내가 쓸모없었다.
    await page.goto('/');
    await expect(page.getByText('◀ ▶ 버튼을 누르고 있는 동안 이동')).toBeVisible();
    await expect(page.getByText('Space / ↑ / W 점프')).toBeHidden();
  });
});

test('the volume slider setting survives a reload, and a broken stored value falls back to the default', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: /음량/ });
  const openMenu = () => page.getByRole('button', { name: '일시정지/재개 (P)' }).click(); // 음량은 일시정지 창에 있다
  await openMenu();
  await expect(slider).toHaveValue('80');
  await slider.fill('35');
  await expect(page.getByText('음량 35%')).toBeVisible();
  await page.reload();
  await openMenu();
  await expect(slider).toHaveValue('35');

  await page.evaluate(() => localStorage.setItem('trap-runner:volume', 'loud'));
  await page.reload();
  await openMenu();
  await expect(slider).toHaveValue('80');
});

test('arrow keys still move the player after adjusting the volume slider with the mouse', async ({ page }) => {
  // 슬라이더에 포커스가 남으면 방향키가 음량을 바꾸고 이동 입력은 무시된다.
  await page.goto('/');
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveText('GROUNDED YES');
  await page.getByRole('button', { name: '일시정지/재개 (P)' }).click(); // 음량은 일시정지 창에 있다
  await page.getByRole('slider', { name: /음량/ }).click();
  await page.keyboard.press('KeyP'); // 키보드로 재개
  await expect(page.getByRole('dialog', { name: '일시정지' })).toHaveCount(0);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(/^POSITION 65, /);
});

test('shows the current level, and keeps the next-level control hidden and N ignored before a clear', async ({ page }) => {
  // 레벨 전환 자체(클리어 → 레벨 2)는 실제 입력으로 레벨 1을 완주해야 해서 E2E로는 불안정하다 —
  // tests/unit/core/GameController.test.ts가 실제 컨트롤러로 검증한다. 여기서는 화면 연결만 확인한다.
  await page.goto('/');
  const level = page.locator('.hud .hud-stat', { hasText: 'LEVEL' });
  await expect(level).toHaveText(/^LEVEL 1 \/ \d+$/);
  await expect(page.getByRole('button', { name: '다음 레벨 (N)' })).toHaveCount(0);
  await page.keyboard.press('KeyN'); // 클리어 전에는 무시된다
  await page.waitForTimeout(100);
  await expect(level).toHaveText(/^LEVEL 1 \//);
});

test('a trap death announces the taunting message to screen readers', async ({ page }) => {
  // 스폰에서 오른쪽으로 걸으면 숨겨진 블록이 무너져 떨어진다(원인: 숨겨진 블록).
  await page.goto('/');
  await showDebugHud(page);
  await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveText('GROUNDED YES');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('.hud .hud-stat', { hasText: 'FALLS' })).toHaveText('FALLS 1', { timeout: 5000 });
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('status')).toContainText('거기 바닥 있는 줄 알았지?');
});

test('a connected gamepad moves the player and Start pauses', async ({ page }) => {
  // 실제 패드 없이 navigator.getGamepads를 바꿔 끼워, 브라우저에서 InputManager가 패드를 읽는 경로를 확인한다.
  await page.addInitScript(() => {
    const state = { right: false, start: false };
    Object.assign(window, { padState: state });
    const buttons = (): { pressed: boolean }[] => Array.from({ length: 17 }, (_, i) => ({ pressed: (i === 15 && state.right) || (i === 9 && state.start) }));
    Object.defineProperty(navigator, 'getGamepads', { value: () => [{ index: 0, axes: [0, 0], buttons: buttons() }] });
  });
  await page.goto('/');
  await showDebugHud(page);
  const position = page.locator('.hud .hud-stat', { hasText: 'POSITION' });
  const pauseMenu = page.getByRole('dialog', { name: '일시정지' });
  await expect(page.locator('.hud .hud-stat', { hasText: 'GROUNDED' })).toHaveText('GROUNDED YES');
  const setPad = (key: 'right' | 'start', pressed: boolean) => page.evaluate(([k, p]) => {
    (window as unknown as { padState: Record<string, boolean> }).padState[k as string] = p as boolean;
  }, [key, pressed] as const);

  await setPad('right', true);
  await expect(position).not.toHaveText(/^POSITION 65, /);
  await setPad('right', false);

  await setPad('start', true);
  await expect(pauseMenu).toBeVisible();
  await setPad('start', false);
});

// 누적 사망 기록(docs/game-design.md "기록"): 실제로 죽은 사망이 새로고침 뒤에도 남고, B를 켰을 때만 보이며, 버튼으로 지운다.
test('the cumulative death log survives a reload, shows only with B, and clears from its button', async ({ page }) => {
  await page.goto('/');
  const falls = page.locator('.hud .hud-stat', { hasText: 'FALLS' });
  const panel = page.getByLabel('누적 사망 기록');
  const title = panel.locator('h2');
  await expect(panel).toHaveCount(0);
  await showDebugHud(page); // 입력 리스너가 붙을 때까지 기다리는 역할도 한다
  await expect(title).toHaveText('누적 사망 기록 — 레벨 1, 0회');
  await page.keyboard.down('ArrowRight'); // 첫 함정(숨겨진 블록)으로 달려 들어가 죽는다
  await expect(falls).not.toHaveText('FALLS 0', { timeout: 10_000 });
  await page.keyboard.up('ArrowRight');
  await expect(title).toHaveText(/누적 사망 기록 — 레벨 1, [1-9]\d*회/); // 플레이 중에도 바로 쌓인다
  const logged = await title.textContent();
  await page.reload();
  await expect(falls).toHaveText('FALLS 0'); // 이번 런은 새로 시작
  await expect(panel).toHaveCount(0); // 새로고침하면 B가 꺼진 채 시작한다
  await showDebugHud(page);
  await expect(title).toHaveText(logged ?? '');
  await expect(panel.locator('li').first()).toContainText('숨겨진 블록');
  await panel.getByRole('button', { name: '누적 사망 기록 지우기 (모든 레벨)' }).click();
  await expect(title).toHaveText('누적 사망 기록 — 레벨 1, 0회');
  await page.reload();
  await showDebugHud(page);
  await expect(title).toHaveText('누적 사망 기록 — 레벨 1, 0회');
});
