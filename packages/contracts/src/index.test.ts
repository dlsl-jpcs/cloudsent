import { describe, expect, it } from 'vitest';
import { adminCredentialsSchema, adminLoginSchema, createPrayerSchema, colorKeys } from './index.js';

describe('contracts', () => {
  it('uses normalized usernames and passwords, not a PIN payload', () => {
    expect(adminLoginSchema.parse({ username: '  Keeper.Test  ', password: ' a long passphrase ' })).toEqual({ username: 'keeper.test', password: ' a long passphrase ' });
    expect(adminLoginSchema.safeParse({ pin: '12345678' }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: 'keeper', password: 'pass', pin: '12345678' }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: 'invalid username', password: 'pass' }).success).toBe(false);
  });
  it('requires long setup passwords and rejects bcrypt truncation in UTF-8', () => {
    expect(adminCredentialsSchema.safeParse({ username: 'keeper', password: 'a test passphrase of sufficient length' }).success).toBe(true);
    expect(adminCredentialsSchema.safeParse({ username: 'keeper', password: '12345678' }).success).toBe(false);
    expect(adminCredentialsSchema.safeParse({ username: 'keeper', password: ' '.repeat(20) }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: 'keeper', password: 'a'.repeat(73) }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: 'keeper', password: 'é'.repeat(37) }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ username: 'keeper', password: 'é'.repeat(36) }).success).toBe(true);
  });

  it('normalizes optional values and keeps the color allowlist', () => {
    const result = createPrayerSchema.safeParse({
      title: '  ',
      message: '  A prayer  ',
      categoryId: '00000000-0000-0000-0000-000000000001',
      moodId: '00000000-0000-0000-0000-000000000002',
      color: 'sky',
      isAnonymous: true,
      displayName: 'Secret',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeNull();
      expect(result.data.displayName).toBe('Secret');
    }
    expect(colorKeys).toContain('lavender');
  });
});
