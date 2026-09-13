ALTER TABLE prayers ADD COLUMN IF NOT EXISTS originally_anonymous BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE prayers SET originally_anonymous = is_anonymous WHERE originally_anonymous IS DISTINCT FROM is_anonymous;
