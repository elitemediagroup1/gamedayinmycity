import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment; the platform backend has no DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // DB-backed suites (e.g. the API integration tests) rely on the CI Postgres
    // service container and read DATABASE_URL; give them headroom over the 5s
    // default so container round-trips never flake.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    passWithNoTests: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['api/**', 'utils/**', 'config/**', 'types/**', 'shared/**', 'database/**'],
    },
  },
});
