import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Vercel's environment takes precedence over local files.
dotenv.config({ path: ['.env.local', '.env', fileURLToPath(new URL('../.env', import.meta.url))], quiet: true });

export const config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
  JWT_SECRET: z.string().min(32),
  PIN_PEPPER: z.string().min(16),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:5173'),
}).parse(process.env);
