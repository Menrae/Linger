CREATE TABLE public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rsvp_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendees_select" ON public.event_attendees
  FOR SELECT USING (true);

CREATE POLICY "attendees_insert" ON public.event_attendees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attendees_delete" ON public.event_attendees
  FOR DELETE USING (auth.uid() = user_id);

-- Atomically insert attendee row and increment counter
CREATE OR REPLACE FUNCTION public.rsvp_event(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.event_attendees (event_id, user_id)
  VALUES (p_event_id, auth.uid());

  UPDATE public.events
  SET attendee_count = attendee_count + 1
  WHERE id = p_event_id;
END;
$$;

-- Atomically remove attendee row and decrement counter
CREATE OR REPLACE FUNCTION public.cancel_rsvp(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.event_attendees
  WHERE event_id = p_event_id AND user_id = auth.uid();

  UPDATE public.events
  SET attendee_count = GREATEST(attendee_count - 1, 0)
  WHERE id = p_event_id;
END;
$$;
