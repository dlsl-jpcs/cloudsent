import crypto from 'node:crypto';

const blockedTerms = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot',
];

export type FlagType = 'duplicate' | 'sensitive' | 'crisis' | 'high_volume';

export function normalizeForMatching(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
}

export function blockedWord(value: string): boolean {
  const normalized = normalizeForMatching(value);
  return blockedTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(normalized));
}

export function contentHash(value: string): string {
  return crypto.createHash('sha256').update(normalizeForMatching(value)).digest('hex');
}

export function pseudonym(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function sourceIdentity(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined;
  return first || req.socket.remoteAddress || 'unknown';
}

export function createDeviceId(): string {
  return crypto.randomUUID();
}
