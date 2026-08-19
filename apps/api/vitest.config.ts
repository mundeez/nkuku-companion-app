import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests share a single Postgres database; running files in
    // parallel causes cross-test FK violations (e.g. one file deletes a flock
    // while another's /alerts/generate is iterating over it). Force sequential
    // execution to keep tests isolated.
    fileParallelism: false,
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});

