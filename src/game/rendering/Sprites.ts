// 코드로 직접 정의하는 오리지널 픽셀 스프라이트. 외부 이미지 에셋을 쓰지 않는다 —
// 각 문자열이 한 행이고, 문자 하나가 픽셀 하나다. PALETTE에 없는 문자는 투명으로 취급한다.
export type PixelGrid = readonly string[];

const PALETTE: Readonly<Record<string, string>> = {
  B: '#fa8966', // 플레이어 몸통
  D: '#c96a4f', // 플레이어 몸통(음영)
  E: '#16151c', // 눈
  R: '#dc2626', // 적 몸통
  S: '#b91c1c', // 적 몸통(음영)
};

export const PLAYER_IDLE: PixelGrid = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BBBBBBBB',
  'BBBBEBBB',
  'BBBBBBBB',
  'BBBBBBBB',
  '.DD..DD.',
  '.DD..DD.',
];

export const PLAYER_WALK_1: PixelGrid = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BBBBBBBB',
  'BBBBEBBB',
  'BBBBBBBB',
  'BBBBBBBB',
  '.D....D.',
  'D......D',
];

export const PLAYER_WALK_2: PixelGrid = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BBBBBBBB',
  'BBBBEBBB',
  'BBBBBBBB',
  'BBBBBBBB',
  '..D..D..',
  '.D....D.',
];

export const PLAYER_JUMP: PixelGrid = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BBBBBBBB',
  'BBBBEBBB',
  'BBBBBBBB',
  'BBBBBBBB',
  '.BBBBBB.',
  '.DD..DD.',
];

export const ENEMY_WALK_1: PixelGrid = [
  '.RRRRRR.',
  'RRRRRRRR',
  'RREBBERR',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRRRRRRR',
  '.S....S.',
  'S......S',
];

export const ENEMY_WALK_2: PixelGrid = [
  '.RRRRRR.',
  'RRRRRRRR',
  'RREBBERR',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRRRRRRR',
  '..S..S..',
  '.S....S.',
];

// grid를 boxWidth x boxHeight 히트박스 안에 맞춰 그린다(발이 히트박스 바닥에 맞도록 하단 정렬).
// 플레이어 충돌 박스는 시각적 스프라이트와 독립적이므로(docs/physics-spec.md) 정확히 겹칠 필요는 없다.
export function drawPixelSprite(
  ctx: CanvasRenderingContext2D, grid: PixelGrid, x: number, y: number, boxWidth: number, boxHeight: number,
  flipX: boolean,
): void {
  const cols = grid[0].length;
  const rows = grid.length;
  const pixelSize = boxWidth / cols;
  const top = y + boxHeight - rows * pixelSize;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = grid[row][flipX ? cols - 1 - col : col];
      const color = PALETTE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x + col * pixelSize), Math.round(top + row * pixelSize), Math.ceil(pixelSize), Math.ceil(pixelSize));
    }
  }
}
