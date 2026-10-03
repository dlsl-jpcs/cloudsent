import { rpc } from '../db/supabase.js';

const result = await rpc<{ status: string; schemaVersion: number }>('cloudsent_health');
if (result.schemaVersion !== 3) throw new Error('Run supabase/setup.sql in the Supabase SQL Editor.');
console.log('Supabase connection and CloudSent database setup are ready.');
