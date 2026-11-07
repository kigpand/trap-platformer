// README 스크린샷(docs/assets/screenshot.jpg, 800×600)과 링크 미리보기 이미지(public/og-image.png, 1200×630)를
// 현재 그래픽으로 다시 만든다. `pnpm shots`로 실행한다 — 먼저 프로덕션 빌드를 만든다.
// dist/를 Playwright가 직접 서빙해(perf.js와 같은 방식) 레벨 1 스폰 화면을 찍는다. 입력은 주지 않는다.
// - screenshot.jpg: 800×600 창(기기 픽셀 비율 1)의 페이지 윗부분 그대로
// - og-image.png: 제목·한 줄 소개 아래에 캔버스 아랫부분을 잘라 둔 1200×630 구성(캔버스는 기기 픽셀 비율 2로 그려 줄여 넣음)
// 폰트는 실행한 기계의 시스템 글꼴을 쓴다(페이지 CSS와 같음).
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const DIST = 'dist';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml' };

async function openGame(browser, viewport, deviceScaleFactor) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  await context.route('http://game.test/**', async (route) => {
    let path = new URL(route.request().url()).pathname.replace(/^\/trap-platformer\//, '');
    if (path === '' || path.endsWith('/')) path += 'index.html';
    try { await route.fulfill({ body: await readFile(join(DIST, path)), contentType: TYPES[extname(path)] ?? 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404 }); }
  });
  const page = await context.newPage();
  await page.goto('http://game.test/trap-platformer/');
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(800); // 첫 프레임들이 그려질 때까지
  return { context, page };
}

const OG_HTML = (canvas) => `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;width:1200px;height:630px;background:#090e19;color:#f5f6f8;font-family:Inter,system-ui,-apple-system,sans-serif;overflow:hidden}
  .wrap{padding:64px 64px 0}
  .eyebrow{color:#8fbba0;letter-spacing:.17em;font-size:18px;font-weight:700}
  h1{font-size:88px;letter-spacing:-.05em;margin:10px 0 6px;line-height:1.05}
  p{color:#9ca8b8;font-size:26px;margin:0 0 30px}
  .shot{height:300px;border:1px solid #394050;border-radius:14px;overflow:hidden;background:#101729}
  .shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:bottom}
</style>
<div class="wrap">
  <div class="eyebrow">BROWSER TRAP PLATFORMER</div>
  <h1>TRAP RUNNER</h1>
  <p>보이는 대로 믿으면 떨어진다 — 함정 30종 · 레벨 4개</p>
  <div class="shot"><img src="${canvas}"></div>
</div>`;

const browser = await chromium.launch();
try {
  const shot = await openGame(browser, { width: 800, height: 600 }, 1);
  await shot.page.screenshot({ path: 'docs/assets/screenshot.jpg', type: 'jpeg', quality: 85 });
  await shot.context.close();

  const game = await openGame(browser, { width: 1280, height: 900 }, 2);
  const canvas = await game.page.locator('canvas').evaluate((el) => el.toDataURL('image/png'));
  await game.context.close();
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.setContent(OG_HTML(canvas));
  await og.locator('img').evaluate((img) => img.decode());
  await og.screenshot({ path: 'public/og-image.png' });
  await og.close();
  console.log('docs/assets/screenshot.jpg, public/og-image.png 갱신');
} finally {
  await browser.close();
}
