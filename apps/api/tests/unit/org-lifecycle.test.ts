import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { gunzipSync } from 'node:zlib';
import {
  exportOrganization,
  requestDeletion,
  cancelDeletion,
  purgeExpiredOrganizations,
} from '../../src/modules/organizations/lifecycle.service.js';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const ORG_ID = '00000000-0000-0000-0000-0000000000a6';
const USER_ID = '00000000-0000-0000-0000-0000000000a7';
const OTHER_ORG_ID = '00000000-0000-0000-0000-0000000000a8';

async function seed() {
  await prisma.user.upsert({
    where: { email: 'lifecycle-test@nkuku.local' },
    update: { isActive: true },
    create: { id: USER_ID, email: 'lifecycle-test@nkuku.local', name: 'Lifecycle', passwordHash: 'x', role: 'owner' },
  });
  for (const id of [ORG_ID, OTHER_ORG_ID]) {
    await prisma.organization.upsert({
      where: { id },
      update: { deletedAt: null, purgeAfter: null, isActive: true },
      create: { id, name: `Lifecycle Org ${id.slice(-2)}`, country: 'ZM', currency: 'ZMW' },
    });
  }
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG_ID, userId: USER_ID } },
    update: {},
    create: { organizationId: ORG_ID, userId: USER_ID, role: 'owner' },
  });
  const breed = await prisma.breed.findFirst();
  const flock = await prisma.broilerFlock.create({
    data: {
      organizationId: ORG_ID,
      breedId: breed!.id,
      name: 'Lifecycle test flock',
      startDate: new Date(),
      initialCount: 100,
      currentCount: 100,
    },
  });
  await prisma.mortalityEvent.create({
    data: { flockId: flock.id, eventDate: new Date(), count: 1, cause: 'other' },
  });
  await prisma.supplier.create({ data: { organizationId: ORG_ID, name: 'Lifecycle supplier a6' } });
  await prisma.invite.create({
    data: { organizationId: ORG_ID, email: 'inv@nkuku.local', role: 'viewer', token: 'secret-token', invitedBy: USER_ID, expiresAt: new Date(Date.now() + 86400000) },
  });
  return flock.id;
}

async function cleanup() {
  for (const id of [ORG_ID, OTHER_ORG_ID]) {
    const flockIds = (await prisma.broilerFlock.findMany({ where: { organizationId: id }, select: { id: true } })).map((f) => f.id);
    await prisma.mortalityEvent.deleteMany({ where: { flockId: { in: flockIds } } });
    await prisma.broilerFlock.deleteMany({ where: { organizationId: id } });
    await prisma.supplier.deleteMany({ where: { organizationId: id } });
    await prisma.invite.deleteMany({ where: { organizationId: id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
    await prisma.organization.deleteMany({ where: { id } });
  }
  await prisma.user.deleteMany({ where: { id: USER_ID } });
}

describe('organization lifecycle (export / delete / purge)', () => {
  let flockId: string;
  beforeAll(async () => { await cleanup(); flockId = await seed(); });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('exports all org-scoped tables without invite tokens or password hashes', async () => {
    const { buffer, filename } = await exportOrganization(prisma, ORG_ID);
    expect(filename).toMatch(/^nkuku-export-lifecycle-org-a6-\d{4}-\d{2}-\d{2}\.json\.gz$/);
    const data = JSON.parse(gunzipSync(buffer).toString());
    expect(data.organization.id).toBe(ORG_ID);
    expect(data.tables.broilerFlock).toHaveLength(1);
    expect(data.tables.mortalityEvent).toHaveLength(1);
    expect(data.tables.supplier).toHaveLength(1);
    expect(data.tables.invite).toHaveLength(1);
    expect(data.tables.invite[0].token).toBeUndefined();
    expect(data.tables.user[0].passwordHash).toBeUndefined();
    expect(data.tables.user[0].email).toBe('lifecycle-test@nkuku.local');
  });

  it('soft-deletes: deactivates, schedules purge ~30d out, revokes invites', async () => {
    const org = await requestDeletion(prisma, ORG_ID);
    expect(org.isActive).toBe(false);
    expect(org.deletedAt).toBeInstanceOf(Date);
    const days = (org.purgeAfter!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(await prisma.invite.count({ where: { organizationId: ORG_ID } })).toBe(0);
  });

  it('does not purge before purgeAfter', async () => {
    const { purged } = await purgeExpiredOrganizations(prisma);
    expect(purged).not.toContain('Lifecycle Org a6');
    expect(await prisma.organization.count({ where: { id: ORG_ID } })).toBe(1);
  });

  it('cancelDeletion restores the org', async () => {
    const org = await cancelDeletion(prisma, ORG_ID);
    expect(org.isActive).toBe(true);
    expect(org.deletedAt).toBeNull();
    expect(org.purgeAfter).toBeNull();
  });

  it('purges once purgeAfter has passed and leaves other orgs untouched', async () => {
    await requestDeletion(prisma, ORG_ID);
    await prisma.organization.update({ where: { id: ORG_ID }, data: { purgeAfter: new Date(Date.now() - 1000) } });

    const { purged, failed } = await purgeExpiredOrganizations(prisma);
    expect(failed).toEqual([]);
    expect(purged).toContain('Lifecycle Org a6');

    expect(await prisma.organization.count({ where: { id: ORG_ID } })).toBe(0);
    expect(await prisma.broilerFlock.count({ where: { id: flockId } })).toBe(0);
    expect(await prisma.mortalityEvent.count({ where: { flockId } })).toBe(0);
    expect(await prisma.supplier.count({ where: { organizationId: ORG_ID } })).toBe(0);
    // Sole-membership user is deactivated, not deleted
    const user = await prisma.user.findUnique({ where: { id: USER_ID } });
    expect(user?.isActive).toBe(false);
    // Unrelated org survives
    expect(await prisma.organization.count({ where: { id: OTHER_ORG_ID } })).toBe(1);
  });
});
