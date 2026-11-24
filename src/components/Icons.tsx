// HUD·메뉴용 작은 선 아이콘(24×24, 이 게임용으로 새로 그림). 장식이라 스크린 리더에서는 숨기고, 뜻은 옆의 글자·aria-label이 전한다.
import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const SkullIcon = () => <Icon><path d="M12 3a7 7 0 0 0-7 7v3l2 2v3h10v-3l2-2v-3a7 7 0 0 0-7-7Z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /><path d="M10 18v-2M14 18v-2" /></Icon>;
export const FlagIcon = () => <Icon><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></Icon>;
export const ClockIcon = () => <Icon><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M10 2h4" /></Icon>;
export const TrophyIcon = () => <Icon><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" /></Icon>;
export const PauseIcon = () => <Icon><path d="M9 5v14M15 5v14" /></Icon>;
export const PlayIcon = () => <Icon><path d="M7 5l12 7-12 7Z" /></Icon>;
export const RestartIcon = () => <Icon><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></Icon>;
export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <Icon>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
    {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />}
  </Icon>
);
