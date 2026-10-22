import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at https://<user>.github.io/<repo>/ without knowing the repo name.
  base: './',
  build: { target: 'es2022' },
  // Play.bat and `npm run dev` use 5200; Claude's preview (.claude/launch.json) uses 5201.
  server: { port: 5200 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
