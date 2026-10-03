-- Upgrade an existing CloudSent v3 Supabase database. Does not delete prayer records.
-- Run this once in Supabase SQL Editor, then run npm run admin:bootstrap locally.
BEGIN;
SET LOCAL search_path = public, extensions;
-- Password login upgrade: preserve IDs, prayer revisions and the retired PIN hash.
-- Re-running this block does not sign out newly configured password accounts.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS username VARCHAR(50) NOT NULL DEFAULT 'administrator';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE admins ALTER COLUMN pin_hash DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '004_admin_password_login') THEN
    UPDATE admins SET session_version = session_version + 1, failed_attempts = 0, next_attempt_at = NULL;
    INSERT INTO schema_migrations(version) VALUES ('004_admin_password_login');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_login_result(p_admin_id UUID, p_success BOOLEAN, p_session_version INTEGER)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE current admins%ROWTYPE; failures INTEGER;
BEGIN
  SELECT * INTO current FROM admins WHERE admin_id = p_admin_id FOR UPDATE;
  IF NOT FOUND OR current.password_hash IS NULL OR current.session_version <> p_session_version OR current.next_attempt_at > now() THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_success THEN
    UPDATE admins SET failed_attempts = 0, next_attempt_at = NULL WHERE admin_id = p_admin_id;
    RETURN jsonb_build_object('ok', true, 'adminId', p_admin_id, 'sessionVersion', current.session_version);
  END IF;
  failures := current.failed_attempts + 1;
  UPDATE admins SET failed_attempts = failures, next_attempt_at = now() + least(300000, 1000 * power(2, least(failures, 9))) * interval '1 millisecond' WHERE admin_id = p_admin_id;
  RETURN jsonb_build_object('ok', false);
END;
$$;


-- Retire the PIN entry points. Browser roles cannot execute the new provisioning function.
DROP FUNCTION IF EXISTS cloudsent_change_pin(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS cloudsent_bootstrap_admin(TEXT);
CREATE OR REPLACE FUNCTION cloudsent_bootstrap_admin(p_username TEXT, p_hash TEXT) RETURNS VOID
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF p_username IS NULL OR lower(trim(p_username)) !~ '^[a-z0-9._-]{3,50}$' THEN
    RAISE EXCEPTION 'A valid administrator username is required';
  END IF;
  IF p_hash IS NULL OR p_hash !~ '^\$2[aby]\$(1[2-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'A bcrypt password hash with cost 12 or higher is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('cloudsent:bootstrap-admin'));
  INSERT INTO admins(username, password_hash) VALUES (lower(trim(p_username)), p_hash)
  ON CONFLICT ((true)) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash,
    session_version = admins.session_version + 1, failed_attempts = 0, next_attempt_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_health() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT jsonb_build_object('status', 'ok', 'schemaVersion', 4);
$$;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE admins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admins TO service_role;
REVOKE ALL ON FUNCTION cloudsent_bootstrap_admin(TEXT, TEXT), cloudsent_login_result(UUID, BOOLEAN, INTEGER), cloudsent_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cloudsent_bootstrap_admin(TEXT, TEXT), cloudsent_login_result(UUID, BOOLEAN, INTEGER), cloudsent_health() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
