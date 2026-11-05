---
name: codex-review-request
description: 브랜치나 PR의 변경을 Codex가 독립적으로 리뷰하도록, 범위·읽을 문서·실행한 검사·위험·확인 요청을 정리한 요청 파일을 `.codex/requests/`에 만듭니다.
argument-hint: "[PR 번호 | 브랜치] [확인받고 싶은 점…]"
disable-model-invocation: true
---
# Codex 리뷰 요청 만들기
Codex 리뷰(AGENTS.md "작업 흐름" 3번)에 넘길 인계 파일을 만듭니다. 파일만 쓰고 커밋·푸시·PR 댓글은 하지 않습니다(`.codex/requests/`는 `.gitignore`에 있음).
파일을 만드는 부작용이 있어 모델이 스스로 불러오지 않고, 프로젝트 오너가 `/codex-review-request`로 직접 실행합니다. 오너가 대화에서 Codex 리뷰 요청 파일을 만들어 달라고 명확히 요청했을 때도 같은 절차를 따릅니다.
요청 파일은 Codex가 **같은 작업 트리**를 읽을 때만 전달됩니다. 별도 worktree·새 clone·클라우드 작업에서 리뷰한다면 같은 내용을 PR 댓글로 옮기도록 오너에게 알립니다.

1. 범위 확정: 기준 브랜치와 대상 커밋을 정합니다. 현재 체크아웃(`HEAD`)은 대상과 다를 수 있으므로 쓰지 않습니다.
   - PR 번호: `gh pr view <번호> --json number,url,headRefName,headRefOid,baseRefName,statusCheckRollup`. 기준 브랜치 = `baseRefName`, 대상 = `headRefOid`. 대상 커밋이 로컬에 없으면 먼저 `git fetch origin <headRefName> <baseRefName>`
   - 브랜치 이름: 기준 브랜치 = `master`, 대상 = `git rev-parse <브랜치>`
   - 인자 없음: 현재 브랜치를 브랜치 이름으로 받은 것처럼 처리
   - 기준 커밋 = `git merge-base origin/<기준 브랜치> <대상>`(원격이 없으면 로컬 브랜치). 이 둘로 짧은 해시, `git diff --stat <기준>...<대상>`, `git log --oneline <기준>..<대상>`을 모읍니다. PR이면 기록한 대상이 `headRefOid`와 같은지 확인합니다.
   - 커밋하지 않은 변경은 범위에 들어가지 않는다고 적습니다.
2. 읽을 문서 고르기: 항상 `AGENTS.md`, `.codex/review.md`. 그 밖에는 다음을 더합니다.
   - 규칙: 바뀐 파일이 `.claude/rules/*.md` 머리의 `paths` 패턴에 걸리는 규칙 파일. 표를 따로 외우지 말고 그때그때 `paths`를 읽어 맞춥니다. 패턴은 glob이며 대소문자를 구분합니다. `*`는 경로 구분자(`/`)를 넘지 않고 `**`는 여러 단계 디렉터리를 뜻합니다(예: `tests/unit/world/*Solution.ts`는 `level2Solution.ts`에 걸리고 `solution.ts`에는 걸리지 않으며, `solution.ts`는 따로 적힌 패턴으로 걸림).
   - 명세: 고른 규칙 파일 본문이 가리키는 `docs/...` 문서를 모두 넣습니다(예: `levels.md` → `physics-spec.md`·`traps-spec.md`·`game-design.md`). 그 밖에 모듈 경계를 바꾸면 `docs/architecture.md`, 결정을 바꾸면 해당 `docs/decisions/*.md`, 규칙에 걸리지 않는 함정·적 변경이면 `docs/traps-spec.md`
   - 변경이 직접 고친 문서
3. 이미 확인한 것: 이번 작업에서 **실제로 실행한** 명령과 결과(통과 수·실패), 변이 확인, CI 결과만 적습니다. 실행하지 않은 것은 "실행하지 않음"과 이유를 씁니다.
4. 위험과 확인 요청: 스스로 확신하지 못한 점, 경계 사례, 명세와 다르게 판단한 부분을 질문 형태로 적습니다. 인자로 받은 확인 요청을 포함합니다. 증거 없이 "문제없음"이라고 쓰지 않습니다.
5. 파일 쓰기: `.codex/requests/<오늘 날짜>-<짧은 영어 슬러그>.md`에 아래 형식으로 씁니다. 같은 이름이 있으면 덮어쓰지 말고 슬러그를 바꿉니다.
6. 보고: 파일 경로와, Codex에게 그대로 붙여 넣을 한 줄 요청(아래 끝)을 알립니다.

## 형식
```
# Codex 리뷰 요청: <제목> (<날짜>)

## 요청
<무엇을 리뷰해 달라는지 한두 문장. 파일은 고치지 말 것.>

## 범위
- PR: <URL 또는 "없음">, 브랜치 <이름>
- 기준 <해시>(master) … 대상 <해시>, 커밋 <개수>개
- 비교: `git diff <기준>...<대상>`
- 바뀐 파일: <diff --stat 요약>

## 먼저 읽을 것
- `AGENTS.md`, `.codex/review.md`
- <2단계에서 고른 문서>

## 변경 요약
- <변경마다 한 줄, 파일 경로 포함>

## 이미 확인한 것
- <명령 — 결과>

## 위험과 확인 요청
- **확인 요청:** <질문>

## 검증에 쓸 수 있는 명령
<재현 명령 몇 개>

## 원하는 출력
`.codex/review.md`의 "출력" 형식(한국어, 우선순위, 파일:줄, 검증된 결함과 의심 구분). 확인 요청마다 동의/반대와 근거.
```

Codex에게 붙여 넣을 한 줄: `AGENTS.md, .codex/review.md, .codex/requests/<파일 이름>을 읽고 요청대로 리뷰해 주세요.`
