import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages 프로젝트 사이트(kigpand.github.io/trap-platformer/)는 하위 경로로 서빙되므로
// 빌드에만 base를 적용한다 — dev 서버(pnpm dev, e2e 테스트가 쓰는)는 그대로 루트로 둔다.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/trap-platformer/' : '/',
  plugins: [react()],
}));
