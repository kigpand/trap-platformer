import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// CI·배포는 Playwright 공식 이미지에서 E2E를 돌린다. 이미지 안의 브라우저는 그 태그의 Playwright 버전용이라, 의존성을 올리면서
// 태그를 그대로 두면 "브라우저를 찾을 수 없음"으로 실패한다 — 잠긴 @playwright/test 버전과 태그가 같은지 여기서 먼저 확인한다.
const root = resolve(__dirname, '../..');
const lockedVersion = readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8').match(/^ {2}'@playwright\/test@([^']+)':/m)?.[1];
const imageTag = (workflow: string) =>
  readFileSync(resolve(root, '.github/workflows', workflow), 'utf8').match(/image: mcr\.microsoft\.com\/playwright:v([^\s-]+)-/)?.[1];

describe('CI Playwright image', () => {
  it('matches the locked @playwright/test version in every workflow that runs E2E', () => {
    expect(lockedVersion).toMatch(/^\d+\.\d+\.\d+$/);
    for (const workflow of ['ci.yml', 'deploy.yml']) expect(imageTag(workflow), workflow).toBe(lockedVersion);
  });

  it('no longer installs browsers or system packages at run time', () => {
    for (const workflow of ['ci.yml', 'deploy.yml']) {
      expect(readFileSync(resolve(root, '.github/workflows', workflow), 'utf8'), workflow).not.toMatch(/^\s*- run: .*playwright install/m);
    }
  });
});
