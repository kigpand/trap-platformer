import type { Rect } from '../physics/AABB';
// 화면에 보이는 월드 영역. 렌더러가 카메라 위치를 정할 때와, World가 "플레이어가 지금 볼 수 있는가"를
// 판단할 때(예: 가짜 안전지대 사망 후 표시는 화면에 보이는 동안만 시간이 흐른다) 같은 계산을 써야 하므로
// 렌더링 모듈이 아니라 월드 쪽에 둔다(월드는 렌더링에 의존하지 않는다).
export const VIEW_WIDTH = 960;
export function cameraX(playerX: number, viewportWidth: number, levelWidth: number): number { return Math.max(0, Math.min(levelWidth - viewportWidth, playerX - viewportWidth * 0.4)); }
// 지금 화면(카메라 가로 범위)과 겹치는가. 화면 밖에서 일어난 착지로 화면을 흔들지 않게 할 때 쓴다.
export function isInView(rect: Rect, playerX: number, levelWidth: number): boolean {
  const left = cameraX(playerX, VIEW_WIDTH, levelWidth);
  return rect.x < left + VIEW_WIDTH && rect.x + rect.width > left;
}
// 화면 밖 소리 규칙(docs/game-design.md "소리"): 함정 이벤트의 영역이 화면 안이거나 화면 가장자리에서 한 화면 폭 안이면 들린다.
// 화면 밖에서 들어오는 화살·돌덩이는 들리고, 지나온 함정이 멀리서 뒤늦게 일으킨 일은 들리지 않는다.
export function isWithinHearing(rect: Rect, playerX: number, levelWidth: number): boolean {
  const left = cameraX(playerX, VIEW_WIDTH, levelWidth);
  return rect.x < left + 2 * VIEW_WIDTH && rect.x + rect.width > left - VIEW_WIDTH;
}
