import type { Rect } from '../physics/AABB';

// 땅·블록의 픽셀 질감. 무늬는 월드 좌표로만 정한다(사각형의 가장자리·크기와 상관없음) — 그래야 이어 붙인 바닥에 이음매가
// 보이지 않고, 같은 자리를 그리면 일반 바닥이든 바닥으로 위장한 함정(가짜 안전지대·사라지는 땅·숨겨진 블록 등)이든
// 똑같이 그려져 위장이 깨지지 않는다(docs/traps-spec.md의 텔레그래프). 같은 이유로 테두리·모서리 음영은 넣지 않는다.
// view는 화면에 보이는 월드 범위로, 그 밖의 무늬는 그리지 않는다. 움직이는 바닥(도망가는 발판)은 slide에 처음 자리에서
// 움직인 만큼을 넘겨, 무늬가 바닥 위에서 미끄러지지 않고 같이 움직이게 한다(멈춰 있을 때는 주변 바닥과 같은 무늬).
// 색은 "후드 러너" 숲 방향(2026-11-24, UI 개편 3단계): 짙은 풀과 따뜻한 갈색 흙, 공중 블록은 회청색 옛 돌벽.
export const GROUND_FILL = '#5c4636';
export const GROUND_TOP = '#6dbb5d';
const GROUND_TOP_HEIGHT = 8;
const GRASS_SHADE = '#4f9a4a'; // 풀과 흙 사이 줄
const GRASS_LIGHT = '#a9e48f'; // 풀 윗면의 밝은 점
const SOIL_SPECK = '#463428'; // 흙 속 작은 돌
export const BLOCK_FILL = '#5f6680';
export const BLOCK_TOP = '#8d97b3';
const BLOCK_MORTAR = '#474d63'; // 돌 줄눈
const CELL = 16;
const BRICK_W = 20;
const BRICK_H = 10;

export interface View { x: number; width: number; height: number }
const NO_SLIDE = { x: 0, y: 0 };

// 칸 좌표로 정해지는 0~255의 고정 값(무작위 대신 — 매 프레임 같은 무늬, 테스트에서 재현).
function hash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

// r 안쪽으로 잘라 칠한다(잘린 부분이 없으면 그리지 않음).
function fillClipped(ctx: CanvasRenderingContext2D, r: Rect, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(x, r.x), y0 = Math.max(y, r.y);
  const x1 = Math.min(x + w, r.x + r.width), y1 = Math.min(y + h, r.y + r.height);
  if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// 보이는 부분(가로는 view, 세로는 캔버스 높이까지)만 남긴 사각형. 무늬 칸 수를 화면 크기로 묶는다.
function visiblePart(r: Rect, view: View): Rect | null {
  const x0 = Math.max(r.x, view.x), x1 = Math.min(r.x + r.width, view.x + view.width);
  const y1 = Math.min(r.y + r.height, view.height);
  return x1 > x0 && y1 > r.y ? { x: x0, y: r.y, width: x1 - x0, height: y1 - r.y } : null;
}

export function drawGround(ctx: CanvasRenderingContext2D, rect: Rect, view: View, slide: { x: number; y: number } = NO_SLIDE): void {
  ctx.fillStyle = GROUND_FILL; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = GROUND_TOP; ctx.fillRect(rect.x, rect.y, rect.width, Math.min(GROUND_TOP_HEIGHT, rect.height));
  const r = { ...rect, x: rect.x - slide.x, y: rect.y - slide.y }; // 무늬는 처음 자리 기준으로 계산하고 slide만큼 옮겨 그린다
  const v = visiblePart(r, { ...view, x: view.x - slide.x, height: view.height - slide.y });
  if (!v) return;
  const moved = slide.x !== 0 || slide.y !== 0;
  if (moved) { ctx.save(); ctx.translate(slide.x, slide.y); }
  const firstX = Math.floor(v.x / CELL), lastX = Math.floor((v.x + v.width - 1) / CELL);
  ctx.fillStyle = GRASS_SHADE;
  for (let cx = firstX; cx <= lastX; cx++) {
    const k = hash(cx, 0);
    fillClipped(ctx, r, cx * CELL, r.y + GROUND_TOP_HEIGHT - 2, CELL, 2 + (k % 3 === 0 ? 2 : 0)); // 흙 쪽으로 늘어진 풀
  }
  ctx.fillStyle = GRASS_LIGHT;
  for (let cx = firstX; cx <= lastX; cx++) {
    const k = hash(cx, 1);
    if (k % 2 === 0) fillClipped(ctx, r, cx * CELL + (k % 12), r.y + 1, 2, 2);
  }
  ctx.fillStyle = SOIL_SPECK;
  const firstY = Math.floor((r.y + GROUND_TOP_HEIGHT + 4) / CELL), lastY = Math.floor((v.y + v.height - 1) / CELL);
  for (let cy = firstY; cy <= lastY; cy++) {
    for (let cx = firstX; cx <= lastX; cx++) {
      const k = hash(cx, cy);
      if (k % 3 !== 0) continue;
      const y = cy * CELL + ((k >> 4) % 10);
      if (y < r.y + GROUND_TOP_HEIGHT + 4) continue; // 풀 바로 아래는 비워 둔다
      fillClipped(ctx, r, cx * CELL + ((k >> 2) % 12), y, k % 2 === 0 ? 4 : 2, 2);
    }
  }
  if (moved) ctx.restore();
}

// 공중 블록(투명 블록이 나타난 뒤·떨어지는 천장·가짜 벽·내려오는 천장). 블록은 하나씩 떨어져 있고 움직이기도 하므로
// 벽돌 무늬는 블록 자신의 왼쪽 위 기준이다(같은 크기면 진짜 블록과 가짜 벽이 똑같다). edge는 밝은 테두리 쪽 — 내려오는 천장은 아랫면.
export function drawBlock(ctx: CanvasRenderingContext2D, r: Rect, view: View, edge: 'top' | 'bottom' = 'top'): void {
  ctx.fillStyle = BLOCK_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
  const v = visiblePart(r, view);
  if (v) {
    ctx.fillStyle = BLOCK_MORTAR;
    const rows = Math.ceil((v.y + v.height - r.y) / BRICK_H);
    for (let row = 0; row < rows; row++) {
      const y = r.y + row * BRICK_H;
      fillClipped(ctx, r, v.x, y + BRICK_H - 2, v.width, 2); // 가로 줄눈
      const offset = row % 2 === 0 ? 0 : BRICK_W / 2; // 엇갈려 쌓기
      for (let x = r.x + offset + BRICK_W * Math.max(0, Math.floor((v.x - r.x - offset) / BRICK_W)); x < v.x + v.width; x += BRICK_W) fillClipped(ctx, r, x, y, 2, BRICK_H - 2);
    }
  }
  ctx.fillStyle = BLOCK_TOP;
  const h = Math.min(4, r.height);
  ctx.fillRect(r.x, edge === 'top' ? r.y : r.y + r.height - h, r.width, h);
}

// 파이프(지형지물): 숲 분위기에 맞춰 속이 빈 통나무를 세워 둔 모습으로 그린다(2026-11-26 — 이름·충돌은 그대로 "파이프"). 나무껍질 몸통에
// 세로 홈, 윗면은 나이테가 보이는 잘린 단면과 이끼. 무늬는 파이프 자신의 왼쪽 위 기준이라 같은 크기면 어디서든 똑같이 그려진다
// (가라앉는 파이프 #32가 진짜와 같아야 함). 모든 칠은 충돌 사각형 안에만 한다 — 그림이 튀어나와 보이면 설 수 있는 곳이 그림과 달라진다.
export const PIPE_FILL = '#8a5a3b'; // 나무껍질(흙보다 밝고 따뜻하게 — 땅에 묻혀 보이지 않게)
export const PIPE_CAP = '#d9b27c'; // 잘린 단면
const PIPE_GROOVE = '#5e3b26'; // 껍질 홈·단면 아래 줄
const PIPE_RING = '#b08250'; // 나이테
const PIPE_HOLLOW = '#3a2418'; // 가운데 빈 속
const PIPE_MOSS = '#5fae57';
const PIPE_CAP_HEIGHT = 14;
export function drawPipe(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cap = Math.min(PIPE_CAP_HEIGHT, r.height);
  ctx.fillStyle = PIPE_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.fillStyle = PIPE_GROOVE; // 세로 홈(가장자리와 몸통 군데군데)
  for (const dx of [0, 10, 22, 38, 50]) if (dx + 2 <= r.width) fillClipped(ctx, r, r.x + dx, r.y + cap, 2, r.height - cap);
  fillClipped(ctx, r, r.x + r.width - 3, r.y + cap, 3, r.height - cap);
  fillClipped(ctx, r, r.x, r.y + cap, r.width, 2);
  ctx.fillStyle = PIPE_CAP; ctx.fillRect(r.x, r.y, r.width, cap);
  ctx.fillStyle = PIPE_RING; // 단면 가장자리와 나이테 한 겹
  fillClipped(ctx, r, r.x, r.y, r.width, 2); fillClipped(ctx, r, r.x, r.y + cap - 2, r.width, 2);
  fillClipped(ctx, r, r.x, r.y, 2, cap); fillClipped(ctx, r, r.x + r.width - 2, r.y, 2, cap);
  ctx.fillStyle = PIPE_HOLLOW; // 속이 빈 가운데(위아래를 깎아 둥글게)
  fillClipped(ctx, r, r.x + 12, r.y + 4, r.width - 24, Math.max(0, cap - 8));
  ctx.fillStyle = PIPE_RING; fillClipped(ctx, r, r.x + 12, r.y + 4, 2, 1); fillClipped(ctx, r, r.x + r.width - 14, r.y + 4, 2, 1);
  fillClipped(ctx, r, r.x + 12, r.y + cap - 5, 2, 1); fillClipped(ctx, r, r.x + r.width - 14, r.y + cap - 5, 2, 1);
  ctx.fillStyle = PIPE_MOSS; // 이끼: 윗가장자리 왼쪽·오른쪽 조금
  fillClipped(ctx, r, r.x, r.y, 10, 2); fillClipped(ctx, r, r.x + r.width - 14, r.y, 8, 2); fillClipped(ctx, r, r.x, r.y + 2, 4, 2);
}

// 움직임을 바꾸는 지형지물(함정 아님 — 보이는 그대로 동작하므로 바닥과 구분되게 그린다). 모두 판정 사각형 안에만 칠한다.
// 트램펄린: 숲 분위기에 맞춰 탱탱한 버섯으로 그린다(2026-11-26 — 동작은 그대로). 타일이 바닥 윗면에 묻혀 있으므로 땅 위로 내민
// 둥근 보라 갓에 흰 점과 갓 아래 주름만 그린다(대를 그리면 흙 속에 흰 막대로 보였다).
export const TRAMPOLINE_MAT = '#c084fc'; // 버섯 갓
const MUSHROOM_SHADE = '#9255d8'; // 갓 아래쪽 그늘
const MUSHROOM_SPOT = '#f5e9ff';
const MUSHROOM_GILL = '#5b3a86';
export function drawTrampoline(ctx: CanvasRenderingContext2D, t: Rect): void {
  const capH = Math.min(8, t.height);
  ctx.fillStyle = MUSHROOM_GILL; fillClipped(ctx, t, t.x + 4, t.y + capH, t.width - 8, 2);
  ctx.fillStyle = TRAMPOLINE_MAT; // 둥근 갓: 위 두 줄은 안쪽으로 들여 모서리를 깎는다
  fillClipped(ctx, t, t.x + 6, t.y, t.width - 12, 1);
  fillClipped(ctx, t, t.x + 2, t.y + 1, t.width - 4, 2);
  fillClipped(ctx, t, t.x, t.y + 3, t.width, capH - 5);
  ctx.fillStyle = MUSHROOM_SHADE; fillClipped(ctx, t, t.x, t.y + capH - 2, t.width, 2);
  ctx.fillStyle = MUSHROOM_SPOT; // 흰 점(갓 자신의 왼쪽 기준이라 어디서든 같다)
  for (const [dx, dy, w] of [[8, 2, 4], [t.width / 2 + 2, 1, 3], [t.width - 12, 3, 4]] as const) fillClipped(ctx, t, t.x + dx, t.y + dy, w, 2);
}
// 컨베이어 벨트: 바닥 윗면을 덮는 회색 벨트와 흐르는 방향의 화살(">" 또는 "<") 무늬. 무늬는 월드 좌표 기준이고, phase(렌더링 전용 시간)만큼 흐른다.
export const BELT_FILL = '#3f4a5c';
export const BELT_ARROW = '#a3b1c6';
const BELT_HEIGHT = 10;
const BELT_CELL = 16;
const CHEVRON: readonly (readonly [number, number])[] = [[0, 1], [2, 3], [4, 4], [2, 5], [0, 7]];
export function drawConveyor(ctx: CanvasRenderingContext2D, r: Rect, speed: number, phase: number, view: View): void {
  const h = Math.min(BELT_HEIGHT, r.height);
  ctx.fillStyle = BELT_FILL; ctx.fillRect(r.x, r.y, r.width, h);
  const v = visiblePart(r, view);
  if (!v) return;
  const right = speed >= 0;
  const shift = ((phase * speed) % BELT_CELL + BELT_CELL) % BELT_CELL;
  const belt = { ...r, height: h };
  ctx.fillStyle = BELT_ARROW;
  for (let x = Math.floor((v.x - shift) / BELT_CELL) * BELT_CELL + shift; x < v.x + v.width; x += BELT_CELL) {
    for (const [dx, dy] of CHEVRON) fillClipped(ctx, belt, x + (right ? dx : 4 - dx), r.y + dy, 2, 2);
  }
}
// 진흙: 바닥 윗면을 덮는 어둡고 축축한 진흙과 젖은 반사광 줄. 갈색 흙(GROUND_FILL)보다 훨씬 어두워 땅과 구분된다(2026-11-26 —
// 땅을 갈색 흙으로 바꾼 뒤 예전 진흙 색이 흙에 묻혀 보이지 않았다). 무늬는 월드 좌표 칸 해시.
export const MUD_FILL = '#33241c';
const MUD_SPOT = '#7e6a5c'; // 젖은 반사광
export function drawMud(ctx: CanvasRenderingContext2D, r: Rect, view: View): void {
  const h = Math.min(12, r.height);
  ctx.fillStyle = MUD_FILL; ctx.fillRect(r.x, r.y, r.width, h);
  const v = visiblePart(r, view);
  if (!v) return;
  ctx.fillStyle = MUD_SPOT;
  for (let cx = Math.floor(v.x / CELL); cx <= Math.floor((v.x + v.width - 1) / CELL); cx++) {
    const k = hash(cx, 7);
    if (k % 2 === 0) fillClipped(ctx, { ...r, height: h }, cx * CELL + (k % 10), r.y + 3 + ((k >> 3) % 6), 4, 2);
  }
}
// 바람 구간: 영역을 옅게 물들이고, 위로 흘러가는 바람 줄을 그린다(칸마다 고정 해시로 출발 높이를 달리하고 phase(렌더링 전용 시간)만큼 올라감).
export const WIND_TINT = 'rgba(186,230,253,0.14)';
export const WIND_STREAK = 'rgba(224,242,254,0.8)';
const WIND_CELL = 16;
const WIND_RISE = 140; // 바람 줄이 올라가는 속도(그림만, px/s)
export function drawWind(ctx: CanvasRenderingContext2D, zone: Rect, phase: number, view: View): void {
  const v = visiblePart(zone, view);
  if (!v) return;
  ctx.fillStyle = WIND_TINT; ctx.fillRect(v.x, v.y, v.width, v.height);
  ctx.fillStyle = WIND_STREAK;
  const bottom = zone.y + zone.height;
  for (let cx = Math.floor(v.x / WIND_CELL); cx <= Math.floor((v.x + v.width - 1) / WIND_CELL); cx++) {
    const k = hash(cx, 11);
    for (const lane of [0, 0.5]) { // 칸마다 바람 줄 두 개(높이를 반 바퀴 엇갈림)
      const travel = (phase * WIND_RISE + k * 7 + lane * zone.height) % zone.height;
      fillClipped(ctx, zone, cx * WIND_CELL + (k % 12), bottom - travel - 16, 2, 16);
    }
  }
}
// 한쪽 통과 발판: 비계의 나무 판자(위쪽 밝은 면, 아래쪽 그늘, 칸마다 이음매). 판자 칸은 발판 자신의 왼쪽 기준.
// 공중 블록(벽돌)과 다른 색·무늬로, 아래에서 통과할 수 있는 발판임을 구분한다.
export const PLANK_FILL = '#9a6b3c';
export const PLANK_TOP = '#c79a62';
const PLANK_SHADE = '#5e4024';
export function drawPlatform(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = PLANK_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.fillStyle = PLANK_TOP; fillClipped(ctx, r, r.x, r.y, r.width, 3);
  ctx.fillStyle = PLANK_SHADE;
  fillClipped(ctx, r, r.x, r.y + r.height - 2, r.width, 2);
  for (let x = r.x + 30; x < r.x + r.width; x += 30) fillClipped(ctx, r, x, r.y + 3, 2, r.height - 5);
}
