import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import compress from '@fastify/compress';
import etag from '@fastify/etag';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { buildAuthModule } from './modules/auth/routes.js';
import { buildSupplierModule } from './modules/suppliers/routes.js';
import { buildFeedStageModule } from './modules/feed-stages/routes.js';
import { buildSupplierTemplateModule } from './modules/supplier-templates/routes.js';
import { buildBatchModule } from './modules/batches/routes.js';
import { buildProjectionModule } from './modules/projections/routes.js';
import { buildExpansionPlanModule } from './modules/expansion-plan/routes.js';
import { buildOverheadModule } from './modules/overhead/routes.js';
import { buildUserModule } from './modules/users/routes.js';
import { buildAccountModule as buildUserAccountModule } from './modules/account/routes.js';
import { buildOrganizationModule } from './modules/organizations/routes.js';
import { buildBillingModule } from './modules/billing/routes.js';
import { buildBreedModule } from './modules/breeds/routes.js';
import { buildBroilerFlockModule } from './modules/broiler-flocks/routes.js';
import { buildGrowthRecordModule } from './modules/growth-records/routes.js';
import { buildFeedRecordModule } from './modules/feed-records/routes.js';
import { buildFeedPurchaseModule } from './modules/feed-purchases/routes.js';
import { buildWaterRecordModule } from './modules/water-records/routes.js';
import { buildMortalityEventModule } from './modules/mortality-events/routes.js';
import { buildVaccinationEventModule } from './modules/vaccination-events/routes.js';
import { buildLightingTemperatureScheduleModule } from './modules/lighting-temperature-schedules/routes.js';
import { buildFinancialRecordModule } from './modules/financial-records/routes.js';
import { buildSaleRecordModule } from './modules/sale-records/routes.js';
import { buildAlertModule } from './modules/alerts/routes.js';
import { buildDiseaseModule } from './modules/diseases/routes.js';
import { buildMedicationRecordModule } from './modules/medication-records/routes.js';
import { buildVaccineInventoryModule } from './modules/vaccine-inventory/routes.js';
import { buildEnvironmentalRecordModule } from './modules/environmental-records/routes.js';
import { buildFlockTaskModule } from './modules/flock-tasks/routes.js';
import { buildFinancialEngineModule } from './modules/financial-engine/routes.js';
import { buildDashboardModule } from './modules/dashboard/routes.js';
import { buildAccountModule } from './modules/accounts/routes.js';
import { buildJournalModule } from './modules/journal/routes.js';
import { buildLedgerModule } from './modules/ledger/routes.js';
import { buildDocumentModule } from './modules/documents/routes.js';
import { buildAdModule } from './modules/ads/routes.js';
import { buildAdCampaignModule } from './modules/ad-campaigns/routes.js';
import { buildAdminOpsModule } from './modules/admin-ops/routes.js';
import { ensureBucket } from './core/storage/storage.service.js';
import { SchedulerService } from './core/financial-engine/scheduler.service.js';
import { DailyRecalculationService } from './core/financial-engine/daily-recalculation.service.js';
import cron from 'node-cron';

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// ── Compression (gzip/brotli) and ETag (304 Not Modified) ──
// Registered early so all responses benefit. ETag must be registered
// before routes so it can intercept If-None-Match headers.
await app.register(compress, { encodings: ['gzip', 'br'] });
await app.register(etag);

// Fastify 5 strictly validates the Content-Type header against the body.
// Bodyless requests (DELETE, GET, HEAD, OPTIONS) from clients often send
// `Content-Type: application/json` with no body, which Fastify 5 rejects
// with FST_ERR_CTP_EMPTY_JSON_BODY. Strip the header for these methods
// when no content-length is present so they are treated as no-body.
app.addHook('onRequest', async (request: any) => {
  if (!['DELETE', 'GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const ct = request.headers['content-type'];
  const cl = request.headers['content-length'];
  if (ct && ct.startsWith('application/json') && (!cl || cl === '0')) {
    delete request.headers['content-type'];
  }
});

// CORS: allow configured origins (comma-separated).
// In development, default to allowing all origins. In production, require
// explicit configuration to prevent open CORS.
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
    ? [] // fail closed in production if not configured
    : true;

await app.register(cors, { origin: corsOrigins, credentials: true });

// Cookie support for HttpOnly auth tokens (web clients).
// Mobile clients continue to use Bearer tokens from the JSON response body.
const cookieSecret = process.env.JWT_SECRET;
if (!cookieSecret && process.env.NODE_ENV === 'production') {
  app.log.error('JWT_SECRET environment variable is required in production — refusing to start');
  process.exit(1);
}
await app.register(cookie, {
  secret: cookieSecret || 'dev_cookie_secret',
});

await app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Swagger UI — only exposed in development to avoid leaking API docs in production
if (process.env.NODE_ENV !== 'production') {
  await app.register(swagger, {
    swagger: {
      info: {
        title: 'Nkuku Companion API',
        description: 'Broiler chicken production management API',
        version: '0.1.0-alpha',
      },
      consumes: ['application/json'],
      produces: ['application/json'],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });
}

// Decorate with shared Prisma instance
app.decorate('prisma', prisma);

// ── Redis (for refresh token tracking, OTP dev endpoint, rate limiting) ──
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: any = null;
try {
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, retryStrategy: (times: number) => Math.min(times * 500, 2000) });
  redis.on('connect', () => app.log.info('[Redis] Connected'));
  redis.on('error', (err: Error) => app.log.warn(`[Redis] Error: ${err.message}`));
  // Wait briefly for connection
  await new Promise<void>((resolve) => {
    if (redis.status === 'ready') return resolve();
    const timer = setTimeout(() => resolve(), 3000);
    redis.once('ready', () => { clearTimeout(timer); resolve(); });
  });
} catch (err: any) {
  app.log.warn(`[Redis] Connection failed: ${err.message}`);
}
if (redis) app.decorate('redis', redis);

// ── Ensure S3/MinIO bucket exists on boot ──
try {
  await ensureBucket();
  app.log.info('[Storage] Bucket ready');
} catch (err: any) {
  app.log.error(`[Storage] Bucket setup failed: ${err.message}`);
}

// ── Global error handler — convert Zod errors to 400 ──
// Must be set BEFORE registering modules so it applies to all routes.
app.setErrorHandler((err: any, request: any, reply: any) => {
  if (err?.name === 'ZodError') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: err.errors?.[0]?.message || 'Invalid request',
    });
  }
  // Let Fastify handle other errors (including its own 404 for not-found routes)
  reply.send(err);
});

// ── Register modules ─────────────────────
await app.register(buildAuthModule, { prefix: '/api/v1/auth' });
await app.register(buildSupplierModule, { prefix: '/api/v1/suppliers' });
await app.register(buildFeedStageModule, { prefix: '/api/v1/feed-stages' });
await app.register(buildSupplierTemplateModule, { prefix: '/api/v1/supplier-templates' });
await app.register(buildBatchModule, { prefix: '/api/v1/batches' });
await app.register(buildProjectionModule, { prefix: '/api/v1/projections' });
await app.register(buildExpansionPlanModule, { prefix: '/api/v1/expansion-plan' });
await app.register(buildOverheadModule, { prefix: '/api/v1/overhead' });
await app.register(buildUserModule, { prefix: '/api/v1/users' });
await app.register(buildUserAccountModule, { prefix: '/api/v1/account' });
await app.register(buildOrganizationModule, { prefix: '/api/v1/organizations' });
await app.register(buildBillingModule, { prefix: '/api/v1/billing' });
await app.register(buildBreedModule, { prefix: '/api/v1/breeds' });
await app.register(buildBroilerFlockModule, { prefix: '/api/v1/broiler-flocks' });
await app.register(buildGrowthRecordModule, { prefix: '/api/v1/growth-records' });
await app.register(buildFeedRecordModule, { prefix: '/api/v1/feed-records' });
await app.register(buildFeedPurchaseModule, { prefix: '/api/v1/feed-purchases' });
await app.register(buildWaterRecordModule, { prefix: '/api/v1/water-records' });
await app.register(buildMortalityEventModule, { prefix: '/api/v1/mortality-events' });
await app.register(buildVaccinationEventModule, { prefix: '/api/v1/vaccination-events' });
await app.register(buildLightingTemperatureScheduleModule, { prefix: '/api/v1/lighting-temperature-schedules' });
await app.register(buildFinancialRecordModule, { prefix: '/api/v1/financial-records' });
await app.register(buildSaleRecordModule, { prefix: '/api/v1/sale-records' });
await app.register(buildAlertModule, { prefix: '/api/v1/alerts' });
await app.register(buildDiseaseModule, { prefix: '/api/v1/diseases' });
await app.register(buildMedicationRecordModule, { prefix: '/api/v1/medication-records' });
await app.register(buildVaccineInventoryModule, { prefix: '/api/v1/vaccine-inventory' });
await app.register(buildEnvironmentalRecordModule, { prefix: '/api/v1/environmental-records' });
await app.register(buildFlockTaskModule, { prefix: '/api/v1/flock-tasks' });
await app.register(buildFinancialEngineModule, { prefix: '/api/v1/financial-engine' });
await app.register(buildDashboardModule, { prefix: '/api/v1/dashboard' });
await app.register(buildAccountModule, { prefix: '/api/v1/accounts' });
await app.register(buildJournalModule, { prefix: '/api/v1/journal' });
await app.register(buildLedgerModule, { prefix: '/api/v1/ledger' });
await app.register(buildDocumentModule, { prefix: '/api/v1/documents' });
await app.register(buildAdModule, { prefix: '/api/v1/ads' });
await app.register(buildAdCampaignModule, { prefix: '/api/v1/ad-campaigns' });
await app.register(buildAdminOpsModule, { prefix: '/api/v1/admin' });

// ── Health check ─────────────────────────
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start scheduled report cron ──────────
const scheduler = new SchedulerService(prisma);
scheduler.startCron();

// ── Start daily financial recalc cron ────
// NOTE: Harvest projection auto-generation disabled — projections are no longer
// auto-created as financial records. Overhead allocation still runs daily.
const dailyRecalc = new DailyRecalculationService(prisma);
const marketPrice = parseFloat(process.env.MARKET_PRICE_PER_KG || '25');
cron.schedule('0 2 * * *', async () => {
  app.log.info('[DailyRecalc] Starting daily overhead allocation...');
  try {
    await dailyRecalc.runDailyForAllOrganizations({ marketPricePerKg: marketPrice });
    app.log.info('[DailyRecalc] Completed successfully');
  } catch (err: any) {
    app.log.error('[DailyRecalc] Failed:', err.message);
  }
});

// ── Start daily billing cron ─────────────
// Runs at 1:00 AM daily — generates recurring invoices, expires trials,
// and suspends past-due subscriptions past the grace period.
import { runDailyBillingCron } from './core/billing/billing.service.js';
cron.schedule('0 1 * * *', async () => {
  app.log.info('[BillingCron] Starting daily billing run...');
  try {
    const result = await runDailyBillingCron(prisma);
    app.log.info(`[BillingCron] Done: ${result.invoicesGenerated} invoices, ${result.trialsExpired} trials expired, ${result.subscriptionsSuspended} suspended`);
  } catch (err: any) {
    app.log.error('[BillingCron] Failed:', err.message);
  }
});

// ── Start server ─────────────────────────
const port = parseInt(process.env.PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Nkuku API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
