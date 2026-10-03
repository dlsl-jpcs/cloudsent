import crypto from 'node:crypto';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  adminLoginSchema, adminPrayerPatchSchema, createPrayerSchema,
  prayerQuerySchema, reportSchema, resolveReportSchema, statusSchema,
} from '@cloudsent/contracts';
import { supabase, checkError, rpc, type MutationResult } from './db/supabase.js';
import { config } from './config.js';
import { blockedWord, contentHash } from './moderation.js';
import { deviceId, ensureDevice, prayerIpVolume, prayerRateLimit, rateLimit, reportRateLimit } from './rateLimit.js';
import { clearAdminSession, issueAdminSession, requireAdmin, requireCsrf, verifyPassword } from './auth.js';

export const router = Router();
const adminRouter = Router();
const loginRateLimit = rateLimit({ bucket: 'admin-login-ip', max: 5, windowMs: 15 * 60 * 1000, key: (req) => req.ip || 'unknown' });
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
function mutationResponse(res: Response, result: MutationResult, message: string, status = 200) {
  if (!result.ok) { error(res, result.status || 409, result.code || 'CONFLICT', result.message || 'Refresh and try again.'); return; }
  res.status(status).json({ data: { message } });
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
    if (decoded[2] !== expected || !z.string().datetime({ offset: true }).safeParse(decoded[0]).success || !z.string().uuid().safeParse(decoded[1]).success) return null;
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
    isAnonymous: row.is_anonymous, createdAt: new Date(row.created_at).toISOString(), approvedAt: new Date(row.approved_at || row.created_at).toISOString(),
  };
}
async function taxonomy(activeOnly: boolean) {
  const columns = activeOnly ? 'id:category_id,name,active,position' : 'id:category_id,name,description,active,position';
  let categories = supabase.from('categories').select(columns).order('position').order('name');
  let moods = supabase.from('moods').select(activeOnly ? 'id:mood_id,name,active,position' : 'id:mood_id,name,color_hint,active,position').order('position').order('name');
  if (activeOnly) { categories = categories.eq('active', true); moods = moods.eq('active', true); }
  const [c, m] = await Promise.all([categories, moods]);
  checkError(c.error); checkError(m.error);
  return { categories: c.data, moods: m.data };
}

router.get('/health', async (_req, res) => {
  try {
    const health = await rpc<{ status: string; schemaVersion: number }>('cloudsent_health');
    if (health.schemaVersion !== 4) throw new Error('Database setup is outdated');
    res.json({ data: health });
  } catch { error(res, 503, 'DB_UNAVAILABLE', 'CloudSent is temporarily unavailable.'); }
});
router.get('/taxonomy', async (_req, res) => {
  res.json({ data: { ...await taxonomy(true), colors: Object.entries(colorHex).map(([key, hex]) => ({ key, hex })) } });
});
router.get('/prayers', async (req, res) => {
  const parsed = prayerQuerySchema.safeParse(req.query);
  if (!parsed.success) { error(res, 400, 'INVALID_QUERY', 'One or more filters are invalid.'); return; }
  const q = parsed.data;
  const cursor = decodeCursor(q.cursor);
  if (q.cursor && !cursor) { error(res, 400, 'INVALID_CURSOR', 'That page cursor is no longer valid.'); return; }
  const rows = await rpc<any[]>('cloudsent_list_prayers', { p_filters: { ...q, limit: q.limit + 1, cursorApprovedAt: cursor?.approvedAt, cursorId: cursor?.id }, p_admin: false });
  const hasMore = rows.length > q.limit;
  const page = rows.slice(0, q.limit);
  const data = page.map(publicPrayer);
  const last = page.at(-1);
  // Preserve PostgreSQL's timestamp precision in the cursor so no rows are skipped.
  res.json({ data, meta: { hasMore, nextCursor: hasMore && last ? encodeCursor(last.approved_at, last.prayer_id) : null } });
});
router.get('/prayers/:id', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
  const rows = await rpc<any[]>('cloudsent_list_prayers', { p_filters: { id: req.params.id, limit: 1 }, p_admin: false });
  if (!rows.length) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
  res.json({ data: publicPrayer(rows[0]) });
});
router.post('/prayers', ensureDevice, prayerRateLimit, prayerIpVolume, async (req, res) => {
  const input = parseBody(createPrayerSchema, req.body, res); if (!input) return;
  if (blockedWord(input.message) || (input.title && blockedWord(input.title))) { error(res, 422, 'PROHIBITED_LANGUAGE', 'Please revise the wording before sending.'); return; }
  if (!input.isAnonymous && !input.displayName) { error(res, 422, 'DISPLAY_NAME_REQUIRED', 'Add a display name or choose Anonymous.'); return; }
  const key = req.get('Idempotency-Key');
  const flags = [];
  if (/\b(abuse|domestic violence|trafficking|self[- ]harm|sexual assault|rape)\b/i.test(input.message)) flags.push({ type: 'sensitive', detail: 'Sensitive language detected' });
  if (/\b(suicide|kill myself|hurt myself|bomb|threat)\b/i.test(input.message)) flags.push({ type: 'crisis', detail: 'Sensitive or crisis language detected' });
  if ((req as typeof req & { prayerIpHighVolume?: boolean }).prayerIpHighVolume) flags.push({ type: 'high_volume', detail: 'More than 100 prayer submissions from one pseudonymous IP in the current hour' });
  const result = await rpc<MutationResult>('cloudsent_submit_prayer', {
    p_input: input, p_submission_key: key && z.string().uuid().safeParse(key).success ? key : crypto.randomUUID(),
    p_hash: contentHash(input.message), p_flags: flags,
  });
  mutationResponse(res, result, 'Your prayer has been received.', 201);
});
router.post('/prayers/:id/reports', reportRateLimit, async (req, res) => {
  const input = parseBody(reportSchema, req.body, res); if (!input) return;
  if (!z.string().uuid().safeParse(req.params.id).success) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
  const hash = crypto.createHash('sha256').update(deviceId(req, res)).digest('hex');
  const result = await rpc<MutationResult>('cloudsent_report_prayer', { p_id: req.params.id, p_hash: hash, p_reason: input.reason });
  mutationResponse(res, result, 'Thank you. The report has been received.', 201);
});

adminRouter.param('id', (_req, res, next, value) => {
  if (!z.string().uuid().safeParse(value).success) { error(res, 404, 'NOT_FOUND', 'Record not found.'); return; }
  next();
});
adminRouter.post('/session', loginRateLimit, async (req, res) => {
  const input = parseBody(adminLoginSchema, req.body, res); if (!input) return;
  const result = await verifyPassword(input.username, input.password);
  if (!result.ok || !result.adminId || result.sessionVersion === undefined) { error(res, 401, 'INVALID_LOGIN', 'The username or password is incorrect.'); return; }
  res.json({ data: { csrfToken: issueAdminSession(res, result.adminId, result.sessionVersion) } });
});
adminRouter.get('/session', requireAdmin, async (req, res) => res.json({ data: { csrfToken: req.admin!.csrf } }));
adminRouter.delete('/session', requireAdmin, requireCsrf, async (_req, res) => { clearAdminSession(res); res.json({ data: { message: 'Signed out.' } }); });
adminRouter.get('/prayers', requireAdmin, async (req, res) => {
  const parsed = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), q: z.string().trim().max(100).optional() }).safeParse(req.query);
  if (!parsed.success) { error(res, 400, 'INVALID_QUERY', 'One or more admin filters are invalid.'); return; }
  const rows = await rpc<any[]>('cloudsent_list_prayers', { p_filters: { ...parsed.data, limit: 100 }, p_admin: true });
  res.json({ data: rows.map((row) => ({ ...publicPrayer(row), status: row.status, deletedAt: row.deleted_at, version: row.version })) });
});
adminRouter.patch('/prayers/:id', requireAdmin, requireCsrf, async (req, res) => {
  const input = parseBody(adminPrayerPatchSchema, req.body, res); if (!input) return;
  const result = await rpc<MutationResult>('cloudsent_prayer_action', { p_id: req.params.id, p_action: 'edit', p_input: input, p_admin_id: req.admin!.id });
  mutationResponse(res, result, 'Prayer updated.');
});
adminRouter.post('/prayers/:id/status', requireAdmin, requireCsrf, async (req, res) => {
  const input = parseBody(statusSchema, req.body, res); if (!input) return;
  const result = await rpc<MutationResult>('cloudsent_prayer_action', { p_id: req.params.id, p_action: 'status', p_input: input, p_admin_id: req.admin!.id });
  mutationResponse(res, result, 'Prayer status updated.');
});
for (const [method, path, action, message] of [
  ['delete', '/prayers/:id', 'delete', 'Prayer moved to Deleted.'],
  ['post', '/prayers/:id/restore', 'restore', 'Prayer restored.'],
  ['delete', '/prayers/:id/purge', 'purge', 'Prayer permanently purged.'],
] as const) {
  adminRouter[method](path, requireAdmin, requireCsrf, async (req, res) => {
    const result = await rpc<MutationResult>('cloudsent_prayer_action', { p_id: req.params.id, p_action: action, p_input: {}, p_admin_id: req.admin!.id });
    mutationResponse(res, result, message);
  });
}
adminRouter.get('/reports', requireAdmin, async (_req, res) => res.json({ data: await rpc('cloudsent_reports') }));
adminRouter.post('/reports/:prayerId/resolve', requireAdmin, requireCsrf, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.prayerId).success) { error(res, 404, 'NOT_FOUND', 'Prayer not found.'); return; }
  const input = parseBody(resolveReportSchema, req.body, res); if (!input) return;
  const result = await rpc<MutationResult>('cloudsent_resolve_report', { p_id: req.params.prayerId, p_action: input.action, p_note: input.note || null });
  mutationResponse(res, result, 'Report case resolved.');
});
adminRouter.get('/taxonomy', requireAdmin, async (_req, res) => res.json({ data: await taxonomy(false) }));
const taxonomyCreate = z.object({ name: z.string().trim().min(1).max(50), description: z.string().trim().max(255).optional(), colorHint: z.string().trim().max(20).optional() });
const taxonomyPatch = z.object({ name: z.string().trim().min(1).max(50).optional(), active: z.boolean().optional(), position: z.number().int().min(0).optional() });
for (const method of ['post', 'patch'] as const) {
  adminRouter[method](method === 'post' ? '/taxonomy/:kind' : '/taxonomy/:kind/:id', requireAdmin, requireCsrf, async (req, res) => {
    if (!['categories', 'moods'].includes(String(req.params.kind))) { error(res, 404, 'NOT_FOUND', 'Taxonomy not found.'); return; }
    const input = parseBody(method === 'post' ? taxonomyCreate : taxonomyPatch, req.body, res); if (!input) return;
    try {
      const result = await rpc<MutationResult & { data: unknown }>('cloudsent_taxonomy_write', { p_kind: req.params.kind, p_id: req.params.id || null, p_input: input });
      if (!result.ok) { mutationResponse(res, result, ''); return; }
      res.status(method === 'post' ? 201 : 200).json({ data: result.data });
    } catch (e: any) { if (e?.code === '23505') error(res, 409, 'DUPLICATE_TAXONOMY', 'That name already exists.'); else throw e; }
  });
}
function csvCell(value: unknown) { const text = value == null ? '' : String(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }
adminRouter.get('/export', requireAdmin, async (_req, res) => {
  const rows = await rpc<Record<string, unknown>[]>('cloudsent_export');
  const header = ['prayer_id', 'title', 'message', 'status', 'color', 'is_anonymous', 'display_name', 'category', 'mood', 'created_at', 'approved_at', 'report_count'];
  const lines = [header.map(csvCell).join(','), ...rows.map((row) => header.map((key) => csvCell(row[key])).join(','))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="cloudsent-prayers.csv"'); res.send(`\uFEFF${lines.join('\n')}`);
});
adminRouter.get('/stats', requireAdmin, async (_req, res) => res.json({ data: await rpc('cloudsent_stats') }));
router.use('/admin', adminRouter);
