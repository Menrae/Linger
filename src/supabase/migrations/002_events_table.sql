CREATE TABLE public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 120),
  description     TEXT CHECK (char_length(description) <= 2000),
  location        GEOGRAPHY(POINT, 4326) NOT NULL,
  address         TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  capacity        INTEGER CHECK (capacity > 0),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  affiliation     TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  attendee_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX events_location_gist ON public.events USING GIST (location);
CREATE INDEX events_starts_at_idx ON public.events (starts_at);
