import { describe, expect, it } from 'vitest';
import { adminPinSchema, createPrayerSchema, colorKeys } from './index.js';

describe('contracts', () => {
  it('accepts only the configured PIN shape', () => {
    expect(adminPinSchema.safeParse('12345678').success).toBe(true);
    expect(adminPinSchema.safeParse('1234').success).toBe(false);
    expect(adminPinSchema.safeParse('1234567a').success).toBe(false);
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
