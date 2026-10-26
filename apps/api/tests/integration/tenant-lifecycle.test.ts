import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'http://localhost:3001';
const PASSWORD = 'TestPass123!';

async function register(suffix: string) {
  const email = `lifecycle-${suffix}@example.com`;
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password: PASSWORD, name: `Lifecycle ${suffix}`,
      organizationName: `Lifecycle Farm ${suffix}`, country: 'ZM', currency: 'ZMW', consent: true,
    }),
  });
  const data = await res.json();
  return { ...data, email, orgName: `Lifecycle Farm ${suffix}` };
}

async function login(email: string) {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return { status: res.status, data: await res.json() };
}

async function req(path: string, options: any = {}, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

describe('Tenant lifecycle: export / delete / restore / account deletion', () => {
  let owner: any;

  beforeAll(async () => {
    owner = await register(`own-${Date.now()}`);
    expect(owner.accessToken).toBeTruthy();
  });

  it('owner can export org data as gzip', async () => {
    const res = await fetch(`${API_URL}/api/v1/organizations/export`, {
      headers: { Authorization: `Bearer ${owner.accessToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/gzip');
    expect(res.headers.get('content-disposition')).toMatch(/nkuku-export-.*\.json\.gz/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf[0]).toBe(0x1f); // gzip magic
    expect(buf[1]).toBe(0x8b);
  });

  it('rejects org deletion with wrong confirmation name', async () => {
    const { status, data } = await req('/api/v1/organizations/delete', {
      method: 'POST', body: JSON.stringify({ confirmName: 'nope' }),
    }, owner.accessToken);
    expect(status).toBe(400);
    expect(data.error).toBe('CONFIRMATION_MISMATCH');
  });

  it('sole owner cannot delete their account while owning an active org', async () => {
    const { status, data } = await req('/api/v1/account/me', {
      method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }),
    }, owner.accessToken);
    expect(status).toBe(409);
    expect(data.error).toBe('SOLE_OWNER');
    expect(data.organizations).toContain(owner.orgName);
  });

  it('soft-deletes the org; existing token is rejected immediately', async () => {
    const { status, data } = await req('/api/v1/organizations/delete', {
      method: 'POST', body: JSON.stringify({ confirmName: owner.orgName }),
    }, owner.accessToken);
    expect(status).toBe(200);
    expect(data.deleted).toBe(true);
    expect(new Date(data.purgeAfter).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    const me = await req('/api/v1/organizations/me', {}, owner.accessToken);
    expect(me.status).toBe(401);
    expect(me.data.error).toBe('ORGANIZATION_INACTIVE');
  });

  let restoreToken: string;
  it('login during grace returns ORGANIZATION_PENDING_DELETION with a restore token for owners', async () => {
    const { status, data } = await login(owner.email);
    expect(status).toBe(403);
    expect(data.error).toBe('ORGANIZATION_PENDING_DELETION');
    expect(data.organizationName).toBe(owner.orgName);
    expect(data.canRestore).toBe(true);
    expect(typeof data.restoreToken).toBe('string');
    restoreToken = data.restoreToken;
  });

  it('rejects a bogus restore token', async () => {
    const { status, data } = await req('/api/v1/organizations/restore', {
      method: 'POST', body: JSON.stringify({ restoreToken: 'garbage' }),
    });
    expect(status).toBe(401);
    expect(data.error).toBe('INVALID_RESTORE_TOKEN');
  });

  it('restore token cancels deletion and login works again', async () => {
    const { status, data } = await req('/api/v1/organizations/restore', {
      method: 'POST', body: JSON.stringify({ restoreToken }),
    });
    expect(status).toBe(200);
    expect(data.restored).toBe(true);

    const back = await login(owner.email);
    expect(back.status).toBe(200);
    expect(back.data.accessToken).toBeTruthy();
    owner.accessToken = back.data.accessToken;
  });

  it('after deleting the org, the sole owner can still delete their own account', async () => {
    const del = await req('/api/v1/organizations/delete', {
      method: 'POST', body: JSON.stringify({ confirmName: owner.orgName }),
    }, owner.accessToken);
    expect(del.status).toBe(200);

    // Org is inactive — every other route 401s, but account deletion is allowed through.
    const blocked = await req('/api/v1/account/me', {}, owner.accessToken);
    expect(blocked.status).toBe(401);

    const acct = await req('/api/v1/account/me', {
      method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }),
    }, owner.accessToken);
    expect(acct.status).toBe(200);
    expect(acct.data.deleted).toBe(true);

    const l = await login(owner.email);
    expect(l.status).toBe(401);
  });

  it('a non-owner member can delete their account and is fully anonymized', async () => {
    const boss = await register(`boss-${Date.now()}`);
    // Free plan = 1 user; upgrade to grower (2 users) via the mock provider.
    const sub = await req('/api/v1/billing/subscribe', {
      method: 'POST', body: JSON.stringify({ planCode: 'grower', billingCycle: 'monthly' }),
    }, boss.accessToken);
    expect(sub.status).toBe(200);
    await req(`/api/v1/billing/dev/mock-pay?txRef=${sub.data.checkout.txRef}`, {}, boss.accessToken);

    const inviteEmail = `member-${Date.now()}@example.com`;
    const inv = await req('/api/v1/organizations/invites', {
      method: 'POST', body: JSON.stringify({ email: inviteEmail, role: 'viewer' }),
    }, boss.accessToken);
    expect(inv.status).toBe(200);
    const token = new URL(inv.data.inviteUrl, 'http://localhost').searchParams.get('token');

    const accept = await req('/api/v1/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password: PASSWORD, name: 'Member', consent: true }),
    });
    expect(accept.status).toBe(201);
    const memberToken = accept.data.accessToken;

    const del = await req('/api/v1/account/me', {
      method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }),
    }, memberToken);
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);

    // Old token dead
    const me = await req('/api/v1/account/me', {}, memberToken);
    expect(me.status).toBe(401);

    // Can't log in
    const l = await login(inviteEmail);
    expect(l.status).toBe(401);

    // Member no longer listed
    const members = await req('/api/v1/organizations/members', {}, boss.accessToken);
    expect(members.status).toBe(200);
    expect(members.data.some((m: any) => m.user.email === inviteEmail)).toBe(false);
  });

  it('requires confirm: "DELETE"', async () => {
    const u = await register(`conf-${Date.now()}`);
    const { status } = await req('/api/v1/account/me', {
      method: 'DELETE', body: JSON.stringify({ confirm: 'yes' }),
    }, u.accessToken);
    expect(status).toBe(400);
  });
});
