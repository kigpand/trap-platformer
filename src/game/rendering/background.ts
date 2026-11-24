// 배경: 계단식 해 질 녘 하늘·별·달·먼 언덕과 가까운 숲 실루엣 두 겹(2026-11-24 "후드 러너" 방향 — 예전에는 도시 두 겹). 화면 좌표로
// 그리며, 언덕·숲은 카메라보다 느리게 움직여(시차) 지형보다 멀리 있는 것으로 읽힌다 — 발판처럼 보이지 않게 지형보다 어둡게 둔다.
// 모양은 칸 번호의 고정 해시로 정해 매 프레임 같고, 화면에 걸치는 칸만 그린다(레벨이 길어져도 그리기 양이 같다). pad는 화면
// 바깥으로 더 그리는 여백 — 화면 흔들림이 배경을 옮겨도 가장자리에 빈 캔버스가 드러나지 않게 흔들림 폭만큼 준다(Codex 리뷰).
// 위(밤)에서 지평선(노을빛 보라)까지 16단 — 띠가 눈에 띄지 않을 만큼 잘게 나눠 매끈하게 보이게 한다(띠 하나가 사각형 하나).
const SKY_TOP = [14, 18, 48], SKY_HORIZON = [80, 44, 98];
export const SKY_BANDS: readonly string[] = Array.from({ length: 16 }, (_, i) => {
  const t = (i / 15) ** 1.6; // 지평선 가까이에서 더 빨리 밝아진다
  return `rgb(${SKY_TOP.map((c, k) => Math.round(c + (SKY_HORIZON[k] - c) * t)).join(',')})`;
});
const STAR_BRIGHT = '#e2dcf5';
const STAR_DIM = '#6f6a99';
const MOON_FILL = '#f6eed2';
const MOON_SHADE = '#ddd0a8';
export const FAR_HILLS = '#272a58';
export const NEAR_TREES = '#141a33';

export const FAR_PARALLAX = 0.25;
export const NEAR_PARALLAX = 0.5;
const STAR_CELL = 48;
const HILL_SPACING = 150;
const TREE_SPACING = 64;

function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

// 한 겹: 칸 i의 모양은 화면 x = i * spacing - cam * parallax에 선다. shape는 (왼쪽 x, 꼭대기 y, 칸 번호)로 사각형 몇 개를 칠한다.
function drawLayer(ctx: CanvasRenderingContext2D, cam: number, view: { width: number; height: number }, pad: number, layer: { parallax: number; spacing: number; reach: number; fill: string; shape: (x: number, top: number, bottom: number, i: number) => void; minTop: number; range: number; salt: number }): void {
  const shift = cam * layer.parallax;
  const first = Math.floor((shift - pad - layer.reach) / layer.spacing), last = Math.ceil((shift + view.width + pad) / layer.spacing);
  ctx.fillStyle = layer.fill;
  for (let i = first; i <= last; i++) {
    layer.shape(Math.round(i * layer.spacing - shift), layer.minTop + (hash(i, layer.salt) % layer.range), view.height + pad, i);
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
  // 먼 언덕: 둥글게 보이도록 세 단으로 쌓는다(넓은 밑단, 좁아지는 윗단).
  drawLayer(ctx, cam, view, pad, { parallax: FAR_PARALLAX, spacing: HILL_SPACING, reach: 260, fill: FAR_HILLS, minTop: 270, range: 90, salt: 7,
    shape: (x, top, bottom, i) => {
      const w = 220 + (hash(i, 9) % 40), step = 12;
      ctx.fillRect(x, top + step * 2, w, bottom - top - step * 2);
      ctx.fillRect(x + Math.round(w * 0.14), top + step, Math.round(w * 0.72), step);
      ctx.fillRect(x + Math.round(w * 0.3), top, Math.round(w * 0.4), step);
    } });
  // 가까운 숲: 네 단으로 좁아지는 전나무 실루엣. 칸마다 높이를 달리해 들쭉날쭉하게.
  drawLayer(ctx, cam, view, pad, { parallax: NEAR_PARALLAX, spacing: TREE_SPACING, reach: 80, fill: NEAR_TREES, minTop: 330, range: 110, salt: 13,
    shape: (x, top, bottom, i) => {
      const w = 56 + (hash(i, 21) % 20), tier = 20, cx = x + w / 2;
      ctx.fillRect(x, top + tier * 3, w, bottom - top - tier * 3);
      for (let j = 1; j <= 3; j++) {
        const tw = Math.round(w * (1 - j * 0.24));
        ctx.fillRect(Math.round(cx - tw / 2), top + tier * (3 - j), tw, tier);
      }
    } });
}
