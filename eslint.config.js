import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx,js}'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  // 훅 규칙(호출 순서·effect 의존성)은 React 코드에만 — 게임 엔진(src/game)은 React를 쓰지 않는다.
  {
    files: ['src/**/*.tsx'],
    ...reactHooks.configs['recommended-latest'],
    // 의존성 누락은 경고면 lint가 통과해 CI가 못 잡으므로 오류로 올린다.
    rules: { ...reactHooks.configs['recommended-latest'].rules, 'react-hooks/exhaustive-deps': 'error' },
  },
);
