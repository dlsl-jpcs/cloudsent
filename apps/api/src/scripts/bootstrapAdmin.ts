import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { adminCredentialsSchema } from '@cloudsent/contracts';
import { rpc } from '../db/supabase.js';

function hiddenPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Run this command in an interactive terminal so your password can be hidden.');
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;
    readline.emitKeypressEvents(process.stdin);
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.removeListener('keypress', keypress);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const keypress = (text: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Administrator setup cancelled.')); return; }
      if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(value); return; }
      if (key.name === 'backspace') {
        if (value) { value = Array.from(value).slice(0, -1).join(''); process.stdout.write('\b \b'); }
        return;
      }
      if (text && !key.ctrl && !key.meta && !text.includes('\u001b')) {
        const printable = text.replace(/[\x00-\x1f\x7f]/g, '');
        value += printable;
        process.stdout.write('*'.repeat(Array.from(printable).length));
      }
    };
    process.stdin.on('keypress', keypress);
  });
}

try {
  if (!process.stdin.isTTY) throw new Error('Run admin:bootstrap in an interactive terminal.');
  const health = await rpc<{ schemaVersion: number }>('cloudsent_health');
  if (health.schemaVersion !== 4) throw new Error('First run supabase/setup.sql or the 004 admin-password migration in the Supabase SQL Editor.');
  console.log('This sets or replaces the single administrator account in the configured Supabase project and signs out existing admin sessions.');
  let rl = createInterface({ input: process.stdin, output: process.stdout });
  const username = await rl.question('Admin username (3–50 letters/numbers, dots, underscores or hyphens): ');
  rl.close();
  const password = await hiddenPassword('Admin password (at least 15 characters; input is hidden): ');
  const confirmation = await hiddenPassword('Repeat the password: ');
  if (password !== confirmation) throw new Error('Passwords did not match. Nothing was saved.');
  const parsed = adminCredentialsSchema.safeParse({ username, password });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  rl = createInterface({ input: process.stdin, output: process.stdout });
  const save = await rl.question('Save these credentials to Supabase? Type yes to continue: ');
  rl.close();
  if (save.trim().toLowerCase() !== 'yes') throw new Error('Administrator setup cancelled. Nothing was saved.');
  const hash = await bcrypt.hash(parsed.data.password, 12);
  await rpc('cloudsent_bootstrap_admin', { p_username: parsed.data.username, p_hash: hash });
  console.log('Administrator username and password hash stored. Sign in at /secretlang.');
} catch (error) {
  // Do not print request bodies, hashes, passwords or Supabase connection details.
  console.error(error instanceof Error ? error.message : 'Administrator setup failed.');
  process.exitCode = 1;
}
