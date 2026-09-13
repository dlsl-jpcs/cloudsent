import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PIN_PEPPER: z.string().min(16),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_ORIGIN: z.string().url().default('http://localhost:4000'),
});

export const config = configSchema.parse(process.env);
