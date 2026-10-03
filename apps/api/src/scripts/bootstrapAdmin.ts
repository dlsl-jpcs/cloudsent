import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { rpc } from '../db/supabase.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
try {
  const pin = await rl.question('Enter the 8–12 digit CloudSent admin PIN (input may be visible in some terminals): ');
  if (!/^\d{8,12}$/.test(pin)) throw new Error('PIN must contain 8–12 digits');
  const hash = await bcrypt.hash(`${pin}${config.PIN_PEPPER}`, 12);
  await rpc('cloudsent_bootstrap_admin', { p_hash: hash });
  console.log('Administrator PIN hash stored.');
} finally { rl.close(); }
