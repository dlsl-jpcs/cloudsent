import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Server only. CloudSent manages its own admin login sessions, not Supabase user sessions.
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
});

export function checkError(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  checkError(error);
  return data as T;
}

export interface MutationResult { ok: boolean; code?: string; message?: string; status?: number; }
