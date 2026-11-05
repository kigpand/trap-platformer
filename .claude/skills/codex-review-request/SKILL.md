---
name: codex-review-request
description: 브랜치나 PR의 변경을 Codex가 독립적으로 리뷰하도록, 범위·읽을 문서·실행한 검사·위험·확인 요청을 정리한 요청 파일을 `.codex/requests/`에 만듭니다.
argument-hint: "[PR 번호 | 브랜치] [확인받고 싶은 점…]"
---
# Codex 리뷰 요청 만들기
Codex 리뷰(AGENTS.md "작업 흐름" 3번)에 넘길 인계 파일을 만듭니다. 파일만 쓰고 커밋·푸시·PR 댓글은 하지 않습니다(`.codex/requests/`는 `.gitignore`에 있음).

1. 범위 확정: 인자로 받은 PR(`gh pr view <번호> --json number,url,headRefName,headRefOid,baseRefName,statusCheckRollup`) 또는 브랜치, 없으면 현재 브랜치를 대상으로 합니다. 기준(`git merge-base master HEAD`)과 대상 커밋의 짧은 해시, `git diff --stat <기준>...<대상>`, 커밋 목록을 모읍니다. 커밋하지 않은 변경이 있으면 범위에 들어가지 않는다고 적습니다.
2. 읽을 문서 고르기: 항상 `AGENTS.md`, `.codex/review.md`. 그 밖에는 다음을 더합니다.
   - 규칙: 바뀐 파일이 `.claude/rules/*.md` 머리의 `paths` 패턴에 걸리는 규칙 파일. 표를 따로 외우지 말고 그때그때 `paths`를 읽어 맞춥니다.
   - 명세: 물리·충돌·이동이면 `docs/physics-spec.md`, 함정·적이면 `docs/traps-spec.md`, 플레이어 규칙·레벨 구성이면 `docs/game-design.md`, 모듈 경계면 `docs/architecture.md`, 결정을 바꾸면 해당 `docs/decisions/*.md`
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
