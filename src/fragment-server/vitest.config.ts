import { defineConfig } from 'vitest/config';

export default defineConfig({
  optimizeDeps: { noDiscovery: true },
  ssr: {
    external: ['@ai-companion/types', '@ai-companion/utils'],
    noExternal: [],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
