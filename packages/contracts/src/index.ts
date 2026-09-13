import { z } from 'zod';

export const prayerCategories = [
  'Prayer Intention',
  'Thanksgiving',
  'Reflection',
  'Encouragement',
  'Memorial Prayer',
] as const;

export const prayerMoods = ['Hopeful', 'Grateful', 'Sorrowful'] as const;
export const colorKeys = ['sky', 'lavender', 'gold', 'rose', 'sage', 'cloud'] as const;
export const prayerStatuses = ['pending', 'approved', 'rejected'] as const;

export type PrayerCategory = (typeof prayerCategories)[number];
export type PrayerMood = (typeof prayerMoods)[number];
export type ColorKey = (typeof colorKeys)[number];
export type PrayerStatus = (typeof prayerStatuses)[number];

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

export const createPrayerSchema = z.object({
  title: z.string().trim().max(150).optional().transform((value) => value || null),
  message: trimmedString(2000),
  categoryId: z.string().uuid(),
  moodId: z.string().uuid(),
  color: z.enum(colorKeys),
  isAnonymous: z.boolean().default(true),
  displayName: z.string().trim().max(100).optional().transform((value) => value || null),
});
export type CreatePrayerInput = z.infer<typeof createPrayerSchema>;

export const prayerQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  q: z.string().trim().max(100).optional(),
  category: z.string().uuid().optional(),
  mood: z.string().uuid().optional(),
  color: z.enum(colorKeys).optional(),
  displayName: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.to < value.from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End date must be on or after start date.' });
});
export type PrayerQuery = z.infer<typeof prayerQuerySchema>;

export const reportSchema = z.object({ reason: trimmedString(255) });
export type ReportInput = z.infer<typeof reportSchema>;

export const adminPinSchema = z.string().regex(/^\d{8,12}$/, 'PIN must contain 8–12 digits');
export const adminLoginSchema = z.object({ pin: adminPinSchema });
export const changePinSchema = z.object({ currentPin: adminPinSchema, newPin: adminPinSchema });

export const adminPrayerPatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().max(150).nullable().optional(),
  message: trimmedString(2000).optional(),
  categoryId: z.string().uuid().optional(),
  moodId: z.string().uuid().optional(),
  color: z.enum(colorKeys).optional(),
  isAnonymous: z.boolean().optional(),
  displayName: z.string().trim().max(100).nullable().optional(),
});
export const statusSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(prayerStatuses),
});
export const resolveReportSchema = z.object({
  action: z.enum(['dismiss', 'edit', 'reject', 'delete']),
  note: z.string().trim().max(500).optional(),
});

export interface TaxonomyItem {
  id: string;
  name: string;
  active: boolean;
  position: number;
}

export interface PublicPrayer {
  id: string;
  title: string | null;
  message: string;
  excerpt: string;
  category: TaxonomyItem;
  mood: TaxonomyItem;
  color: ColorKey;
  displayName: string | null;
  isAnonymous: boolean;
  createdAt: string;
  approvedAt: string;
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string>; requestId?: string };
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}
