import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment; the platform backend has no DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Pure-logic suites need no global setup. DB-backed suites added later
    // rely on the CI Postgres service container and read DATABASE_URL.
    passWithNoTests: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['utils/**', 'config/**', 'types/**', 'database/**'],
    },
  },
});
