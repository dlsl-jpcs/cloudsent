-- Run the entire file in the Supabase SQL Editor. Safe to rerun: existing rows and PIN hashes remain.
-- The website uses CloudSent's Vercel API; only its server secret key can access these tables/functions.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
SET LOCAL search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_uq ON categories (lower(name));

CREATE TABLE IF NOT EXISTS moods (
  mood_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  color_hint VARCHAR(20),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS moods_name_lower_uq ON moods (lower(name));

CREATE TABLE IF NOT EXISTS admins (
  admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL DEFAULT 'administrator',
  pin_hash VARCHAR(255) NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admins_singleton_uq ON admins ((true));

CREATE TABLE IF NOT EXISTS prayers (
  prayer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150),
  message TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
  mood_id UUID NOT NULL REFERENCES moods(mood_id) ON DELETE RESTRICT,
  color VARCHAR(20) NOT NULL CHECK (color IN ('sky','lavender','gold','rose','sage','cloud')),
  display_name VARCHAR(100),
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  originally_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  moderation_priority INTEGER NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_from_status VARCHAR(20),
  version INTEGER NOT NULL DEFAULT 1,
  submission_key UUID,
  duplicate_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prayer_anonymity_ck CHECK ((is_anonymous AND display_name IS NULL) OR (NOT is_anonymous AND display_name IS NOT NULL AND length(trim(display_name)) > 0)),
  CONSTRAINT prayer_deleted_status_ck CHECK (deleted_at IS NULL OR deleted_from_status IN ('pending','approved','rejected'))
);
CREATE UNIQUE INDEX IF NOT EXISTS prayers_submission_key_uq ON prayers(submission_key) WHERE submission_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS prayers_public_order_idx ON prayers(approved_at DESC, prayer_id) WHERE status = 'approved' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prayers_filter_idx ON prayers(status, category_id, mood_id, color, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prayers_text_trgm_idx ON prayers USING gin ((lower(coalesce(title,'') || ' ' || message)) gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prayers_name_trgm_idx ON prayers USING gin (lower(coalesce(display_name,'')) gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS moderation_flags (
  flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id UUID NOT NULL REFERENCES prayers(prayer_id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  detail VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS moderation_flags_open_idx ON moderation_flags(prayer_id) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id UUID NOT NULL REFERENCES prayers(prayer_id) ON DELETE CASCADE,
  device_hash CHAR(64) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_action VARCHAR(20),
  resolution_note VARCHAR(500)
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_open_device_uq ON reports(prayer_id, device_hash) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS reports_open_idx ON reports(resolved_at, created_at DESC);

CREATE TABLE IF NOT EXISTS prayer_revisions (
  revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id UUID NOT NULL REFERENCES prayers(prayer_id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(admin_id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key CHAR(64) NOT NULL,
  bucket_name VARCHAR(40) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket_key, bucket_name, window_start)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER categories_touch_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE OR REPLACE TRIGGER moods_touch_updated_at BEFORE UPDATE ON moods FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE OR REPLACE TRIGGER admins_touch_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE OR REPLACE TRIGGER prayers_touch_updated_at BEFORE UPDATE ON prayers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO categories(name, description, position) VALUES
  ('Prayer Intention', 'A prayer for a person, need, or hope.', 0),
  ('Thanksgiving', 'A note of gratitude.', 1),
  ('Reflection', 'A quiet thought or spiritual reflection.', 2),
  ('Encouragement', 'Words of strength for someone else.', 3),
  ('Memorial Prayer', 'A prayer remembering someone or something.', 4)
ON CONFLICT DO NOTHING;
INSERT INTO moods(name, color_hint, position) VALUES
  ('Hopeful', 'sky', 0),
  ('Grateful', 'gold', 1),
  ('Sorrowful', 'lavender', 2)
ON CONFLICT DO NOTHING;

-- Upgrade older databases without undoing an administrator's anonymity edits.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prayers' AND column_name = 'originally_anonymous') THEN
    ALTER TABLE public.prayers ADD COLUMN originally_anonymous BOOLEAN NOT NULL DEFAULT TRUE;
    UPDATE public.prayers SET originally_anonymous = is_anonymous;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_health() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT jsonb_build_object('status', 'ok', 'schemaVersion', 3);
$$;

-- Domain functions keep related writes atomic over Supabase's HTTPS connection.
-- They are callable only by service_role; they never accept arbitrary SQL.
CREATE OR REPLACE FUNCTION cloudsent_list_prayers(p_filters JSONB DEFAULT '{}', p_admin BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
    SELECT p.*, c.name category_name, c.position category_position, m.name mood_name, m.position mood_position
    FROM prayers p JOIN categories c ON c.category_id = p.category_id JOIN moods m ON m.mood_id = p.mood_id
    WHERE (p_admin OR (p.status = 'approved' AND p.deleted_at IS NULL))
      AND (NOT p_admin OR p_filters->>'status' IS NULL OR p.status = p_filters->>'status')
      AND (p_filters->>'id' IS NULL OR p.prayer_id = (p_filters->>'id')::uuid)
      AND (p_filters->>'q' IS NULL OR p.title ILIKE '%' || (p_filters->>'q') || '%' OR p.message ILIKE '%' || (p_filters->>'q') || '%' OR (p_admin AND p.display_name ILIKE '%' || (p_filters->>'q') || '%'))
      AND (p_filters->>'category' IS NULL OR p.category_id = (p_filters->>'category')::uuid)
      AND (p_filters->>'mood' IS NULL OR p.mood_id = (p_filters->>'mood')::uuid)
      AND (p_filters->>'color' IS NULL OR p.color = p_filters->>'color')
      AND (p_filters->>'displayName' IS NULL OR (NOT p.is_anonymous AND p.display_name ILIKE '%' || (p_filters->>'displayName') || '%'))
      AND (p_filters->>'from' IS NULL OR p.created_at >= ((p_filters->>'from')::date::timestamp AT TIME ZONE 'Asia/Manila'))
      AND (p_filters->>'to' IS NULL OR p.created_at < (((p_filters->>'to')::date + 1)::timestamp AT TIME ZONE 'Asia/Manila'))
      AND (p_filters->>'cursorApprovedAt' IS NULL OR (p.approved_at, p.prayer_id) < ((p_filters->>'cursorApprovedAt')::timestamptz, (p_filters->>'cursorId')::uuid))
    ORDER BY CASE WHEN p_admin THEN p.created_at ELSE p.approved_at END DESC, p.prayer_id DESC
    LIMIT least(greatest(coalesce((p_filters->>'limit')::integer, 24), 1), CASE WHEN p_admin THEN 100 ELSE 49 END)
  ) r;
$$;

CREATE OR REPLACE FUNCTION cloudsent_submit_prayer(p_input JSONB, p_submission_key UUID, p_hash TEXT, p_flags JSONB DEFAULT '[]')
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE prayer UUID; flag JSONB; anonymous BOOLEAN := coalesce((p_input->>'isAnonymous')::boolean, true);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cloudsent:submission:' || p_hash));
  IF EXISTS (SELECT 1 FROM prayers WHERE submission_key = p_submission_key) THEN RETURN jsonb_build_object('ok', true); END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE category_id = (p_input->>'categoryId')::uuid AND active)
     OR NOT EXISTS (SELECT 1 FROM moods WHERE mood_id = (p_input->>'moodId')::uuid AND active) THEN
    RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'TAXONOMY_INACTIVE', 'message', 'Please choose an available category and mood.');
  END IF;
  INSERT INTO prayers(title, message, category_id, mood_id, color, display_name, is_anonymous, originally_anonymous, submission_key, duplicate_hash)
  VALUES (p_input->>'title', p_input->>'message', (p_input->>'categoryId')::uuid, (p_input->>'moodId')::uuid, p_input->>'color', CASE WHEN anonymous THEN NULL ELSE p_input->>'displayName' END, anonymous, anonymous, p_submission_key, p_hash)
  ON CONFLICT DO NOTHING RETURNING prayer_id INTO prayer;
  IF prayer IS NULL THEN RETURN jsonb_build_object('ok', true); END IF;
  IF EXISTS (SELECT 1 FROM prayers WHERE duplicate_hash = p_hash AND prayer_id <> prayer AND created_at >= now() - interval '24 hours') THEN
    INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES (prayer, 'duplicate', 'Matching normalized message within 24 hours');
  END IF;
  FOR flag IN SELECT value FROM jsonb_array_elements(p_flags) LOOP
    INSERT INTO moderation_flags(prayer_id, flag_type, detail) VALUES (prayer, flag->>'type', flag->>'detail');
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_report_prayer(p_id UUID, p_hash TEXT, p_reason TEXT) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  PERFORM 1 FROM prayers WHERE prayer_id = p_id AND status = 'approved' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'NOT_FOUND', 'message', 'Prayer not found.'); END IF;
  INSERT INTO reports(prayer_id, device_hash, reason) VALUES (p_id, p_hash, p_reason) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_prayer_action(p_id UUID, p_action TEXT, p_input JSONB, p_admin_id UUID) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE current prayers%ROWTYPE; anonymous BOOLEAN; name TEXT;
BEGIN
  SELECT * INTO current FROM prayers WHERE prayer_id = p_id FOR UPDATE;
  IF NOT FOUND OR (p_action IN ('restore', 'purge') AND current.deleted_at IS NULL)
     OR (p_action NOT IN ('restore', 'purge') AND current.deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'NOT_FOUND', 'message', 'Prayer not found.');
  END IF;
  IF p_action IN ('edit', 'status') AND current.version <> (p_input->>'expectedVersion')::integer THEN
    RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'CONFLICT', 'message', 'This prayer changed in another tab. Refresh and try again.');
  END IF;
  IF p_action = 'edit' THEN
    anonymous := coalesce((p_input->>'isAnonymous')::boolean, current.is_anonymous);
    IF current.originally_anonymous AND NOT anonymous THEN
      RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'ORIGINAL_ANONYMITY_LOCKED', 'message', 'An originally anonymous prayer cannot be assigned a display name.');
    END IF;
    name := CASE WHEN anonymous THEN NULL WHEN p_input ? 'displayName' THEN p_input->>'displayName' ELSE current.display_name END;
    IF NOT anonymous AND coalesce(length(trim(name)), 0) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'DISPLAY_NAME_REQUIRED', 'message', 'A named prayer needs a display name.');
    END IF;
    INSERT INTO prayer_revisions(prayer_id, admin_id, action, snapshot) VALUES (p_id, p_admin_id, 'edit', to_jsonb(current));
    UPDATE prayers SET title = CASE WHEN p_input ? 'title' THEN p_input->>'title' ELSE current.title END,
      message = coalesce(p_input->>'message', current.message), category_id = coalesce((p_input->>'categoryId')::uuid, current.category_id),
      mood_id = coalesce((p_input->>'moodId')::uuid, current.mood_id), color = coalesce(p_input->>'color', current.color),
      is_anonymous = anonymous, display_name = name, version = version + 1 WHERE prayer_id = p_id;
  ELSIF p_action = 'status' THEN
    UPDATE prayers SET status = p_input->>'status', approved_at = CASE WHEN p_input->>'status' = 'approved' THEN coalesce(approved_at, now()) ELSE approved_at END, version = version + 1 WHERE prayer_id = p_id;
  ELSIF p_action = 'delete' THEN
    UPDATE prayers SET deleted_at = now(), deleted_from_status = status, version = version + 1 WHERE prayer_id = p_id;
  ELSIF p_action = 'restore' THEN
    UPDATE prayers SET deleted_at = NULL, status = coalesce(deleted_from_status, 'rejected'), deleted_from_status = NULL, version = version + 1 WHERE prayer_id = p_id;
  ELSIF p_action = 'purge' THEN
    DELETE FROM prayers WHERE prayer_id = p_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'INVALID_ACTION', 'message', 'That action is not available.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_reports() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
    SELECT p.prayer_id, p.title, p.message, p.status, count(r.report_id)::int report_count, max(r.created_at) last_report_at,
      jsonb_agg(jsonb_build_object('id', r.report_id, 'reason', r.reason, 'createdAt', r.created_at) ORDER BY r.created_at DESC) reports
    FROM prayers p JOIN reports r ON r.prayer_id = p.prayer_id WHERE r.resolved_at IS NULL
    GROUP BY p.prayer_id ORDER BY last_report_at DESC
  ) r;
$$;

CREATE OR REPLACE FUNCTION cloudsent_resolve_report(p_id UUID, p_action TEXT, p_note TEXT) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF p_action NOT IN ('dismiss', 'edit', 'reject', 'delete') THEN RETURN jsonb_build_object('ok', false, 'status', 422, 'code', 'INVALID_ACTION'); END IF;
  PERFORM 1 FROM prayers WHERE prayer_id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'NOT_FOUND', 'message', 'Prayer not found.'); END IF;
  IF p_action = 'delete' THEN UPDATE prayers SET deleted_at = now(), deleted_from_status = status, version = version + 1 WHERE prayer_id = p_id AND deleted_at IS NULL;
  ELSIF p_action = 'reject' THEN UPDATE prayers SET status = 'rejected', version = version + 1 WHERE prayer_id = p_id AND deleted_at IS NULL; END IF;
  UPDATE reports SET resolved_at = now(), resolved_action = p_action, resolution_note = p_note WHERE prayer_id = p_id AND resolved_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_taxonomy_write(p_kind TEXT, p_id UUID, p_input JSONB) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE item JSONB; remaining INTEGER;
BEGIN
  IF p_kind NOT IN ('categories', 'moods') THEN RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'NOT_FOUND'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('cloudsent:taxonomy:' || p_kind));
  IF p_id IS NOT NULL THEN
    IF p_kind = 'categories' THEN SELECT to_jsonb(c) INTO item FROM categories c WHERE category_id = p_id FOR UPDATE;
    ELSE SELECT to_jsonb(m) INTO item FROM moods m WHERE mood_id = p_id FOR UPDATE; END IF;
    IF item IS NULL THEN RETURN jsonb_build_object('ok', false, 'status', 404, 'code', 'NOT_FOUND', 'message', 'Taxonomy entry not found.'); END IF;
    IF p_input->>'active' = 'false' THEN
      IF p_kind = 'categories' THEN SELECT count(*) INTO remaining FROM categories WHERE active AND category_id <> p_id;
      ELSE SELECT count(*) INTO remaining FROM moods WHERE active AND mood_id <> p_id; END IF;
      IF remaining < 1 THEN RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'LAST_ACTIVE_TAXONOMY', 'message', 'Keep at least one active taxonomy entry.'); END IF;
    END IF;
  END IF;
  IF p_kind = 'categories' THEN
    IF p_id IS NULL THEN
      INSERT INTO categories(name, description, position) VALUES (p_input->>'name', p_input->>'description', (SELECT coalesce(max(position), -1) + 1 FROM categories)) RETURNING to_jsonb(categories.*) INTO item;
    ELSE
      UPDATE categories SET name = coalesce(p_input->>'name', name), active = coalesce((p_input->>'active')::boolean, active), position = coalesce((p_input->>'position')::integer, position)
      WHERE category_id = p_id RETURNING to_jsonb(categories.*) INTO item;
    END IF;
    item := item || jsonb_build_object('id', item->>'category_id');
  ELSE
    IF p_id IS NULL THEN
      INSERT INTO moods(name, color_hint, position) VALUES (p_input->>'name', p_input->>'colorHint', (SELECT coalesce(max(position), -1) + 1 FROM moods)) RETURNING to_jsonb(moods.*) INTO item;
    ELSE
      UPDATE moods SET name = coalesce(p_input->>'name', name), active = coalesce((p_input->>'active')::boolean, active), position = coalesce((p_input->>'position')::integer, position)
      WHERE mood_id = p_id RETURNING to_jsonb(moods.*) INTO item;
    END IF;
    item := item || jsonb_build_object('id', item->>'mood_id');
  END IF;
  RETURN jsonb_build_object('ok', true, 'data', item);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_export() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
    SELECT p.prayer_id, p.title, p.message, p.status, p.color, p.is_anonymous,
      CASE WHEN p.is_anonymous THEN NULL ELSE p.display_name END display_name, c.name category, m.name mood,
      p.created_at, p.approved_at, count(r.report_id)::int report_count
    FROM prayers p JOIN categories c ON c.category_id = p.category_id JOIN moods m ON m.mood_id = p.mood_id
    LEFT JOIN reports r ON r.prayer_id = p.prayer_id WHERE p.deleted_at IS NULL
    GROUP BY p.prayer_id, c.name, m.name ORDER BY p.created_at DESC
  ) r;
$$;

CREATE OR REPLACE FUNCTION cloudsent_stats() RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT jsonb_build_object(
    'totals', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT status, count(*)::int count FROM prayers WHERE deleted_at IS NULL GROUP BY status) t),
    'categories', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT c.name, count(p.prayer_id)::int count FROM categories c LEFT JOIN prayers p ON p.category_id = c.category_id AND p.deleted_at IS NULL GROUP BY c.category_id ORDER BY c.position) t),
    'moods', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT m.name, count(p.prayer_id)::int count FROM moods m LEFT JOIN prayers p ON p.mood_id = m.mood_id AND p.deleted_at IS NULL GROUP BY m.mood_id ORDER BY m.position) t),
    'trend', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Manila')::date bucket_date, count(*)::int count FROM prayers WHERE deleted_at IS NULL AND created_at >= now() - interval '90 days' GROUP BY bucket_date ORDER BY bucket_date) t),
    'unresolvedReportCases', (SELECT count(DISTINCT prayer_id)::int FROM reports WHERE resolved_at IS NULL),
    'flags', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT flag_type, count(*)::int count FROM moderation_flags WHERE resolved_at IS NULL GROUP BY flag_type) t)
  );
$$;

CREATE OR REPLACE FUNCTION cloudsent_rate_limit(p_key TEXT, p_bucket TEXT, p_window_start TIMESTAMPTZ, p_since TIMESTAMPTZ DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE attempts INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cloudsent:rate:' || p_key || ':' || p_bucket));
  DELETE FROM rate_limit_buckets WHERE bucket_key = p_key AND bucket_name = p_bucket AND window_start < now() - interval '2 days';
  INSERT INTO rate_limit_buckets(bucket_key, bucket_name, window_start, count) VALUES (p_key, p_bucket, p_window_start, 1)
  ON CONFLICT (bucket_key, bucket_name, window_start) DO UPDATE SET count = rate_limit_buckets.count + 1 RETURNING count INTO attempts;
  IF p_since IS NOT NULL THEN SELECT coalesce(sum(count), 0)::int INTO attempts FROM rate_limit_buckets WHERE bucket_key = p_key AND bucket_name = p_bucket AND window_start >= p_since; END IF;
  RETURN attempts;
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_login_result(p_admin_id UUID, p_success BOOLEAN, p_session_version INTEGER)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE current admins%ROWTYPE; failures INTEGER;
BEGIN
  SELECT * INTO current FROM admins WHERE admin_id = p_admin_id FOR UPDATE;
  IF NOT FOUND OR current.session_version <> p_session_version OR current.next_attempt_at > now() THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_success THEN
    UPDATE admins SET failed_attempts = 0, next_attempt_at = NULL WHERE admin_id = p_admin_id;
    RETURN jsonb_build_object('ok', true, 'adminId', p_admin_id, 'sessionVersion', current.session_version);
  END IF;
  failures := current.failed_attempts + 1;
  UPDATE admins SET failed_attempts = failures, next_attempt_at = now() + least(300000, 1000 * power(2, least(failures, 9))) * interval '1 millisecond' WHERE admin_id = p_admin_id;
  RETURN jsonb_build_object('ok', false);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_change_pin(p_id UUID, p_hash TEXT, p_session_version INTEGER) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  UPDATE admins SET pin_hash = p_hash, session_version = session_version + 1, failed_attempts = 0, next_attempt_at = NULL WHERE admin_id = p_id AND session_version = p_session_version;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'status', 409, 'code', 'CONFLICT', 'message', 'The administrator session changed. Sign in again.'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_bootstrap_admin(p_hash TEXT) RETURNS VOID
LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cloudsent:bootstrap-admin'));
  INSERT INTO admins(pin_hash) VALUES (p_hash) ON CONFLICT ((true)) DO UPDATE SET pin_hash = EXCLUDED.pin_hash,
    session_version = admins.session_version + 1, failed_attempts = 0, next_attempt_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION cloudsent_seed_demo(p_prayers JSONB) RETURNS INTEGER
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE item JSONB; category UUID; mood UUID; inserted INTEGER := 0; added INTEGER;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(p_prayers) LOOP
    SELECT category_id INTO category FROM categories WHERE name = item->>'category';
    SELECT mood_id INTO mood FROM moods WHERE name = item->>'mood';
    IF category IS NULL OR mood IS NULL THEN RAISE EXCEPTION 'The demo category or mood is missing'; END IF;
    INSERT INTO prayers(title, message, category_id, mood_id, color, display_name, is_anonymous, originally_anonymous, status, approved_at, submission_key, duplicate_hash, created_at)
    VALUES (item->>'title', item->>'message', category, mood, item->>'color', CASE WHEN (item->>'anonymous')::boolean THEN NULL ELSE item->>'displayName' END,
      (item->>'anonymous')::boolean, (item->>'anonymous')::boolean, 'approved', (item->>'createdAt')::timestamptz, (item->>'key')::uuid, item->>'hash', (item->>'createdAt')::timestamptz)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS added = ROW_COUNT; inserted := inserted + added;
  END LOOP;
  RETURN inserted;
END;
$$;

-- RLS blocks browser access. The server's secret key uses service_role.
-- Grant that role explicitly, including on projects whose previous SQL revoked it.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE categories, moods, admins, prayers, moderation_flags, reports, prayer_revisions, rate_limit_buckets, schema_migrations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE categories, moods, admins, prayers, moderation_flags, reports, prayer_revisions, rate_limit_buckets, schema_migrations TO service_role;
DO $$
DECLARE routine RECORD;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND left(p.proname, 10) = 'cloudsent_' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', routine.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', routine.signature);
  END LOOP;
END;
$$;
GRANT USAGE ON SCHEMA public, extensions TO service_role;
INSERT INTO schema_migrations(version) VALUES ('003_supabase_server') ON CONFLICT DO NOTHING;
NOTIFY pgrst, 'reload schema';
COMMIT;
