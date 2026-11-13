import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // pnpm coverage로만 켠다(pnpm test는 그대로 빠르게). 기준치는 두지 않고 보고만 한다.
    coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], reporter: ['text-summary', 'html'] },
  },
});
