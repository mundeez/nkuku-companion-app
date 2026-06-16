import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { PrismaClient } from '@prisma/client';
import { buildAuthModule } from './modules/auth/routes.js';
import { buildSupplierModule } from './modules/suppliers/routes.js';
import { buildFeedStageModule } from './modules/feed-stages/routes.js';
import { buildBatchModule } from './modules/batches/routes.js';
import { buildProjectionModule } from './modules/projections/routes.js';
import { buildExpansionPlanModule } from './modules/expansion-plan/routes.js';
import { buildOverheadModule } from './modules/overhead/routes.js';
import { buildUserModule } from './modules/users/routes.js';
import { buildBreedModule } from './modules/breeds/routes.js';
import { buildBroilerFlockModule } from './modules/broiler-flocks/routes.js';
import { buildGrowthRecordModule } from './modules/growth-records/routes.js';
import { buildFeedRecordModule } from './modules/feed-records/routes.js';
import { buildWaterRecordModule } from './modules/water-records/routes.js';
import { buildMortalityEventModule } from './modules/mortality-events/routes.js';
import { buildVaccinationEventModule } from './modules/vaccination-events/routes.js';
import { buildFinancialRecordModule } from './modules/financial-records/routes.js';
import { buildAlertModule } from './modules/alerts/routes.js';
import { buildDiseaseModule } from './modules/diseases/routes.js';

const prisma = new PrismaClient();
const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// CORS: allow configured origins (comma-separated) or default to all in dev
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : true;

await app.register(cors, { origin: corsOrigins, credentials: true });

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

// Decorate with shared Prisma instance
app.decorate('prisma', prisma);

// ── Register modules ─────────────────────
await app.register(buildAuthModule, { prefix: '/api/v1/auth' });
await app.register(buildSupplierModule, { prefix: '/api/v1/suppliers' });
await app.register(buildFeedStageModule, { prefix: '/api/v1/feed-stages' });
await app.register(buildBatchModule, { prefix: '/api/v1/batches' });
await app.register(buildProjectionModule, { prefix: '/api/v1/projections' });
await app.register(buildExpansionPlanModule, { prefix: '/api/v1/expansion-plan' });
await app.register(buildOverheadModule, { prefix: '/api/v1/overhead' });
await app.register(buildUserModule, { prefix: '/api/v1/users' });
await app.register(buildBreedModule, { prefix: '/api/v1/breeds' });
await app.register(buildBroilerFlockModule, { prefix: '/api/v1/broiler-flocks' });
await app.register(buildGrowthRecordModule, { prefix: '/api/v1/growth-records' });
await app.register(buildFeedRecordModule, { prefix: '/api/v1/feed-records' });
await app.register(buildWaterRecordModule, { prefix: '/api/v1/water-records' });
await app.register(buildMortalityEventModule, { prefix: '/api/v1/mortality-events' });
await app.register(buildVaccinationEventModule, { prefix: '/api/v1/vaccination-events' });
await app.register(buildFinancialRecordModule, { prefix: '/api/v1/financial-records' });
await app.register(buildAlertModule, { prefix: '/api/v1/alerts' });
await app.register(buildDiseaseModule, { prefix: '/api/v1/diseases' });

// ── Health check ─────────────────────────
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

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
