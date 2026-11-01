import type { Rect } from '../physics/AABB';

// 깃발·목표·가시·표지판의 픽셀 그림. 가짜(가짜 체크포인트 #11·가짜 클리어 깃발 #14)도 진짜와 같은 함수로 그려
// 처음엔 구분되지 않게 한다(docs/traps-spec.md의 텔레그래프). 가시는 판정 사각형 안에만 그린다(보이는 만큼 아프다).
export const SPIKE_FILL = '#e2e8f0';
const SPIKE_SHADE = '#94a3b8';
const SPIKE_TIP = '#ffffff';
export const GOAL_FILL = '#eab308';
const GOAL_SHADE = '#ca8a04';
const GOAL_STAR = '#fef9c3';
const POLE_FILL = '#cbd5e1';
const POLE_SHADE = '#64748b';
const STONE_FILL = '#334155';
const SIGN_WIDTH = 150; // #18 표지판 판자(12자 문구가 들어가는 너비)
const SIGN_POST = '#8a6d4b';
const SIGN_POST_SHADE = '#6f5639';
const SIGN_FRAME = '#8a6d4b';
const SIGN_BOARD = '#e7d7b5';
const SIGN_NAIL = '#3b2f22';

// 솟은 가시(#10·#23): 받침과 8px 간격의 계단식 삼각형(왼쪽은 밝게, 오른쪽은 그늘).
export function drawSpikes(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = SPIKE_FILL;
  ctx.fillRect(r.x, r.y + r.height - 4, r.width, 4); // 받침
  const rows = Math.floor((r.height - 4) / 2);
  for (let x = r.x; x + 8 <= r.x + r.width + 0.5; x += 8) {
    for (let i = 0; i < rows; i++) {
      const half = Math.max(1, Math.round(((i + 1) / rows) * 4)); // 위로 갈수록 좁아진다
      const y = r.y + i * 2;
      ctx.fillStyle = SPIKE_FILL; ctx.fillRect(x + 4 - half, y, half, 2);
      ctx.fillStyle = SPIKE_SHADE; ctx.fillRect(x + 4, y, half, 2);
    }
    ctx.fillStyle = SPIKE_TIP; ctx.fillRect(x + 3, r.y, 1, 2);
  }
}

// 체크포인트 깃발. 깃대는 판정 영역 높이와 상관없이 영역 바닥에서 FLAG_HEIGHT만큼 그린다 — 진짜는 건너뛸 수 없게
// 영역이 높고 가짜는 넘을 수 있게 낮아서, 영역 높이로 그리면 한눈에 구분됐다(Codex 리뷰).
const FLAG_HEIGHT = 80;
export function drawFlag(ctx: CanvasRenderingContext2D, zone: Rect, color: string): void {
  const bottom = zone.y + zone.height;
  const top = bottom - FLAG_HEIGHT;
  const cx = zone.x + zone.width / 2;
  ctx.fillStyle = color; ctx.fillRect(cx - 2, top, 4, FLAG_HEIGHT); // 깃대(색이 상태를 알려 준다)
  ctx.fillStyle = POLE_SHADE; ctx.fillRect(cx + 1, top, 1, FLAG_HEIGHT);
  ctx.fillStyle = STONE_FILL; ctx.fillRect(cx - 8, bottom - 4, 16, 4); // 받침돌
  ctx.fillStyle = color;
  for (let i = 0; i < 10; i++) ctx.fillRect(cx + 2, top + i * 2, Math.max(2, 18 - Math.abs(i - 4.5) * 4), 2); // 계단식 삼각 깃발
}

// 목표 깃발(#12 도망가는 목표·#14 가짜 클리어 깃발 공용). r은 판정 영역(40×60) — 그 안에 깃대·금빛 구슬·나부끼는 천·받침을
// 그린다. wave(0·1)는 천이 나부끼는 두 프레임으로, 같은 그림에서는 진짜와 가짜가 같은 프레임을 쓴다.
export function drawGoal(ctx: CanvasRenderingContext2D, r: Rect, wave: number): void {
  const poleX = r.x + 6;
  ctx.fillStyle = POLE_FILL; ctx.fillRect(poleX, r.y + 4, 4, r.height - 4);
  ctx.fillStyle = POLE_SHADE; ctx.fillRect(poleX + 3, r.y + 4, 1, r.height - 4);
  ctx.fillStyle = GOAL_FILL; ctx.fillRect(poleX - 1, r.y, 6, 4); // 구슬
  const clothW = Math.min(28, r.x + r.width - (poleX + 4));
  for (let i = 0; i < 11; i++) { // 2px 줄 11개, 줄마다 끝이 물결 모양으로 들쭉날쭉
    const w = clothW - ((i + wave) % 2) * 2 - (i > 8 ? (i - 8) * 4 : 0);
    ctx.fillStyle = i % 4 === 3 ? GOAL_SHADE : GOAL_FILL;
    ctx.fillRect(poleX + 4, r.y + 4 + i * 2, w, 2);
  }
  ctx.fillStyle = GOAL_STAR; ctx.fillRect(poleX + 14, r.y + 10, 4, 4); ctx.fillRect(poleX + 12, r.y + 12, 8, 1); // 반짝이는 별
  ctx.fillStyle = STONE_FILL; ctx.fillRect(r.x, r.y + r.height - 4, 16, 4); // 받침돌
}

// #18 가짜 안내 표지판: 기둥과 테두리 있는 판자. 문구는 렌더러가 판자 가운데에 쓴다.
export function drawSign(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  ctx.fillStyle = SIGN_POST; ctx.fillRect(x - 3, groundY - 56, 6, 56);
  ctx.fillStyle = SIGN_POST_SHADE; ctx.fillRect(x + 1, groundY - 56, 2, 56);
  const left = x - SIGN_WIDTH / 2, top = groundY - 88;
  ctx.fillStyle = SIGN_FRAME; ctx.fillRect(left, top, SIGN_WIDTH, 32);
  ctx.fillStyle = SIGN_BOARD; ctx.fillRect(left + 3, top + 3, SIGN_WIDTH - 6, 26);
  ctx.fillStyle = SIGN_NAIL;
  for (const nx of [left + 6, left + SIGN_WIDTH - 8]) for (const ny of [top + 6, top + 24]) ctx.fillRect(nx, ny, 2, 2);
}
