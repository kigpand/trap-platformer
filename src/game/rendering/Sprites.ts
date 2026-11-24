// 코드로 직접 정의하는 오리지널 픽셀 스프라이트. 외부 이미지 에셋을 쓰지 않는다 —
// 각 문자열이 한 행이고, 문자 하나가 픽셀 하나다. PALETTE에 없는 문자는 투명으로 취급한다.
export type PixelGrid = readonly string[];

// 2026-11-24 프로젝트 오너가 고른 "후드 러너" 방향(UI 개편 3단계): 플레이어는 목도리를 두른 후드 차림의 모험가, 적은 짜증 난
// 슬라임. 이 게임용으로 새로 그렸다. 한 픽셀이 화면 2px — 플레이어 13×16(히트박스 26×32), 적 14×14(28×28)에 꼭 맞는다.
const PALETTE: Readonly<Record<string, string>> = {
  O: '#14212b', // 외곽선
  A: '#2ec4b6', // 후드·옷
  a: '#1f8f86', // 후드·옷(음영)
  S: '#f1c7a3', // 얼굴·손
  E: '#16151c', // 눈동자
  C: '#ef476f', // 목도리
  N: '#2b3a67', // 바지
  W: '#f4f1de', // 신발
  G: '#e05780', // 슬라임 몸통
  H: '#ff9cbc', // 슬라임 반사광
  M: '#a83a5e', // 슬라임 아랫부분(음영)
  w: '#fffaf0', // 흰자
};

// 플레이어 머리·몸통(13열). 다리 세 줄은 프레임마다 다르다. 오른쪽을 본다(왼쪽으로 가면 좌우를 뒤집어 그림).
const HEAD = [
  '....OOOOO....',
  '...OAAAAAO...',
  '..OAAAAAAAO..',
  '..OAAASSSSO..',
  '..OAASSSESO..',
  '..OAASSSSSO..',
  '...OAASSSO...',
];
const BODY = (scarfTail: string, hand: string): PixelGrid => [
  '..OCCCCCCO...',
  `${scarfTail}OAAAAAAAAO..`,
  `.OAAAAAAAAO${hand}.`,
  '.OaAAAAAAaO..',
  '..OaaaaaaO...',
  '..ONNNNNNO...',
];

export const PLAYER_IDLE: PixelGrid = [...HEAD, ...BODY('C', 'S'), '..ONN..NNO...', '..ONN..NNO...', '..WWW..WWW...'];
export const PLAYER_WALK_1: PixelGrid = [...HEAD, ...BODY('C', 'S'), '..ONO..ONO...', '.ONO....ONO..', '.WW......WW..'];
export const PLAYER_WALK_2: PixelGrid = [...HEAD, ...BODY('.', 'S'), '...ONNNNO....', '...ONOONO....', '...WWWWWW....'];
export const PLAYER_JUMP: PixelGrid = [
  ...HEAD.slice(0, 6), '...OAASSSOS..',
  '..OCCCCCCO...', 'CCOAAAAAAAO..', '.OAAAAAAAAO..', '.OaAAAAAAaO..', '..OaaaaaaO...', '..ONNNNNNO...',
  '.ONNO..ONNO..', '.WWO....OWW..', '.............',
];

// 슬라임: 걸을 때 몸을 눌렀다 폈다 한다(아래 두 줄은 바닥에 붙은 채).
const SLIME_FACE = [
  '.OGGOOGGGOOGO.',
  '.OGGwEGGGwEGO.',
  '.OGGGGGGGGGGO.',
  '.OGGGOOOOGGGO.',
  '.OGGGGGGGGGGO.',
  '.OMMMMMMMMMMO.',
  '..OOOOOOOOOO..',
  '..............',
];
export const ENEMY_WALK_1: PixelGrid = [
  '..............',
  '..............',
  '.....OOOO.....',
  '...OOGGGGOO...',
  '..OGHHGGGGGO..',
  '.OGHGGGGGGGGO.',
  ...SLIME_FACE,
];
export const ENEMY_WALK_2: PixelGrid = [
  '..............',
  '..............',
  '..............',
  '....OOOOOO....',
  '..OOHHGGGGOO..',
  '.OGHGGGGGGGGO.',
  ...SLIME_FACE,
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
  // 한 줄에서 같은 색이 이어지는 칸은 사각형 하나로 칠한다(그림은 같고 그리기 호출만 준다 — 프레임 예산, budget.test.ts).
  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < cols) {
      const color = PALETTE[grid[row][flipX ? cols - 1 - col : col]];
      let end = col + 1;
      while (end < cols && PALETTE[grid[row][flipX ? cols - 1 - end : end]] === color) end++;
      if (color) {
        ctx.fillStyle = color;
        const left = Math.round(x + col * pixelSize);
        ctx.fillRect(left, Math.round(top + row * pixelSize), Math.round(x + end * pixelSize) - left, Math.ceil(pixelSize));
      }
      col = end;
    }
  }
}
