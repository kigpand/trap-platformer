# Trap Runner — 독자적인 함정 플랫포머

React + TypeScript + Canvas 2D로 만든 **독자적인 2D 함정 플랫포머**입니다. 설치 없이 브라우저에서 바로 플레이합니다. 클래식 플랫폼 게임의 장르적 구조만 참고하며 기존 게임의 캐릭터·레벨·음악·그래픽은 복제하지 않습니다.

**데모:** https://kigpand.github.io/trap-platformer/ (GitHub Pages — 리포지토리 Settings → Pages → Source를 "GitHub Actions"로 설정해야 `master` 푸시마다 자동 배포됩니다. `.github/workflows/deploy.yml` 참고.)

![플레이 화면](docs/assets/screenshot.jpg)

## 실행

- Node.js 22 이상, pnpm 10 이상 권장
- `corepack enable` (필요 시)
- `pnpm install`
- `pnpm dev`
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `pnpm exec playwright install chromium` (최초 1회)
- `pnpm test:e2e`
- `pnpm verify` (`pnpm check`와 `pnpm test:e2e`를 한 번에)
- `pnpm slack` (선택 — 레벨별 해법 점프의 일찍·늦게 여유 프레임 표, `pnpm slack 2 3`처럼 레벨을 고를 수 있음)
- `pnpm perf` (선택 — 렌더링 그리기 시간·프레임 손실 측정, `docs/roadmap.md` "렌더링 성능 측정" 참고)

게임 화면 클릭 후 ←/→ 또는 A/D 이동, Space/↑/W 점프, R 재시작, B 충돌 박스 전환, P 일시 정지/재개, M 소리 켜기/끄기, N 클리어 후 다음 레벨, 음량은 슬라이더로 조절(배경 음악은 게임 진행 중에만 재생). 캔버스 아래의 "일시정지/재개"·"재시작"·"음소거" 버튼은 키보드 단축키와 동일하게 동작하며 터치·마우스·스크린 리더로도 쓸 수 있습니다. 터치 기기에서는 캔버스 아래에 ◀/▶ 이동·▲ 점프 버튼이 나타납니다. 게임패드(표준 배치)도 지원합니다: 방향 패드·왼쪽 스틱 이동, A·↑ 점프, Start 일시 정지, Select 재시작, Y 다음 레벨. 우측 HUD로 진행 상태와 이번 런의 시간(TIME)·최고 기록(BEST, 브라우저에 저장)을 확인하고, 사망·클리어는 화면에 보이지 않는 `aria-live` 영역으로도 알립니다. 탭이 백그라운드로 가면 자동으로 일시 정지되며, 돌아와도 자동으로 재개되지 않습니다(P 또는 버튼으로 직접 재개).

## AI 협업

1. `AGENTS.md` — 양쪽 에이전트 공통 규칙. Claude에서는 `CLAUDE.md`가 `@AGENTS.md`로 가져옵니다.
2. `CLAUDE.md`, `.claude/rules/`, `.claude/skills/` — 구현 에이전트 규칙. `.claude/settings.json`은 공유 권한 설정(PR 병합은 매번 확인, 강제 푸시 금지).
3. `.codex/review.md` — Codex가 **명시적으로 읽어야 하는** 리뷰 지침. 자동 로딩 파일이 아닙니다. 변경마다의 리뷰 요청은 Claude의 `/codex-review-request` 스킬이 `.codex/requests/`(커밋하지 않음)에 만듭니다. Codex가 같은 작업 트리를 읽을 때만 전달되므로, 다른 worktree·clone·클라우드에서 리뷰하면 내용을 PR 댓글로 옮깁니다.
4. `docs/` — 단일 명세 원천. 개발과 리뷰에서 같은 기준을 참조합니다.

예: Claude에게 `docs/physics-spec.md` 기준 구현을 요청하고, Codex에게 `AGENTS.md`, `.codex/review.md`를 읽고 `git diff master...HEAD`를 리뷰하도록 요청합니다.

## 구성

- `src/game/` — React 의존 없는 고정 시간 간격 게임 시뮬레이션 및 Canvas 2D
- `src/components/` — React HUD / 화면 마운트
- `tests/unit/` — 충돌·물리 규칙, 함정·레벨 해법(입력 시간 여유 포함), 렌더링(위장 함정이 일반 지형과 같게 그려지는지) 테스트
- `tests/e2e/` — 실제 브라우저 연동 테스트

현재 플레이 가능한 내용:

- **레벨 4개**를 이어서 진행합니다: 쉬움 12,000px · 보통 15,300px · 어려움 16,800px · 지옥 18,600px(함정 30종을 셋씩 겹친 마지막 레벨). 클리어 후 "다음 레벨"로 넘어가고, 마지막에는 레벨별 최고 기록을 보여 주는 완료 화면이 나옵니다.
- **함정 30종**: 처음엔 당할 수밖에 없지만 원인을 알면 피할 수 있습니다. 죽으면 원인 영역을 경고색으로 표시하고 놀리는 문구를 띄웁니다. 함정 목록과 동작 규칙은 `docs/traps-spec.md`에 있습니다.
- 왕복 이동하는 적, 중간 체크포인트(죽으면 체크포인트에서 이어 감), 디버그 오버레이(충돌 박스·FPS·속도)
- 코드로 그린 픽셀 그래픽(외부 이미지 에셋 없음): 플레이어·적 스프라이트와 걷기 애니메이션, 땅·블록 질감, 깃발·가시·표지판, 시차로 움직이는 밤 도시 배경. 바닥으로 위장한 함정은 일반 바닥과 픽셀 하나까지 똑같이 그립니다.
- Web Audio로 합성한 효과음·함정 효과음·배경 음악, 음소거·음량 조절, 화면 흔들림·파편 연출(운영체제의 "동작 줄이기" 설정을 따름)
- 레벨별 최고 기록 저장(다른 탭에서 갱신해도 바로 반영), 키보드·터치·게임패드 입력
- 검색 노출용 메타 태그·사이트맵·미리보기 이미지

진행 상황은 `docs/roadmap.md`와 `docs/traps-spec.md`의 "구현 현황"을 참조하세요.

## 설계상 주의

- 최대 이동량을 타일 크기보다 작게 쪼개서 관통 위험을 줄이는 임시 구현입니다. 고속 충돌 완전 보장은 아닙니다. 기능 확장 전 `physics-spec.md`의 고속 이동 요건을 검증하세요.
- **레벨에 솔리드·함정·적을 새로 배치할 때는 반드시 `docs/physics-spec.md`의 "레벨 배치 제약"을 먼저 확인하세요** (최대 점프 높이, 간격 통과 가능 여부를 추론이 아닌 테스트로 검증해야 하는 이유, 단차 보조 없음 등). 이 제약을 무시해 도달 불가능한 함정이 배치된 적이 있습니다(Codex 리뷰로 발견, 커밋 `5dd77ac`에서 수정).
- 자세한 과제 및 우선순위는 `docs/roadmap.md`를 참조하세요.
