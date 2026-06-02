ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read public events
CREATE POLICY "public_events_readable_by_all"
  ON public.events
  FOR SELECT
  USING (is_public = true);

-- Authenticated users can insert their own events
CREATE POLICY "authenticated_users_can_insert"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Hosts can update and delete their own events
CREATE POLICY "hosts_can_update_own_events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "hosts_can_delete_own_events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);
