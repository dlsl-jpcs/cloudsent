import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { expect, it } from 'vitest';

it('upgrades PIN-only databases without losing records and never accepts a PIN as a password', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA extensions;
      CREATE TABLE admins (
        admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(50) NOT NULL DEFAULT 'administrator',
        pin_hash VARCHAR(255) NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
        failed_attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX admins_singleton_uq ON admins ((true));
      CREATE TABLE schema_migrations(version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());
      INSERT INTO schema_migrations(version) VALUES ('003_supabase_server');
      INSERT INTO admins(pin_hash) VALUES ('retired-test-pin-hash');
      CREATE TABLE migration_test_revisions(admin_id UUID REFERENCES admins(admin_id), message TEXT);
      INSERT INTO migration_test_revisions SELECT admin_id, 'Preserve this revision' FROM admins;
      CREATE FUNCTION cloudsent_bootstrap_admin(TEXT) RETURNS VOID LANGUAGE sql AS 'SELECT';
      CREATE FUNCTION cloudsent_change_pin(UUID, TEXT, INTEGER) RETURNS JSONB LANGUAGE sql AS 'SELECT ''{}''::jsonb';
    `);
    const id = (await db.query<{ admin_id: string }>('SELECT admin_id FROM admins')).rows[0].admin_id;
    const migration = await readFile(new URL('../../../supabase/migrations/004_admin_password_login.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const legacy = (await db.query<any>('SELECT * FROM admins')).rows[0];
    expect(legacy.admin_id).toBe(id); expect(legacy.pin_hash).toBe('retired-test-pin-hash');
    expect(legacy.password_hash).toBeNull(); expect(legacy.session_version).toBe(2);
    const denied = await db.query<{ result: { ok: boolean } }>('SELECT cloudsent_login_result($1, true, 2) AS result', [id]);
    expect(denied.rows[0].result.ok).toBe(false);
    expect((await db.query('SELECT * FROM migration_test_revisions')).rows).toHaveLength(1);
    expect((await db.query("SELECT to_regprocedure('cloudsent_bootstrap_admin(text)') AS old_bootstrap, to_regprocedure('cloudsent_change_pin(uuid,text,integer)') AS old_pin")).rows[0]).toEqual({ old_bootstrap: null, old_pin: null });
    await expect(db.query('SELECT cloudsent_bootstrap_admin($1,$2)', ['keeper', 'plaintext-must-not-be-accepted'])).rejects.toThrow('bcrypt');
    const hash = await bcrypt.hash('test-only-strong-password-for-migration', 12);
    await db.query('SELECT cloudsent_bootstrap_admin($1,$2)', ['  Keeper.Test  ', hash]);
    await db.exec(migration);
    const account = (await db.query<any>('SELECT * FROM admins')).rows[0];
    expect(account.admin_id).toBe(id); expect(account.username).toBe('keeper.test'); expect(account.password_hash).toBe(hash);
    expect(account.session_version).toBe(3); expect((await db.query('SELECT * FROM migration_test_revisions')).rows).toHaveLength(1);
    const roles = await db.query("SELECT has_table_privilege('anon','admins','SELECT') AS anon_table, has_function_privilege('anon','cloudsent_bootstrap_admin(text,text)','EXECUTE') AS anon_setup, has_function_privilege('authenticated','cloudsent_bootstrap_admin(text,text)','EXECUTE') AS user_setup");
    expect(roles.rows[0]).toEqual({ anon_table: false, anon_setup: false, user_setup: false });
  } finally { await db.close(); }
}, 30000);
