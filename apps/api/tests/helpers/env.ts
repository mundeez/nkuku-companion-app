// ── Shared test-environment helpers ──────────────────────────
// Integration tests must run against the dedicated throwaway stack defined
// in docker-compose.test.yml (postgres `nkuku_test`, redis, minio, api on
// host port 3002) — NEVER against the dev/prod API. The vitest globalSetup
// guard (tests/helpers/global-setup.ts) enforces this by refusing to run
// unless the target API reports { "env": "test" } from GET /health or the
// test process env DATABASE_URL contains "nkuku_test".

/**
 * Base URL of the API under test.
 *  - Inside the test api container (`pnpm run test:compose`): the default
 *    http://localhost:3001 is correct — vitest shares the container/network
 *    namespace with the API process.
 *  - From the host: `API_URL=http://localhost:3002 pnpm run test:integration`.
 */
export const TEST_API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * DATABASE_URL for the few tests that open a direct Prisma connection.
 * Prefer TEST_DATABASE_URL so host runs can point at the test DB
 * (postgresql://nkuku_user:test_password@127.0.0.1:35432/nkuku_test) without
 * exporting a prod-looking DATABASE_URL. Falls back to DATABASE_URL, which
 * is what in-container runs and CI already set correctly.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
