import { defineConfig } from 'vitest/config';

// Fast unit tests (TypeScript, no Worker runtime). The black-box API tests against the real Worker + local D1
// stay in tests/api (node:test, run by scripts/ci-local.sh) so they can be pointed at any implementation.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    reporters: ['default'],
  },
});
