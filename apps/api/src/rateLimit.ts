import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { pool } from './db/pool.js';
import { config } from './config.js';
import { pseudonym, sourceIdentity } from './moderation.js';

type Limit = { bucket: string; max: number; windowMs: number; key: (req: Request) => string; rolling?: boolean };

export function deviceId(req: Request, res: Response): string {
  const existing = req.signedCookies?.cloudsent_device;
  if (typeof existing === 'string' && existing.length > 20) return existing;
  const generated = cryptoRandomId();
  req.signedCookies = req.signedCookies || {};
  req.signedCookies.cloudsent_device = generated;
  res.cookie('cloudsent_device', generated, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', signed: true, maxAge: 1000 * 60 * 60 * 24 * 30, path: '/' });
  return generated;
}

function cryptoRandomId() { return crypto.randomUUID(); }

export function ensureDevice(req: Request, res: Response, next: NextFunction) {
  deviceId(req, res);
  next();
}

export async function prayerIpVolume(req: Request, _res: Response, next: NextFunction) {
  try {
    const key = pseudonym(sourceIdentity(req), config.PIN_PEPPER);
    const windowMs = 60 * 60 * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const result = await pool.query(
      `INSERT INTO rate_limit_buckets(bucket_key, bucket_name, window_start, count)
       VALUES ($1, 'prayer-ip-hour', $2, 1)
       ON CONFLICT (bucket_key, bucket_name, window_start)
       DO UPDATE SET count = rate_limit_buckets.count + 1
       RETURNING count`,
      [key, windowStart],
    );
    if (Number(result.rows[0]?.count || 0) > 100) {
      (req as Request & { prayerIpHighVolume?: boolean }).prayerIpHighVolume = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    next();
  } catch (error) { next(error); }
}

export function rateLimit(limit: Limit) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = limit.key(req);
      const key = pseudonym(raw, config.PIN_PEPPER);
      const bucketMs = limit.rolling ? 60 * 1000 : limit.windowMs;
      const windowStart = new Date(Math.floor(Date.now() / bucketMs) * bucketMs);
      const result = await pool.query(
        `INSERT INTO rate_limit_buckets(bucket_key, bucket_name, window_start, count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (bucket_key, bucket_name, window_start)
         DO UPDATE SET count = rate_limit_buckets.count + 1
         RETURNING count`,
        [key, limit.bucket, windowStart],
      );
      const count = limit.rolling
        ? Number((await pool.query('SELECT COALESCE(sum(count), 0)::int AS count FROM rate_limit_buckets WHERE bucket_key = $1 AND bucket_name = $2 AND window_start >= $3', [key, limit.bucket, new Date(Date.now() - limit.windowMs)])).rows[0]?.count || 0)
        : Number(result.rows[0].count);
      if (count > limit.max) {
        const retryAfter = limit.rolling ? Math.max(1, Math.ceil((windowStart.getTime() + bucketMs - Date.now()) / 1000)) : Math.max(1, Math.ceil((windowStart.getTime() + limit.windowMs - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Please wait before trying again.' } });
        return;
      }
      next();
    } catch (error) { next(error); }
  };
}

export const prayerRateLimit = rateLimit({ bucket: 'prayer-device', max: 20, windowMs: 24 * 60 * 60 * 1000, rolling: true, key: (req) => req.signedCookies?.cloudsent_device || sourceIdentity(req) });
export const reportRateLimit = rateLimit({ bucket: 'report-ip', max: 20, windowMs: 15 * 60 * 1000, key: (req) => sourceIdentity(req) });
