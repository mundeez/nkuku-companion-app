import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests share a single Postgres database; running files in
    // parallel causes cross-test FK violations and races (e.g. journal entry
    // number sequencing). MUST stay at the root level — Vitest 3 ignores
    // fileParallelism set inside a `projects` entry.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.{test,spec}.ts'],
          // Refuses to run unless the API target is a throwaway test env —
          // see tests/helpers/global-setup.ts. Project-scoped: only runs when
          // integration files are selected, so `test:unit` needs no live API.
          globalSetup: ['tests/helpers/global-setup.ts'],
        },
      },
    ],
  },
});
