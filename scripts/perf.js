// 렌더링 성능 측정(docs/history.md "렌더링 성능 측정"의 수치를 다시 잴 때). `pnpm perf`로 실행한다 — 먼저 프로덕션 빌드를 만든다.
// 1) 그리기만: Vite 개발 서버에서 모듈을 불러와 모든 레벨을 카메라 120px 간격으로 CanvasRenderer.render를 반복하고,
//    CPU 감속(1·4배)별 그리기 시간과 프레임당 fillRect 최대 횟수를 출력한다(기기 픽셀 비율 2).
// 2) 실제 게임: dist/를 Playwright가 직접 서빙해 →를 누른 채 달리며 requestAnimationFrame 299프레임 간격을 재고,
//    CPU 감속(4·6·8배)별로 20ms를 넘은 프레임 수를 그리기를 켠 채/끈 채 비교한다. 개발 모드(React 개발 빌드)는 더 느리므로 2)는 빌드로 잰다.
// 수치는 기계마다 다르다. 같은 기계에서 변경 전후를 비교하는 용도다.
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const RENDER_THROTTLES = [1, 4];
const FRAME_THROTTLES = [4, 6, 8];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml' };

async function newPage(browser, throttle) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  return { context, page, throttle: () => context.newCDPSession(page).then((cdp) => cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })) };
}

async function measureRender(browser, url) {
  const rows = [];
  for (const throttle of RENDER_THROTTLES) {
    const { context, page, throttle: slow } = await newPage(browser, throttle);
    await page.goto(url);
    await slow();
    const levels = await page.evaluate(async () => {
      const { CanvasRenderer } = await import('/src/game/rendering/CanvasRenderer.ts');
      const { World } = await import('/src/game/world/World.ts');
      const { LEVELS } = await import('/src/game/world/level.ts');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let fills = 0;
      const fillRect = ctx.fillRect.bind(ctx);
      ctx.fillRect = (...args) => { fills++; fillRect(...args); };
      const renderer = new CanvasRenderer(canvas, () => false);
      return LEVELS.map((level, i) => {
        const world = new World(level);
        const times = [];
        let maxFills = 0;
        for (let x = 0; x < level.width; x += 120) {
          world.player.x = x; world.player.y = 300;
          for (let k = 0; k < 2; k++) renderer.render(world, { fps: 60, steps: 1 }); // 워밍업
          for (let k = 0; k < 6; k++) {
            fills = 0;
            const t = performance.now();
            renderer.render(world, { fps: 60, steps: 1 });
            times.push(performance.now() - t);
            maxFills = Math.max(maxFills, fills);
          }
        }
        times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return { level: i + 1, avgMs: +avg.toFixed(3), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2), maxMs: +times.at(-1).toFixed(2), maxFills };
      });
    });
    for (const l of levels) rows.push({ cpu: `x${throttle}`, ...l });
    await context.close();
  }
  return rows;
}

async function measureFrames(browser, dist) {
  const rows = [];
  for (const throttle of FRAME_THROTTLES) {
    for (const draw of [true, false]) {
      const { context, page, throttle: slow } = await newPage(browser, throttle);
      await context.route('http://game.test/**', async (route) => {
        let path = new URL(route.request().url()).pathname.replace(/^\/trap-platformer\//, '');
        if (path === '' || path.endsWith('/')) path += 'index.html';
        try { await route.fulfill({ body: await readFile(join(dist, path)), contentType: TYPES[extname(path)] ?? 'application/octet-stream' }); }
        catch { await route.fulfill({ status: 404 }); }
      });
      if (!draw) await page.addInitScript(() => { CanvasRenderingContext2D.prototype.fillRect = () => {}; });
      await page.goto('http://game.test/trap-platformer/');
      await page.waitForTimeout(800);
      await slow();
      await page.keyboard.down('ArrowRight');
      const deltas = await page.evaluate(() => new Promise((resolve) => {
        const d = [];
        let prev = performance.now();
        const tick = (t) => { d.push(t - prev); prev = t; if (d.length < 300) requestAnimationFrame(tick); else resolve(d); };
        requestAnimationFrame(tick);
      }));
      await page.keyboard.up('ArrowRight');
      deltas.shift(); // 측정 시작 직후의 첫 간격은 버린다
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      rows.push({ cpu: `x${throttle}`, drawing: draw ? 'on' : 'off', avgMs: +avg.toFixed(2), over20ms: `${deltas.filter((x) => x > 20).length}/${deltas.length}` });
      await context.close();
    }
  }
  return rows;
}

const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
const browser = await chromium.launch();
try {
  console.log('1) 그리기만 (개발 서버, 기기 픽셀 비율 2, 레벨마다 카메라 120px 간격)');
  console.table(await measureRender(browser, server.resolvedUrls.local[0]));
  console.log('2) 실제 게임 프레임 간격 (프로덕션 빌드, → 유지, 20ms 초과 = 손실)');
  console.table(await measureFrames(browser, 'dist'));
} finally {
  await browser.close();
  await server.close();
}
