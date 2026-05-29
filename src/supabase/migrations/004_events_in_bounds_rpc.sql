CREATE OR REPLACE FUNCTION events_in_bounds(
  min_lat FLOAT, min_lng FLOAT,
  max_lat FLOAT, max_lng FLOAT
)
RETURNS SETOF events AS $$
  SELECT * FROM events
  WHERE ST_Within(
    location::geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  AND is_public = true
  AND starts_at > now() - interval '2 hours';
$$ LANGUAGE sql STABLE;
