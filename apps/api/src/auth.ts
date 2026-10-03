import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { supabase, checkError, rpc } from './db/supabase.js';

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
  try { return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as AdminClaims; } catch { return null; }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const tokenClaims = claims(req);
  if (!tokenClaims?.sub || !/^[0-9a-f-]{36}$/i.test(tokenClaims.sub) || typeof tokenClaims.csrf !== 'string') { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }); return; }
  const { data: admin, error } = await supabase.from('admins').select('admin_id, password_hash, session_version').eq('admin_id', tokenClaims.sub).maybeSingle();
  checkError(error);
  if (!admin?.password_hash || Number(admin.session_version) !== Number(tokenClaims.sessionVersion)) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }); return; }
  req.admin = { id: tokenClaims.sub, csrf: tokenClaims.csrf };
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.admin || req.get('x-csrf-token') !== req.admin.csrf) { res.status(403).json({ error: { code: 'CSRF_FAILED', message: 'Request could not be verified.' } }); return; }
  next();
}

// Unknown users still perform password hashing work instead of exposing a fast account lookup.
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(username: string, password: string): Promise<{ ok: boolean; adminId?: string; sessionVersion?: number }> {
  const { data: admin, error } = await supabase.from('admins').select('admin_id, password_hash, session_version, next_attempt_at').eq('username', username).maybeSingle();
  checkError(error);
  const locked = admin?.next_attempt_at && new Date(admin.next_attempt_at).getTime() > Date.now();
  if (!admin?.password_hash || locked) {
    dummyHash ??= bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    await bcrypt.compare(password, await dummyHash);
    return { ok: false };
  }
  const ok = await bcrypt.compare(password, admin.password_hash);
  return rpc('cloudsent_login_result', { p_admin_id: admin.admin_id, p_success: ok, p_session_version: admin.session_version });
}

declare global { namespace Express { interface Request { admin?: { id: string; csrf: string }; } } }
