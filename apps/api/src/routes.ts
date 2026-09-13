import crypto from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  adminLoginSchema, adminPrayerPatchSchema, changePinSchema, createPrayerSchema,
  prayerQuerySchema, reportSchema, resolveReportSchema, statusSchema,
} from '@cloudsent/contracts';
import { pool, withTransaction } from './db/pool.js';
import { config } from './config.js';
import { blockedWord, contentHash } from './moderation.js';
import { deviceId, ensureDevice, prayerIpVolume, prayerRateLimit, rateLimit, reportRateLimit } from './rateLimit.js';
import { clearAdminSession, issueAdminSession, requireAdmin, requireCsrf, verifyPin } from './auth.js';

export const router = Router();
const adminRouter = Router();
const loginRateLimit = rateLimit({ bucket: 'admin-login-ip', max: 5, windowMs: 15 * 60 * 1000, key: (req) => req.ip || 'unknown' });
const eventClients = new Set<Response>();

const colorHex: Record<string, string> = {
  sky: '#DCEEFF', lavender: '#E9E2FF', gold: '#FFF0BF', rose: '#FFE2E9', sage: '#DFF0E3', cloud: '#EEF2F5',
};

function error(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error: { code, message, fields } });
}
function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0] || 'form'), issue.message]));
    error(res, 422, 'VALIDATION_FAILED', 'Please check the highlighted fields.', fields);
    return null;
  }
  return result.data;
}
function encodeCursor(approvedAt: string, id: string) {
  const payload = `${approvedAt}|${id}`;
  const sig = crypto.createHmac('sha256', config.JWT_SECRET).update(payload).digest('hex').slice(0, 24);
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}
function decodeCursor(value: string | undefined): { approvedAt: string; id: string } | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8').split('|');
    if (decoded.length !== 3) return null;
    const expected = crypto.createHmac('sha256', config.JWT_SECRET).update(`${decoded[0]}|${decoded[1]}`).digest('hex').slice(0, 24);
    if (decoded[2] !== expected || !z.string().datetime().safeParse(decoded[0]).success || !z.string().uuid().safeParse(decoded[1]).success) return null;
    return { approvedAt: decoded[0], id: decoded[1] };
  } catch { return null; }
}
function publicPrayer(row: any) {
  const message = String(row.message);
  return {
    id: row.prayer_id, title: row.title, message, excerpt: message.length > 280 ? `${message.slice(0, 277)}…` : message,
    category: { id: row.category_id, name: row.category_name, active: true, position: Number(row.category_position) },
    mood: { id: row.mood_id, name: row.mood_name, active: true, position: Number(row.mood_position) },
    color: row.color, colorHex: colorHex[row.color], displayName: row.is_anonymous ? null : row.display_name,
    isAnonymous: row.is_anonymous, createdAt: new Date(row.created_at).toISOString(), approvedAt: new Date(row.approved_at).toISOString(),
  };
}
const publicSelect = `SELECT p.*, c.name category_name, c.position category_position, m.name mood_name, m.position mood_position
  FROM prayers p JOIN categories c ON c.category_id = p.category_id JOIN moods m ON m.mood_id = p.mood_id`;

router.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ data: { status: 'ok' } }); }
  catch { error(res, 503, 'DB_UNAVAILABLE', 'CloudSent is temporarily unavailable.'); }
});

router.get('/taxonomy', async (_req, res, next) => {
  try {
    const [categories, moods] = await Promise.all([
      pool.query('SELECT category_id id, name, active, position FROM categories WHERE active = true ORDER BY position, name'),
      pool.query('SELECT mood_id id, name, active, position FROM moods WHERE active = true ORDER BY position, name'),
    ]);
    res.json({ data: { categories: categories.rows, moods: moods.rows, colors: Object.entries(colorHex).map(([key, hex]) => ({ key, hex })) } });
  } catch (e) { next(e); }
});

router.get('/prayers', async (req, res, next) => {
  try {
    const query = prayerQuerySchema.safeParse(req.query);
    if (!query.success) { error(res, 400, 'INVALID_QUERY', 'One or more filters are invalid.'); return; }
    const q = query.data;
    const cursor = decodeCursor(q.cursor);
    if (q.cursor && !cursor) { error(res, 400, 'INVALID_CURSOR', 'That page cursor is no longer valid.'); return; }
    const values: unknown[] = [];
    const clauses = [`p.status = 'approved'`, 'p.deleted_at IS NULL'];
    const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (cursor) clauses.push(`(p.approved_at, p.prayer_id) < (${add(cursor.approvedAt)}, ${add(cursor.id)})`);
    if (q.q) { const v = add(`%${q.q}%`); clauses.push(`(p.title ILIKE ${v} OR p.message ILIKE ${v})`); }
    if (q.category) clauses.push(`p.category_id = ${add(q.category)}`);
    if (q.mood) clauses.push(`p.mood_id = ${add(q.mood)}`);
    if (q.color) clauses.push(`p.color = ${add(q.color)}`);
    if (q.displayName) clauses.push(`p.is_anonymous = false AND p.display_name ILIKE ${add(`%${q.displayName}%`)}`);
    if (q.from) clauses.push(`p.created_at >= ${add(`${q.from}T00:00:00+08:00`)}`);
    if (q.to) { const date = new Date(`${q.to}T00:00:00+08:00`); date.setUTCDate(date.getUTCDate() + 1); clauses.push(`p.created_at < ${add(date.toISOString())}`); }
    const limit = q.limit + 1;
    const rows = await pool.query(`${publicSelect} WHERE ${clauses.join(' AND ')} ORDER BY p.approved_at DESC, p.prayer_id DESC LIMIT ${limit}`, values);
    const hasMore = rows.rows.length > q.limit;
    const data = rows.rows.slice(0, q.limit).map(publicPrayer);
    const last = data.at(-1);
    res.json({ data, meta: { hasMore, nextCursor: hasMore && last ? encodeCursor(last.approvedAt, last.id) : null } });
  } catch (e) { next(e); }
});

router.get('/prayers/:id', async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    const result = await pool.query(`${publicSelect} WHERE p.prayer_id = $1 AND p.status = 'approved' AND p.deleted_at IS NULL`, [req.params.id]);
    if (!result.rowCount) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    res.json({ data: publicPrayer(result.rows[0]) });
  } catch (e) { next(e); }
});

router.post('/prayers', ensureDevice, prayerRateLimit, prayerIpVolume, async (req, res, next) => {
  try {
    const input = parseBody(createPrayerSchema, req.body, res); if (!input) return;
    if (blockedWord(input.message) || (input.title && blockedWord(input.title))) { error(res, 422, 'PROHIBITED_LANGUAGE', 'Please revise the wording before sending.'); return; }
    const keyHeader = req.get('Idempotency-Key');
    const submissionKey = keyHeader && z.string().uuid().safeParse(keyHeader).success ? keyHeader : crypto.randomUUID();
    const category = await pool.query('SELECT category_id FROM categories WHERE category_id = $1 AND active = true', [input.categoryId]);
    const mood = await pool.query('SELECT mood_id FROM moods WHERE mood_id = $1 AND active = true', [input.moodId]);
    if (!category.rowCount || !mood.rowCount) { error(res, 422, 'TAXONOMY_INACTIVE', 'Please choose an available category and mood.'); return; }
    const messageHash = contentHash(input.message);
    const anonymous = input.isAnonymous !== false;
    const displayName = anonymous ? null : input.displayName;
    if (!anonymous && !displayName) { error(res, 422, 'DISPLAY_NAME_REQUIRED', 'Add a display name or choose Anonymous.'); return; }
    await withTransaction(async (client) => {
      const existing = await client.query('SELECT prayer_id FROM prayers WHERE submission_key = $1', [submissionKey]);
      if (existing.rowCount) return;
      const inserted = await client.query(`INSERT INTO prayers(title, message, category_id, mood_id, color, display_name, is_anonymous, originally_anonymous, submission_key, duplicate_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING prayer_id`, [input.title, input.message, input.categoryId, input.moodId, input.color, displayName, anonymous, submissionKey, messageHash]);
      const recent = await client.query('SELECT prayer_id FROM prayers WHERE duplicate_hash = $1 AND prayer_id <> $2 AND created_at >= now() - interval \'24 hours\' LIMIT 1', [messageHash, inserted.rows[0].prayer_id]);
      if (recent.rowCount) await client.query('INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES ($1, $2, $3)', [inserted.rows[0].prayer_id, 'duplicate', 'Matching normalized message within 24 hours']);
      if (/\b(abuse|domestic violence|trafficking|self[- ]harm|sexual assault|rape)\b/i.test(input.message)) await client.query('INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES ($1, $2, $3)', [inserted.rows[0].prayer_id, 'sensitive', 'Sensitive language detected']);
      if (/\b(suicide|kill myself|hurt myself|bomb|threat)\b/i.test(input.message)) await client.query('INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES ($1, $2, $3)', [inserted.rows[0].prayer_id, 'crisis', 'Sensitive or crisis language detected']);
      if ((req as typeof req & { prayerIpHighVolume?: boolean }).prayerIpHighVolume) await client.query('INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES ($1, $2, $3)', [inserted.rows[0].prayer_id, 'high_volume', 'More than 100 prayer submissions from one pseudonymous IP in the current hour']);
    });
    emitAdminEvent('prayer-created');
    res.status(201).json({ data: { message: 'Your prayer has been received.' } });
  } catch (e) { next(e); }
});

router.post('/prayers/:id/reports', reportRateLimit, async (req, res, next) => {
  try {
    const input = parseBody(reportSchema, req.body, res); if (!input) return;
    if (!z.string().uuid().safeParse(req.params.id).success) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    const prayer = await pool.query("SELECT prayer_id FROM prayers WHERE prayer_id = $1 AND status = 'approved' AND deleted_at IS NULL", [req.params.id]);
    if (!prayer.rowCount) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    const id = deviceId(req, res);
    const deviceHash = crypto.createHash('sha256').update(id).digest('hex');
    await pool.query('INSERT INTO reports(prayer_id, device_hash, reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, deviceHash, input.reason]);
    emitAdminEvent('report-created');
    res.status(201).json({ data: { message: 'Thank you. The report has been received.' } });
  } catch (e) { next(e); }
});

adminRouter.post('/session', loginRateLimit, async (req, res, next) => {
  try {
    const input = parseBody(adminLoginSchema, req.body, res); if (!input) return;
    const result = await verifyPin(input.pin);
    if (!result.ok || !result.adminId || result.sessionVersion === undefined) { error(res, 401, 'INVALID_LOGIN', 'The PIN is not valid.'); return; }
    const csrf = issueAdminSession(res, result.adminId, result.sessionVersion);
    res.json({ data: { csrfToken: csrf } });
  } catch (e) { next(e); }
});
adminRouter.get('/session', requireAdmin, async (req, res) => res.json({ data: { csrfToken: req.admin!.csrf } }));
adminRouter.delete('/session', requireAdmin, requireCsrf, async (_req, res) => { clearAdminSession(res); res.json({ data: { message: 'Signed out.' } }); });
adminRouter.patch('/session/pin', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const input = parseBody(changePinSchema, req.body, res); if (!input) return;
    const current = await verifyPin(input.currentPin);
    if (!current.ok) { error(res, 401, 'INVALID_PIN', 'The current PIN is not valid.'); return; }
    const hash = await (await import('bcryptjs')).default.hash(`${input.newPin}${config.PIN_PEPPER}`, 12);
    await pool.query('UPDATE admins SET pin_hash = $1, session_version = session_version + 1, failed_attempts = 0, next_attempt_at = NULL WHERE admin_id = $2', [hash, req.admin!.id]);
    clearAdminSession(res); emitAdminEvent('admin-pin-changed'); res.json({ data: { message: 'PIN changed. Sign in again.' } });
  } catch (e) { next(e); }
});

adminRouter.get('/prayers', requireAdmin, async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['pending','approved','rejected']).optional(), q: z.string().trim().max(100).optional() }).safeParse(req.query);
    if (!parsed.success) { error(res, 400, 'INVALID_QUERY', 'One or more admin filters are invalid.'); return; }
    const values: unknown[] = [parsed.data.status || null];
    const clauses = ['($1::text IS NULL OR p.status = $1)'];
    if (parsed.data.q) { values.push(`%${parsed.data.q}%`); clauses.push(`(p.title ILIKE $${values.length} OR p.message ILIKE $${values.length} OR p.display_name ILIKE $${values.length})`); }
    const rows = await pool.query(`${publicSelect.replace('p.*', 'p.*, p.deleted_at, p.status, p.version, p.moderation_priority')} WHERE ${clauses.join(' AND ')} ORDER BY p.created_at DESC LIMIT 100`, values);
    res.json({ data: rows.rows.map((row) => ({ ...publicPrayer({ ...row, approved_at: row.approved_at || row.created_at }), status: row.status, deletedAt: row.deleted_at, version: row.version })) });
  } catch (e) { next(e); }
});

adminRouter.patch('/prayers/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const input = parseBody(adminPrayerPatchSchema, req.body, res); if (!input) return;
    const existing = await pool.query('SELECT * FROM prayers WHERE prayer_id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!existing.rowCount) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    const current = existing.rows[0]; if (Number(current.version) !== input.expectedVersion) { error(res, 409, 'CONFLICT', 'This prayer changed in another tab. Refresh and try again.'); return; }
    const nextAnonymous = input.isAnonymous ?? current.is_anonymous;
    if (current.originally_anonymous && !nextAnonymous) { error(res, 422, 'ORIGINAL_ANONYMITY_LOCKED', 'An originally anonymous prayer cannot be assigned a display name.'); return; }
    const nextName = nextAnonymous ? null : (input.displayName === undefined ? current.display_name : input.displayName);
    if (!nextAnonymous && !nextName) { error(res, 422, 'DISPLAY_NAME_REQUIRED', 'A named prayer needs a display name.'); return; }
    await withTransaction(async (client) => {
      await client.query('INSERT INTO prayer_revisions(prayer_id, admin_id, action, snapshot) VALUES ($1,$2,$3,$4)', [req.params.id, req.admin!.id, 'edit', JSON.stringify(current)]);
      const nextTitle = input.title === undefined ? current.title : input.title;
      const nextMessage = input.message === undefined ? current.message : input.message;
      const nextCategory = input.categoryId === undefined ? current.category_id : input.categoryId;
      const nextMood = input.moodId === undefined ? current.mood_id : input.moodId;
      const nextColor = input.color === undefined ? current.color : input.color;
      await client.query(`UPDATE prayers SET title = $1, message = $2, category_id = $3, mood_id = $4, color = $5, is_anonymous = $6, display_name = $7, version = version + 1 WHERE prayer_id = $8`, [nextTitle, nextMessage, nextCategory, nextMood, nextColor, nextAnonymous, nextName, req.params.id]);
    });
    emitAdminEvent('prayer-updated'); res.json({ data: { message: 'Prayer updated.' } });
  } catch (e) { next(e); }
});

adminRouter.post('/prayers/:id/status', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const input = parseBody(statusSchema, req.body, res); if (!input) return;
    const result = await pool.query('UPDATE prayers SET status = $1, approved_at = CASE WHEN $1 = \'approved\' THEN COALESCE(approved_at, now()) ELSE approved_at END, version = version + 1 WHERE prayer_id = $2 AND deleted_at IS NULL AND version = $3 RETURNING prayer_id', [input.status, req.params.id, input.expectedVersion]);
    if (!result.rowCount) { error(res, 409, 'CONFLICT', 'This prayer changed in another tab. Refresh and try again.'); return; }
    emitAdminEvent('prayer-status-changed'); res.json({ data: { message: 'Prayer status updated.' } });
  } catch (e) { next(e); }
});
adminRouter.delete('/prayers/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE prayers SET deleted_at = now(), deleted_from_status = status, version = version + 1 WHERE prayer_id = $1 AND deleted_at IS NULL RETURNING prayer_id', [req.params.id]);
    if (!result.rowCount) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
    emitAdminEvent('prayer-deleted'); res.json({ data: { message: 'Prayer moved to Deleted.' } });
  } catch (e) { next(e); }
});
adminRouter.post('/prayers/:id/restore', requireAdmin, requireCsrf, async (req, res, next) => {
  try { const result = await pool.query("UPDATE prayers SET deleted_at = NULL, status = COALESCE(deleted_from_status, 'rejected'), deleted_from_status = NULL, version = version + 1 WHERE prayer_id = $1 AND deleted_at IS NOT NULL RETURNING prayer_id", [req.params.id]); if (!result.rowCount) { error(res, 404, 'NOT_FOUND', 'Deleted prayer not found.'); return; } emitAdminEvent('prayer-restored'); res.json({ data: { message: 'Prayer restored.' } }); }
  catch (e) { next(e); }
});
adminRouter.delete('/prayers/:id/purge', requireAdmin, requireCsrf, async (req, res, next) => {
  try { const result = await pool.query('DELETE FROM prayers WHERE prayer_id = $1 AND deleted_at IS NOT NULL RETURNING prayer_id', [req.params.id]); if (!result.rowCount) { error(res, 404, 'NOT_FOUND', 'Deleted prayer not found.'); return; } emitAdminEvent('prayer-purged'); res.json({ data: { message: 'Prayer permanently purged.' } }); }
  catch (e) { next(e); }
});

adminRouter.get('/reports', requireAdmin, async (_req, res, next) => {
  try { const rows = await pool.query(`SELECT p.prayer_id, p.title, p.message, p.status, count(r.report_id)::int report_count, max(r.created_at) last_report_at, json_agg(json_build_object('id', r.report_id, 'reason', r.reason, 'createdAt', r.created_at) ORDER BY r.created_at DESC) reports FROM prayers p JOIN reports r ON r.prayer_id = p.prayer_id WHERE r.resolved_at IS NULL GROUP BY p.prayer_id ORDER BY last_report_at DESC`); res.json({ data: rows.rows }); }
  catch (e) { next(e); }
});
adminRouter.post('/reports/:prayerId/resolve', requireAdmin, requireCsrf, async (req, res, next) => {
  try { const input = parseBody(resolveReportSchema, req.body, res); if (!input) return; await withTransaction(async (client) => { if (input.action === 'delete') await client.query("UPDATE prayers SET deleted_at = now(), deleted_from_status = status, version = version + 1 WHERE prayer_id = $1 AND deleted_at IS NULL", [req.params.prayerId]); else if (input.action === 'reject') await client.query("UPDATE prayers SET status = 'rejected', version = version + 1 WHERE prayer_id = $1 AND deleted_at IS NULL", [req.params.prayerId]); await client.query('UPDATE reports SET resolved_at = now(), resolved_action = $1, resolution_note = $2 WHERE prayer_id = $3 AND resolved_at IS NULL', [input.action, input.note || null, req.params.prayerId]); }); emitAdminEvent('report-resolved'); res.json({ data: { message: 'Report case resolved.' } }); }
  catch (e) { next(e); }
});

adminRouter.get('/taxonomy', requireAdmin, async (_req, res, next) => {
  try {
    const [categories, moods] = await Promise.all([pool.query('SELECT category_id id, name, description, active, position FROM categories ORDER BY position, name'), pool.query('SELECT mood_id id, name, color_hint, active, position FROM moods ORDER BY position, name')]);
    res.json({ data: { categories: categories.rows, moods: moods.rows } });
  } catch (e) { next(e); }
});
adminRouter.post('/taxonomy/:kind', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const kind = req.params.kind === 'categories' ? 'categories' : req.params.kind === 'moods' ? 'moods' : null;
    if (!kind) { error(res, 404, 'NOT_FOUND', 'Taxonomy not found.'); return; }
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(50), description: z.string().trim().max(255).optional(), colorHint: z.string().trim().max(20).optional() }), req.body, res); if (!input) return;
    const table = kind === 'categories' ? 'categories' : 'moods';
    const result = kind === 'categories' ? await pool.query('INSERT INTO categories(name, description, position) VALUES ($1,$2,(SELECT COALESCE(max(position),-1)+1 FROM categories)) RETURNING category_id id, name, active, position', [input.name, input.description || null]) : await pool.query('INSERT INTO moods(name, color_hint, position) VALUES ($1,$2,(SELECT COALESCE(max(position),-1)+1 FROM moods)) RETURNING mood_id id, name, active, position', [input.name, input.colorHint || null]);
    res.status(201).json({ data: result.rows[0], table });
  } catch (e: any) { if (e?.code === '23505') error(res, 409, 'DUPLICATE_TAXONOMY', 'That name already exists.'); else next(e); }
});
adminRouter.patch('/taxonomy/:kind/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const kind = req.params.kind === 'categories' ? 'categories' : req.params.kind === 'moods' ? 'moods' : null; if (!kind) { error(res, 404, 'NOT_FOUND', 'Taxonomy not found.'); return; }
    const input = parseBody(z.object({ name: z.string().trim().min(1).max(50).optional(), active: z.boolean().optional(), position: z.number().int().min(0).optional() }), req.body, res); if (!input) return;
    const table = kind === 'categories' ? 'categories' : 'moods'; const idColumn = kind === 'categories' ? 'category_id' : 'mood_id';
    if (input.active === false) {
      const activeCount = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE active = true AND ${idColumn} <> $1`, [req.params.id]);
      if (Number(activeCount.rows[0]?.count || 0) < 1) { error(res, 409, 'LAST_ACTIVE_TAXONOMY', 'Keep at least one active taxonomy entry.'); return; }
    }
    const result = await pool.query(`UPDATE ${table} SET name = COALESCE($1,name), active = COALESCE($2,active), position = COALESCE($3,position) WHERE ${idColumn} = $4 RETURNING *`, [input.name || null, input.active, input.position, req.params.id]);
    if (!result.rowCount) { error(res, 404, 'NOT_FOUND', 'Taxonomy entry not found.'); return; }
    res.json({ data: result.rows[0] });
  } catch (e: any) { if (e?.code === '23505') error(res, 409, 'DUPLICATE_TAXONOMY', 'That name already exists.'); else next(e); }
});

function csvCell(value: unknown) { const text = value === null || value === undefined ? '' : String(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }
adminRouter.get('/export', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await pool.query(`SELECT p.prayer_id, p.title, p.message, p.status, p.color, p.is_anonymous, CASE WHEN p.is_anonymous THEN NULL ELSE p.display_name END display_name, c.name category, m.name mood, p.created_at, p.approved_at, count(r.report_id)::int report_count FROM prayers p JOIN categories c ON c.category_id=p.category_id JOIN moods m ON m.mood_id=p.mood_id LEFT JOIN reports r ON r.prayer_id=p.prayer_id WHERE p.deleted_at IS NULL GROUP BY p.prayer_id,c.name,m.name ORDER BY p.created_at DESC`);
    const header = ['prayer_id','title','message','status','color','is_anonymous','display_name','category','mood','created_at','approved_at','report_count'];
    const lines = [header.map(csvCell).join(','), ...rows.rows.map((row) => header.map((key) => csvCell(row[key])).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="cloudsent-prayers.csv"'); res.send(`\uFEFF${lines.join('\n')}`);
  } catch (e) { next(e); }
});

adminRouter.get('/stats', requireAdmin, async (_req, res, next) => {
  try { const [totals, categories, moods, trend, reports, flags] = await Promise.all([pool.query('SELECT status, count(*)::int count FROM prayers WHERE deleted_at IS NULL GROUP BY status'), pool.query('SELECT c.name, count(p.prayer_id)::int count FROM categories c LEFT JOIN prayers p ON p.category_id=c.category_id AND p.deleted_at IS NULL GROUP BY c.category_id ORDER BY c.position'), pool.query('SELECT m.name, count(p.prayer_id)::int count FROM moods m LEFT JOIN prayers p ON p.mood_id=m.mood_id AND p.deleted_at IS NULL GROUP BY m.mood_id ORDER BY m.position'), pool.query("SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Manila')::date day, count(*)::int count FROM prayers WHERE deleted_at IS NULL AND created_at >= now() - interval '90 days' GROUP BY day ORDER BY day"), pool.query('SELECT count(DISTINCT prayer_id)::int count FROM reports WHERE resolved_at IS NULL'), pool.query('SELECT flag_type, count(*)::int count FROM moderation_flags WHERE resolved_at IS NULL GROUP BY flag_type')]); res.json({ data: { totals: totals.rows, categories: categories.rows, moods: moods.rows, trend: trend.rows, unresolvedReportCases: reports.rows[0]?.count || 0, flags: flags.rows } }); }
  catch (e) { next(e); }
});

adminRouter.get('/events', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.(); res.write(`event: connected\ndata: {}\n\n`); eventClients.add(res);
  const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: {}\n\n`), 15_000);
  req.on('close', () => { clearInterval(heartbeat); eventClients.delete(res); res.end(); });
});

function emitAdminEvent(type: string) { for (const client of eventClients) { try { client.write(`event: ${type}\ndata: {}\n\n`); } catch { eventClients.delete(client); } } }

router.use('/admin', adminRouter);
