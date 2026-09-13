import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
try {
  const pin = await rl.question('Enter the 8–12 digit CloudSent admin PIN (input may be visible in some terminals): ');
  if (!/^\d{8,12}$/.test(pin)) throw new Error('PIN must contain 8–12 digits');
  const hash = await bcrypt.hash(`${pin}${config.PIN_PEPPER}`, 12);
  await pool.query(`INSERT INTO admins(pin_hash) VALUES ($1) ON CONFLICT DO UPDATE SET pin_hash = EXCLUDED.pin_hash, session_version = admins.session_version + 1, failed_attempts = 0, next_attempt_at = NULL`, [hash]);
  console.log('Administrator PIN hash stored.');
} finally { rl.close(); await pool.end(); }
