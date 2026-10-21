-- Applied as a hand-written migration right after the first `prisma migrate dev`.
-- Prisma cannot model geography columns, so they live here and are queried with $queryRaw.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE engineer_locations ADD COLUMN point geography(Point, 4326);
UPDATE engineer_locations SET point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;
ALTER TABLE engineer_locations ALTER COLUMN point SET NOT NULL;
CREATE INDEX engineer_locations_point_gist ON engineer_locations USING GIST (point);

ALTER TABLE request_locations ADD COLUMN point geography(Point, 4326);
UPDATE request_locations SET point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;
ALTER TABLE request_locations ALTER COLUMN point SET NOT NULL;
CREATE INDEX request_locations_point_gist ON request_locations USING GIST (point);

-- Keep lat/lng and point in sync (single writer: the application sets lat/lng, trigger derives point).
CREATE OR REPLACE FUNCTION tf_sync_point() RETURNS trigger AS $$
BEGIN
  NEW.point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER engineer_locations_point BEFORE INSERT OR UPDATE OF latitude, longitude
  ON engineer_locations FOR EACH ROW EXECUTE FUNCTION tf_sync_point();
CREATE TRIGGER request_locations_point BEFORE INSERT OR UPDATE OF latitude, longitude
  ON request_locations FOR EACH ROW EXECUTE FUNCTION tf_sync_point();

-- Integrity checks that Prisma cannot express.
ALTER TABLE reviews        ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE availabilities ADD CONSTRAINT availabilities_dow   CHECK (day_of_week BETWEEN 0 AND 6);
ALTER TABLE quote_items    ADD CONSTRAINT quote_items_positive CHECK (quantity > 0 AND unit_price >= 0);
ALTER TABLE payments       ADD CONSTRAINT payments_amount_pos  CHECK (amount > 0);

-- At most ONE open (DRAFT/SENT) quote of each kind per request: no two competing prices.
CREATE UNIQUE INDEX quotes_one_open_per_kind
  ON quotes (request_id, kind) WHERE status IN ('DRAFT', 'SENT');

-- One ACCEPTED main quote per request.
CREATE UNIQUE INDEX quotes_one_accepted_main
  ON quotes (request_id) WHERE kind = 'MAIN' AND status = 'ACCEPTED';

-- Matching query (see docs/06): engineers within radius of the request point.
--   SELECT ep.id, ST_Distance(el.point, rl.point)/1000 AS km
--   FROM engineer_locations el
--   JOIN engineer_profiles ep ON ep.id = el.engineer_id
--   JOIN request_locations rl ON rl.request_id = $1
--   WHERE el.is_primary AND ST_DWithin(el.point, rl.point, ep.service_radius_km * 1000);

-- Payments (phase 4): at most ONE pending online payment per job — a second one could charge twice.
CREATE UNIQUE INDEX payments_one_pending_online
  ON payments (job_id) WHERE method = 'ONLINE' AND status = 'PENDING';
