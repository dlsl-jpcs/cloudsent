CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
DROP TRIGGER IF EXISTS categories_touch_updated_at ON categories;
CREATE TRIGGER categories_touch_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS moods_touch_updated_at ON moods;
CREATE TRIGGER moods_touch_updated_at BEFORE UPDATE ON moods FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS admins_touch_updated_at ON admins;
CREATE TRIGGER admins_touch_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS prayers_touch_updated_at ON prayers;
CREATE TRIGGER prayers_touch_updated_at BEFORE UPDATE ON prayers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

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
