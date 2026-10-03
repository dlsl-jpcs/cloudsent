import { rpc } from '../db/supabase.js';

const result = await rpc<{ status: string; schemaVersion: number }>('cloudsent_health');
if (result.schemaVersion !== 4) throw new Error('Run supabase/setup.sql or the 004 admin-password migration in the Supabase SQL Editor.');
console.log('Supabase connection and CloudSent database setup are ready.');
