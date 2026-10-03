import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';

let db: PGlite;
let gateway: Server;
let api: Server;
let base: string;
let cookie = '';
let csrf = '';
let categoryId: string;
let moodId: string;
let adminId: string;
let prayerId: string;
let setup: string;
const pepper = 'test-only-pepper-never-production';
const credentials = { username: 'test.keeper', password: 'test-only-cloudsent-passphrase' };
const secretKey = 'sb_secret_test_only';

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const entries = Object.entries(args);
  const params = entries.map(([key], index) => `${key} => $${index + 1}`).join(',');
  const values = entries.map(([, value]) => value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
  const result = await db.query<{ result: T }>(`SELECT public.${name}(${params}) AS result`, values);
  return result.rows[0].result;
}
async function request(path: string, method = 'GET', body?: unknown, authenticated = false, extra: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  setup = await readFile(new URL('../../../supabase/setup.sql', import.meta.url), 'utf8');
  await db.exec(setup);
  await db.exec('SET ROLE service_role;');
  // A disposable HTTP stand-in for the Supabase Data API, backed by real SQL.
  gateway = createServer(async (req, res) => {
    try {
      expect(req.headers.apikey).toBe(secretKey);
      const url = new URL(req.url!, 'http://localhost');
      let data: unknown;
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').at(-1)!;
        if (!/^cloudsent_[a-z_]+$/.test(name)) throw new Error('Unexpected RPC');
        let body = '';
        for await (const chunk of req) body += chunk;
        data = await call(name, JSON.parse(body || '{}'));
      } else if (url.pathname === '/rest/v1/admins') {
        const id = url.searchParams.get('admin_id')?.replace(/^eq\./, '');
        const username = url.searchParams.get('username')?.replace(/^eq\./, '');
        const rows = await db.query('SELECT * FROM admins WHERE ($1::uuid IS NULL OR admin_id = $1) AND ($2::text IS NULL OR username = $2) LIMIT 1', [id || null, username || null]);
        data = req.headers.accept?.includes('object+json') ? rows.rows[0] ?? null : rows.rows;
      } else if (['/rest/v1/categories', '/rest/v1/moods'].includes(url.pathname)) {
        const table = url.pathname.split('/').at(-1)!;
        const column = table === 'categories' ? 'category_id' : 'mood_id';
        const active = url.searchParams.get('active') === 'eq.true';
        const rows = await db.query(`SELECT *, ${column} AS id FROM ${table} WHERE (NOT $1::boolean OR active) ORDER BY position, name`, [active]);
        data = rows.rows;
      } else throw new Error(`Unexpected Supabase request: ${url.pathname}`);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));
    } catch (error: any) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: error.code || 'TEST_ERROR', message: error.message }));
    }
  });
  const url = await listen(gateway);
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('SUPABASE_URL', url); vi.stubEnv('SUPABASE_SECRET_KEY', secretKey);
  vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret-at-least-32-characters'); vi.stubEnv('PIN_PEPPER', pepper);
  const { default: handler } = await import('../src/vercel.js');
  api = createServer((req, res) => {
    // Vercel adds this configurable helper even when no cookies were sent.
    if (req.headers['x-test-vercel-cookies'] === '1') {
      Object.defineProperty(req, 'cookies', {
        configurable: true, enumerable: true,
        get: () => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
          const separator = part.indexOf('=');
          return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
        })),
      });
    }
    return handler(req as Request, res as Response);
  });
  base = await listen(api);
  const hash = await bcrypt.hash(credentials.password, 12);
  await call('cloudsent_bootstrap_admin', { p_username: credentials.username, p_hash: hash });
  adminId = (await db.query<{ admin_id: string }>('SELECT admin_id FROM admins')).rows[0].admin_id;
  categoryId = (await db.query<{ category_id: string }>('SELECT category_id FROM categories ORDER BY position LIMIT 1')).rows[0].category_id;
  moodId = (await db.query<{ mood_id: string }>('SELECT mood_id FROM moods ORDER BY position LIMIT 1')).rows[0].mood_id;
}, 30000);

afterAll(async () => {
  for (const server of [api, gateway]) if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (db) await db.close();
  vi.unstubAllEnvs();
});

describe('Vercel API and Supabase integration', () => {
  it('routes rewritten API paths and rejects unknown API URLs as JSON', async () => {
    const health = await request('/api/index?__cloudsent_path=health');
    expect(health.response.status).toBe(200); expect(health.body.data.schemaVersion).toBe(4);
    const unknown = await request('/api/index?__cloudsent_path=missing');
    expect(unknown.response.status).toBe(404); expect(unknown.body.error.code).toBe('NOT_FOUND');
    const choices = await request('/api/taxonomy');
    expect(choices.body.data.categories).toHaveLength(5); expect(choices.body.data.moods).toHaveLength(3);
    expect(choices.response.headers.get('cache-control')).toBe('no-store');
  });
  it('stores a submission as pending, preserves anonymity and skips a retry', async () => {
    const input = { title: 'Test prayer', message: 'Peace for our community', categoryId, moodId, color: 'sky', isAnonymous: true, displayName: 'Must not be saved' };
    const key = crypto.randomUUID();
    const first = await request('/api/prayers', 'POST', input, false, { 'Idempotency-Key': key });
    const retry = await request('/api/prayers', 'POST', input, false, { 'Idempotency-Key': key });
    expect(first.response.status).toBe(201); expect(retry.response.status).toBe(201);
    const rows = await db.query<any>('SELECT * FROM prayers');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: 'pending', display_name: null, originally_anonymous: true });
    prayerId = rows.rows[0].prayer_id;
    const wall = await request('/api/prayers'); expect(wall.body.data).toHaveLength(0);
    const detail = await request(`/api/prayers/${prayerId}`); expect(detail.response.status).toBe(404);
  });
  it('submits through Vercel cookie helpers, reuses verified cookies and rejects tampering', async () => {
    const input = { message: 'Vercel cookie regression prayer', categoryId, moodId, color: 'sky', isAnonymous: true };
    const key = crypto.randomUUID();
    const headers = { 'X-Test-Vercel-Cookies': '1', 'Idempotency-Key': key };
    const first = await request('/api/index?__cloudsent_path=prayers', 'POST', input, false, headers);
    expect(first.response.status).toBe(201);
    const setCookie = first.response.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly'); expect(setCookie).toContain('SameSite=Lax');
    const deviceCookie = setCookie.split(';')[0];
    const signedValue = decodeURIComponent(deviceCookie.slice(deviceCookie.indexOf('=') + 1));
    expect(cookieParser.signedCookie(signedValue, pepper)).toMatch(/^[0-9a-f-]{36}$/);
    const repeat = await request('/api/prayers', 'POST', input, false, { ...headers, Cookie: deviceCookie });
    expect(repeat.response.status).toBe(201); expect(repeat.response.headers.get('set-cookie')).toBeNull();
    for (const badCookie of [deviceCookie + 'tampered', 'cloudsent_device=unverified-device-value-without-a-signature']) {
      const retry = await request('/api/prayers', 'POST', input, false, { ...headers, Cookie: badCookie });
      expect(retry.response.status).toBe(201);
      expect(retry.response.headers.get('set-cookie')).toContain('cloudsent_device=s%3A');
      expect(retry.response.headers.get('set-cookie')!.split(';')[0]).not.toBe(deviceCookie);
    }
    const rows = await db.query<any>('SELECT * FROM prayers WHERE submission_key = $1', [key]);
    expect(rows.rows).toHaveLength(1); expect(rows.rows[0]).toMatchObject({ status: 'pending', display_name: null });
    expect((await request(`/api/prayers/${rows.rows[0].prayer_id}`)).response.status).toBe(404);
  });
  it('logs in and verifies admin sessions with Vercel-provided cookies', async () => {
    const helpers = { 'X-Test-Vercel-Cookies': '1', 'X-Forwarded-For': '192.0.2.30' };
    const login = await request('/api/index?__cloudsent_path=admin/session', 'POST', credentials, false, helpers);
    expect(login.response.status).toBe(200);
    const sessionCookie = login.response.headers.get('set-cookie')!.split(';')[0];
    expect(login.response.headers.get('set-cookie')).toContain('HttpOnly');
    const session = await request('/api/admin/session', 'GET', undefined, false, { ...helpers, Cookie: sessionCookie });
    expect(session.response.status).toBe(200); expect(session.body.data.csrfToken).toBe(login.body.data.csrfToken);
    const denied = await request('/api/admin/session', 'DELETE', undefined, false, { ...helpers, Cookie: sessionCookie });
    expect(denied.response.status).toBe(403);
    const logout = await request('/api/admin/session', 'DELETE', undefined, false, { ...helpers, Cookie: sessionCookie, 'X-CSRF-Token': login.body.data.csrfToken });
    expect(logout.response.status).toBe(200);
    expect((await request('/api/admin/session', 'GET', undefined, false, helpers)).response.status).toBe(401);
  });
  it('protects admin routes, uses a username/password cookie session and requires the CSRF token', async () => {
    expect((await request('/api/admin/stats')).response.status).toBe(401);
    const login = await request('/api/admin/session', 'POST', credentials);
    expect(login.response.status).toBe(200);
    cookie = login.response.headers.get('set-cookie')!.split(';')[0]; csrf = login.body.data.csrfToken;
    expect(login.response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await request('/api/admin/session', 'GET', undefined, true)).body.data.csrfToken).toBe(csrf);
    const denied = await request(`/api/admin/prayers/${prayerId}/status`, 'POST', { status: 'approved', expectedVersion: 1 }, false, { Cookie: cookie });
    expect(denied.response.status).toBe(403);
  });
  it('approves once and detects a competing stale approval', async () => {
    const approvals = await Promise.all([
      request(`/api/index?__cloudsent_path=admin/prayers/${prayerId}/status`, 'POST', { status: 'approved', expectedVersion: 1 }, true),
      request(`/api/admin/prayers/${prayerId}/status`, 'POST', { status: 'rejected', expectedVersion: 1 }, true),
    ]);
    expect(approvals.map((r) => r.response.status).sort()).toEqual([200, 409]);
    const row = (await db.query<any>('SELECT * FROM prayers WHERE prayer_id = $1', [prayerId])).rows[0];
    if (row.status !== 'approved') await call('cloudsent_prayer_action', { p_id: prayerId, p_action: 'status', p_input: { status: 'approved', expectedVersion: row.version }, p_admin_id: adminId });
    const wall = await request('/api/prayers'); expect(wall.body.data[0].id).toBe(prayerId);
  });
  it('locks original anonymity and creates one revision for a successful edit', async () => {
    const row = (await db.query<any>('SELECT * FROM prayers WHERE prayer_id = $1', [prayerId])).rows[0];
    const denied = await request(`/api/admin/prayers/${prayerId}`, 'PATCH', { isAnonymous: false, displayName: 'Someone', expectedVersion: row.version }, true);
    expect(denied.body.error.code).toBe('ORIGINAL_ANONYMITY_LOCKED');
    const edited = await request(`/api/admin/prayers/${prayerId}`, 'PATCH', { message: 'A revised prayer', expectedVersion: row.version }, true);
    expect(edited.response.status).toBe(200);
    expect((await db.query('SELECT * FROM prayer_revisions')).rows).toHaveLength(1);
    const stale = await request(`/api/admin/prayers/${prayerId}`, 'PATCH', { message: 'A stale edit', expectedVersion: row.version }, true);
    expect(stale.response.status).toBe(409);
  });
  it('groups reports, resolves them atomically and provides dashboard stats and export', async () => {
    const report = await request(`/api/prayers/${prayerId}/reports`, 'POST', { reason: 'Needs review' });
    expect(report.response.status).toBe(201);
    const stats = await request('/api/admin/stats', 'GET', undefined, true);
    expect(stats.body.data.unresolvedReportCases).toBe(1); expect(stats.body.data.categories).toHaveLength(5);
    const reports = await request('/api/admin/reports', 'GET', undefined, true);
    expect(reports.body.data[0].report_count).toBe(1);
    const response = await fetch(`${base}/api/admin/export`, { headers: { Cookie: cookie } });
    expect(response.status).toBe(200); expect(await response.text()).toContain('A revised prayer');
    const resolution = await request(`/api/admin/reports/${prayerId}/resolve`, 'POST', { action: 'reject', note: 'Reviewed' }, true);
    expect(resolution.response.status).toBe(200);
    expect((await request('/api/prayers')).body.data).toHaveLength(0);
    expect((await request('/api/admin/reports', 'GET', undefined, true)).body.data).toHaveLength(0);
  });
  it('soft deletes, restores the prior status, and only purges deleted records', async () => {
    expect((await request(`/api/admin/prayers/${prayerId}/purge`, 'DELETE', undefined, true)).response.status).toBe(404);
    expect((await request(`/api/admin/prayers/${prayerId}`, 'DELETE', undefined, true)).response.status).toBe(200);
    expect((await request(`/api/admin/prayers/${prayerId}/restore`, 'POST', undefined, true)).response.status).toBe(200);
    expect((await db.query<any>('SELECT status FROM prayers WHERE prayer_id = $1', [prayerId])).rows[0].status).toBe('rejected');
  });
  it('keeps at least one active taxonomy entry and rejects duplicate names', async () => {
    const created = await request('/api/admin/taxonomy/categories', 'POST', { name: 'School' }, true);
    expect(created.response.status).toBe(201); expect(created.body.data.id).toBeTruthy();
    const duplicate = await request('/api/admin/taxonomy/categories', 'POST', { name: 'school' }, true);
    expect(duplicate.response.status).toBe(409);
    const moods = (await db.query<any>('SELECT * FROM moods ORDER BY position')).rows;
    for (const mood of moods.slice(0, -1)) expect((await request(`/api/admin/taxonomy/moods/${mood.mood_id}`, 'PATCH', { active: false }, true)).response.status).toBe(200);
    const last = await request(`/api/admin/taxonomy/moods/${moods.at(-1).mood_id}`, 'PATCH', { active: false }, true);
    expect(last.body.error.code).toBe('LAST_ACTIVE_TAXONOMY');
  });
  it('paginates tied, high precision approval times without skipping records', async () => {
    const timestamp = '2026-10-03T12:00:00.123456Z';
    for (let index = 0; index < 4; index++) await db.query("INSERT INTO prayers(message, category_id, mood_id, color, status, approved_at) VALUES ($1,$2,$3,'gold','approved',$4)", [`Cursor ${index}`, categoryId, moodId, timestamp]);
    const ids: string[] = []; let cursor = '';
    do {
      const page = await request(`/api/prayers?limit=2&q=Cursor${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      expect(page.response.status).toBe(200); ids.push(...page.body.data.map((p: any) => p.id)); cursor = page.body.meta.nextCursor || '';
    } while (cursor);
    expect(ids).toHaveLength(4); expect(new Set(ids).size).toBe(4);
  });
  it('counts limits in the database and makes demo seeding repeatable', async () => {
    const args = { p_key: 'a'.repeat(64), p_bucket: 'test', p_window_start: new Date().toISOString(), p_since: null };
    expect(await call('cloudsent_rate_limit', args)).toBe(1); expect(await call('cloudsent_rate_limit', args)).toBe(2);
    const seed = [{ key: crypto.randomUUID(), title: 'Demo', message: 'A demo prayer', category: 'Prayer Intention', mood: 'Hopeful', color: 'sky', anonymous: true, displayName: null, createdAt: new Date().toISOString(), hash: 'b'.repeat(64) }];
    expect(await call('cloudsent_seed_demo', { p_prayers: seed })).toBe(1);
    expect(await call('cloudsent_seed_demo', { p_prayers: seed })).toBe(0);
  });
  it('reruns setup without changing data, passwords, sessions or original anonymity', async () => {
    await db.query("INSERT INTO prayers(message, category_id, mood_id, color, is_anonymous, originally_anonymous) VALUES ('Originally named',$1,$2,'sky',true,false)", [categoryId, moodId]);
    const before = (await db.query<any>('SELECT password_hash, session_version FROM admins')).rows[0];
    // Earlier manual SQL could have revoked the server role's table privileges.
    await db.exec('RESET ROLE; REVOKE ALL ON public.admins FROM service_role;'); await db.exec(setup); await db.exec('SET ROLE service_role;');
    expect((await db.query<any>('SELECT password_hash, session_version FROM admins')).rows[0]).toEqual(before);
    expect((await db.query<any>("SELECT originally_anonymous FROM prayers WHERE message = 'Originally named'")).rows[0].originally_anonymous).toBe(false);
  });
  it('denies browser roles access to sensitive tables and every CloudSent function', async () => {
    const privileges = await db.query<any>("SELECT has_table_privilege('anon', 'public.admins', 'SELECT') AS table_access, has_function_privilege('anon', 'public.cloudsent_list_prayers(jsonb,boolean)', 'EXECUTE') AS function_access");
    expect(privileges.rows[0]).toEqual({ table_access: false, function_access: false });
    const publicFunctions = await db.query<any>("SELECT proname FROM pg_proc WHERE left(proname, 10) = 'cloudsent_' AND (has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'))");
    expect(publicFunctions.rows).toHaveLength(0);
    await db.exec('SET ROLE anon;');
    try { await expect(db.query('SELECT * FROM public.admins')).rejects.toThrow('permission denied'); }
    finally { await db.exec('RESET ROLE; SET ROLE service_role;'); }
  });
  it('enforces the submission limit across separate requests using a signed device cookie', async () => {
    const activeMood = (await db.query<{ mood_id: string }>('SELECT mood_id FROM moods WHERE active LIMIT 1')).rows[0].mood_id;
    const input = { message: 'Submission limit test', categoryId, moodId: activeMood, color: 'sky' };
    const first = await request('/api/prayers', 'POST', input);
    expect(first.response.status).toBe(201);
    const deviceCookie = first.response.headers.get('set-cookie')!.split(';')[0];
    for (let index = 1; index < 20; index++) {
      expect((await request('/api/prayers', 'POST', input, false, { Cookie: deviceCookie })).response.status).toBe(201);
    }
    const denied = await request('/api/prayers', 'POST', input, false, { Cookie: deviceCookie });
    expect(denied.response.status).toBe(429); expect(Number(denied.response.headers.get('retry-after'))).toBeGreaterThan(0);
  });
  it('rejects PIN requests, resets credentials, invalidates sessions and preserves lockout', async () => {
    expect((await request('/api/admin/session/pin', 'PATCH', { currentPin: '12345678', newPin: '87654321' }, true)).response.status).toBe(404);
    expect((await request('/api/admin/session', 'POST', { pin: '12345678' }, false, { 'X-Forwarded-For': '192.0.2.11' })).response.status).toBe(422);
    const hash = await bcrypt.hash('replacement-test-only-passphrase', 12);
    await call('cloudsent_bootstrap_admin', { p_username: credentials.username, p_hash: hash });
    expect((await request('/api/admin/stats', 'GET', undefined, true)).response.status).toBe(401);
    const login = await request('/api/admin/session', 'POST', { username: ' TEST.KEEPER ', password: 'replacement-test-only-passphrase' });
    expect(login.response.status).toBe(200);
    const unknown = await request('/api/admin/session', 'POST', { username: 'not-a-user', password: 'replacement-test-only-passphrase' });
    expect(unknown.response.status).toBe(401);
    expect((await db.query<any>('SELECT failed_attempts FROM admins')).rows[0].failed_attempts).toBe(0);
    const denied = await request('/api/admin/session', 'POST', credentials);
    expect(denied.response.status).toBe(401); expect(denied.body.error.message).toBe(unknown.body.error.message);
    const admin = (await db.query<any>('SELECT * FROM admins')).rows[0];
    expect(admin.failed_attempts).toBe(1); expect(admin.next_attempt_at).toBeTruthy();
    const locked = await request('/api/admin/session', 'POST', { username: credentials.username, password: 'replacement-test-only-passphrase' });
    expect(locked.response.status).toBe(401);
    const stale = await call('cloudsent_login_result', { p_admin_id: adminId, p_success: true, p_session_version: admin.session_version - 1 });
    expect(stale.ok).toBe(false);
  });
  it('throttles repeated login attempts across requests', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const denied = await request('/api/admin/session', 'POST', { username: 'unknown.user', password: 'incorrect-test-password' }, false, { 'X-Forwarded-For': '192.0.2.20' });
      expect(denied.response.status).toBe(401);
    }
    const limited = await request('/api/admin/session', 'POST', credentials, false, { 'X-Forwarded-For': '192.0.2.20' });
    expect(limited.response.status).toBe(429); expect(Number(limited.response.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
