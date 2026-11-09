import { TEST_API_URL, TEST_DATABASE_URL } from './env.js';

// How long to wait for the API to come up. The test stack boots with
// `prisma migrate deploy && prisma db seed && tsx watch`, which can take a
// couple of minutes on a cold build — the guard doubles as a readiness wait.
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 2_000;

function redacted(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//<redacted>@');
}

/**
 * Guard against running the destructive integration suite (it registers
 * orgs/users, posts sales/journal entries, deletes tenants) against a
 * non-test target. This suite previously ran inside the dev api container
 * and polluted the shared production database — this guard makes that
 * impossible.
 *
 * The target is accepted as a test environment when EITHER:
 *   - GET /health reports { env: "test" } — the API was started with
 *     NKUKU_TEST_TARGET=1 (docker-compose.test.yml and CI set this), or
 *   - the vitest process env DATABASE_URL contains "nkuku_test"
 *     (in-container runs share the API's environment).
 *
 * Anything else → hard failure before a single test file executes.
 */
export default async function setup() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let health: any = null;
  let lastErr: any = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${TEST_API_URL}/health`);
      if (res.ok) {
        health = await res.json().catch(() => null);
        break;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      lastErr = err;
    }
    await new Promise((s) => setTimeout(s, HEALTH_POLL_MS));
  }

  if (!health) {
    throw new Error(
      `[test-guard] Cannot reach API at ${TEST_API_URL} ` +
        `(${lastErr?.message ?? 'no response'} after ${HEALTH_TIMEOUT_MS / 1000}s).\n` +
        `Start the isolated test stack first:\n` +
        `  docker compose -f docker-compose.test.yml up -d --build   (repo root)\n` +
        `then either run vitest inside it:  pnpm run test:compose   (apps/api)\n` +
        `or from the host:                  API_URL=http://localhost:3002 pnpm run test:integration`,
    );
  }

  const dbUrl = TEST_DATABASE_URL ?? '';
  const targetIsTest = health?.env === 'test' || dbUrl.includes('nkuku_test');

  if (!targetIsTest) {
    throw new Error(
      `[test-guard] REFUSING to run integration tests against a non-test target.\n` +
        `  API_URL      : ${TEST_API_URL}  (GET /health → env=${JSON.stringify(health?.env)})\n` +
        `  DATABASE_URL : ${dbUrl ? redacted(dbUrl) : '(unset)'}\n` +
        `Expected the API /health endpoint to report { "env": "test" } (set\n` +
        `NKUKU_TEST_TARGET=1 on the API) or DATABASE_URL to contain "nkuku_test".\n` +
        `Use docker-compose.test.yml — do NOT run this suite against the dev/prod API.`,
    );
  }

  // Secondary consistency warning: when the test process can see a
  // DATABASE_URL it is used directly by PrismaClient in some test files.
  // If it doesn't look like the test DB those files could still touch real
  // data even though the API target is the throwaway one. Warn loudly.
  if (dbUrl && !dbUrl.includes('nkuku_test') && health?.env === 'test') {
    console.warn(
      `[test-guard] WARNING: API at ${TEST_API_URL} is a test target, but ` +
        `TEST_DATABASE_URL/DATABASE_URL (${redacted(dbUrl)}) does not contain "nkuku_test". ` +
        `Test files that open a direct Prisma connection may touch the wrong database.`,
    );
  }

  console.log(`[test-guard] OK — target ${TEST_API_URL} reports env=${JSON.stringify(health?.env)}`);
}
