import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { pool } from './db/pool.js';

const COOKIE = config.NODE_ENV === 'production' ? '__Host-cloudsent_admin' : 'cloudsent_admin';
const SESSION_HOURS = 8;

export interface AdminClaims { sub: string; sessionVersion: number; csrf: string; }

export function issueAdminSession(res: Response, adminId: string, sessionVersion: number) {
  const csrf = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign({ sub: adminId, sessionVersion, csrf } satisfies AdminClaims, config.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 60 * 60 * 1000 });
  return csrf;
}

export function clearAdminSession(res: Response) { res.clearCookie(COOKIE, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); }

function claims(req: Request): AdminClaims | null {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try { return jwt.verify(token, config.JWT_SECRET) as AdminClaims; } catch { return null; }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const tokenClaims = claims(req);
  if (!tokenClaims?.sub || typeof tokenClaims.csrf !== 'string') { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }); return; }
  const result = await pool.query('SELECT admin_id, session_version FROM admins WHERE admin_id = $1', [tokenClaims.sub]);
  if (!result.rowCount || Number(result.rows[0].session_version) !== Number(tokenClaims.sessionVersion)) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }); return; }
  req.admin = { id: tokenClaims.sub, csrf: tokenClaims.csrf };
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.admin || req.get('x-csrf-token') !== req.admin.csrf) { res.status(403).json({ error: { code: 'CSRF_FAILED', message: 'Request could not be verified.' } }); return; }
  next();
}

export async function verifyPin(pin: string): Promise<{ ok: boolean; adminId?: string; sessionVersion?: number }> {
  const result = await pool.query('SELECT admin_id, pin_hash, session_version, next_attempt_at FROM admins LIMIT 1');
  if (!result.rowCount) return { ok: false };
  const admin = result.rows[0];
  if (admin.next_attempt_at && new Date(admin.next_attempt_at).getTime() > Date.now()) return { ok: false };
  const ok = await bcrypt.compare(`${pin}${config.PIN_PEPPER}`, admin.pin_hash);
  if (ok) {
    await pool.query('UPDATE admins SET failed_attempts = 0, next_attempt_at = NULL WHERE admin_id = $1', [admin.admin_id]);
    return { ok: true, adminId: admin.admin_id, sessionVersion: Number(admin.session_version) };
  }
  const failures = Number(admin.failed_attempts) + 1;
  const delay = Math.min(300_000, 1000 * (2 ** Math.min(failures, 9)));
  await pool.query('UPDATE admins SET failed_attempts = $2, next_attempt_at = now() + ($3 * interval \'1 millisecond\') WHERE admin_id = $1', [admin.admin_id, failures, delay]);
  return { ok: false };
}

declare global { namespace Express { interface Request { admin?: { id: string; csrf: string }; } } }
