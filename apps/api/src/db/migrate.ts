import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const migrationDirectories = [
    path.join(here, 'migrations'),
    path.join(process.cwd(), 'src/db/migrations'),
    path.join(process.cwd(), 'apps/api/src/db/migrations'),
  ];
  let directory = migrationDirectories[0];
  for (const candidate of migrationDirectories) { try { await fs.access(candidate); directory = candidate; break; } catch { /* try next location */ } }
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  await withTransaction(async (client) => {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cloudsent:migrations']);
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const found = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
      if (found.rowCount) continue;
      await client.query(await fs.readFile(path.join(directory, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
      console.log(`Applied ${version}`);
    }
  });
}

if (process.argv[1]?.includes('migrate')) runMigrations().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
