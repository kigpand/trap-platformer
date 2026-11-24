import { describe, expect, it } from 'vitest';
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../../../src/game/entities/Player';
import { ENEMY_HEIGHT, ENEMY_WIDTH } from '../../../src/game/entities/Enemy';
import * as Sprites from '../../../src/game/rendering/Sprites';
import { drawPixelSprite, type PixelGrid } from '../../../src/game/rendering/Sprites';
import { pixels, recorder } from './recorder';

// 캐릭터 그림(UI 개편 3단계 "후드 러너"): 한 픽셀이 화면 2px로 히트박스를 꼭 채운다. 그리기는 한 줄의 같은 색 칸을 사각형 하나로
// 합친다(프레임 예산) — 칸마다 칠하던 예전 방식과 같은 그림이어야 한다.
const player: Record<string, PixelGrid> = { PLAYER_IDLE: Sprites.PLAYER_IDLE, PLAYER_WALK_1: Sprites.PLAYER_WALK_1, PLAYER_WALK_2: Sprites.PLAYER_WALK_2, PLAYER_JUMP: Sprites.PLAYER_JUMP };
const enemy: Record<string, PixelGrid> = { ENEMY_WALK_1: Sprites.ENEMY_WALK_1, ENEMY_WALK_2: Sprites.ENEMY_WALK_2 };

// 비교용: 칸 하나에 사각형 하나(합치기 전 방식). 색은 실제 그리기에서 그 칸에 칠해진 색을 쓴다.
function cellByCell(grid: PixelGrid, x: number, y: number, boxW: number, boxH: number, flip: boolean, colorAt: (gx: number, gy: number) => string | undefined): Map<string, string> {
  const px = boxW / grid[0].length, top = y + boxH - grid.length * px;
  const out = new Map<string, string>();
  grid.forEach((row, r) => [...row].forEach((_, c) => {
    const color = colorAt(flip ? grid[0].length - 1 - c : c, r);
    if (!color) return;
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) out.set(`${x + c * px + dx},${top + r * px + dy}`, color);
  }));
  return out;
}

describe('character sprites', () => {
  it('fill the hitbox exactly at 2 screen pixels per art pixel', () => {
    for (const [name, g] of Object.entries(player)) {
      expect([g[0].length * 2, g.length * 2], name).toEqual([PLAYER_WIDTH, PLAYER_HEIGHT]);
      expect(g.every((row) => row.length === g[0].length), name).toBe(true);
    }
    for (const [name, g] of Object.entries(enemy)) {
      expect([g[0].length * 2, g.length * 2], name).toEqual([ENEMY_WIDTH, ENEMY_HEIGHT]);
      expect(g.every((row) => row.length === g[0].length), name).toBe(true);
    }
  });

  it('merge same-colour runs into one rectangle without changing the picture, flipped too', () => {
    for (const [name, g] of Object.entries({ ...player, ...enemy })) {
      const [w, h] = name.startsWith('PLAYER') ? [PLAYER_WIDTH, PLAYER_HEIGHT] : [ENEMY_WIDTH, ENEMY_HEIGHT];
      // 칸별 색: 한 칸만 남긴 격자를 그려 그 칸의 색을 얻는다(팔레트를 테스트에 다시 적지 않는다).
      const colorAt = (gx: number, gy: number): string | undefined => {
        const one = g.map((row, r) => [...row].map((ch, c) => (r === gy && c === gx ? ch : '.')).join(''));
        const { ctx, fills } = recorder();
        drawPixelSprite(ctx, one, 0, 0, w, h, false);
        return fills[0]?.style;
      };
      for (const flip of [false, true]) {
        const { ctx, fills } = recorder();
        drawPixelSprite(ctx, g, 100, 200, w, h, flip);
        const area = { x: 100, y: 200, width: w, height: h };
        expect(pixels(fills, area), `${name} flip ${flip}`).toEqual(cellByCell(g, 100, 200, w, h, flip, colorAt));
        const cells = g.join('').replace(/\./g, '').length;
        expect(fills.length, name).toBeLessThan(cells / 2); // 합쳐서 그리기 호출이 칸 수의 절반 미만
      }
    }
  });
});
