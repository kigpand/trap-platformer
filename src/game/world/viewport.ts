// 화면에 보이는 월드 영역. 렌더러가 카메라 위치를 정할 때와, World가 "플레이어가 지금 볼 수 있는가"를
// 판단할 때(예: 가짜 안전지대 사망 후 표시는 화면에 보이는 동안만 시간이 흐른다) 같은 계산을 써야 하므로
// 렌더링 모듈이 아니라 월드 쪽에 둔다(월드는 렌더링에 의존하지 않는다).
export const VIEW_WIDTH = 960;
export function cameraX(playerX: number, viewportWidth: number, levelWidth: number): number { return Math.max(0, Math.min(levelWidth - viewportWidth, playerX - viewportWidth * 0.4)); }
