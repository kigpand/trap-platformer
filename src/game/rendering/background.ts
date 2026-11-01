// 배경: 계단식 밤하늘·별·달·도시 실루엣 두 겹. 화면 좌표로 그리며, 도시는 카메라보다 느리게 움직여(시차) 지형보다
// 멀리 있는 것으로 읽힌다 — 배경 건물이 발판처럼 보이지 않게 지형보다 어둡게 둔다. 무늬는 칸 번호의 고정 해시로 정해
// 매 프레임 같고, 화면에 걸치는 칸만 그린다(레벨이 길어져도 그리기 양이 같다). pad는 화면 바깥으로 더 그리는 여백 —
// 화면 흔들림이 배경을 옮겨도 가장자리에 빈 캔버스가 드러나지 않게 흔들림 폭만큼 준다(Codex 리뷰).
const SKY_BANDS = ['#0b1020', '#0d1326', '#10172c', '#121b33', '#151f3a', '#182441'];
const STAR_BRIGHT = '#cbd5e1';
const STAR_DIM = '#64748b';
const MOON_FILL = '#f1f0d8';
const MOON_SHADE = '#d6d3b0';
export const FAR_CITY = '#141e33';
export const NEAR_CITY = '#22324a';
const WINDOW_LIT = '#7c6f3a';

export const FAR_PARALLAX = 0.25;
export const NEAR_PARALLAX = 0.5;
const STAR_CELL = 48;
const FAR_SPACING = 70;
const NEAR_SPACING = 130;

function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

// 한 겹의 건물들: 칸 i의 건물은 화면 x = i * spacing - cam * parallax에 선다.
function drawCity(ctx: CanvasRenderingContext2D, cam: number, view: { width: number; height: number }, pad: number, layer: { parallax: number; spacing: number; width: number; minTop: number; range: number; fill: string; windows: boolean; salt: number }): void {
  const shift = cam * layer.parallax;
  const first = Math.floor((shift - pad - layer.width) / layer.spacing), last = Math.ceil((shift + view.width + pad) / layer.spacing);
  for (let i = first; i <= last; i++) {
    const x = Math.round(i * layer.spacing - shift);
    const top = layer.minTop + (hash(i, layer.salt) % layer.range);
    ctx.fillStyle = layer.fill; ctx.fillRect(x, top, layer.width, view.height + pad - top);
    if (!layer.windows) continue;
    ctx.fillStyle = WINDOW_LIT;
    for (let wy = top + 10; wy + 6 < view.height; wy += 16) {
      for (let wx = 10; wx + 6 <= layer.width - 8; wx += 16) {
        if (hash(i * 31 + wx, wy) % 6 === 0) ctx.fillRect(x + wx, wy, 6, 6); // 몇 개만 불이 켜져 있다
      }
    }
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, cam: number, view: { width: number; height: number }, pad = 0): void {
  const band = Math.ceil(view.height / SKY_BANDS.length);
  const last = SKY_BANDS.length - 1;
  SKY_BANDS.forEach((color, i) => { // 첫 띠는 위로, 마지막 띠는 아래로 pad만큼 늘린다
    ctx.fillStyle = color; ctx.fillRect(-pad, i * band - (i === 0 ? pad : 0), view.width + pad * 2, band + (i === 0 || i === last ? pad : 0));
  });
  // 별: 거의 움직이지 않는다(시차 0.05).
  const starShift = cam * 0.05;
  for (let cx = Math.floor((starShift - pad) / STAR_CELL) - 1; cx <= Math.ceil((starShift + view.width + pad) / STAR_CELL); cx++) {
    for (let cy = 0; cy < 6; cy++) {
      const k = hash(cx, cy + 100);
      if (k % 3 !== 0) continue;
      ctx.fillStyle = k % 2 === 0 ? STAR_BRIGHT : STAR_DIM;
      ctx.fillRect(Math.round(cx * STAR_CELL + (k % 40) - starShift), cy * STAR_CELL + ((k >> 3) % 40), 2, 2);
    }
  }
  // 달: 아주 멀리 있어 화면에 고정. 2px 줄로 쌓은 원과 그늘 두 점.
  const mx = view.width - 150, my = 70, radius = 22;
  ctx.fillStyle = MOON_FILL;
  for (let dy = -radius; dy < radius; dy += 2) {
    const half = Math.round(Math.sqrt(radius * radius - (dy + 1) * (dy + 1)));
    ctx.fillRect(mx - half, my + dy, half * 2, 2);
  }
  ctx.fillStyle = MOON_SHADE; ctx.fillRect(mx - 8, my - 6, 6, 6); ctx.fillRect(mx + 4, my + 6, 4, 4);
  drawCity(ctx, cam, view, pad, { parallax: FAR_PARALLAX, spacing: FAR_SPACING, width: 56, minTop: 300, range: 120, fill: FAR_CITY, windows: false, salt: 7 });
  drawCity(ctx, cam, view, pad, { parallax: NEAR_PARALLAX, spacing: NEAR_SPACING, width: 90, minTop: 330, range: 140, fill: NEAR_CITY, windows: true, salt: 13 });
}
