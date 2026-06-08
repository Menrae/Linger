import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Event, EventDetail, Profile } from '../types';

function parseWKBHex(hex: string): { lat: number; lng: number } | null {
  if (hex.length < 50) return null;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const lng = view.getFloat64(9, true);
  const lat = view.getFloat64(17, true);
  return { lat, lng };
}

function extractLatLng(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw === 'string' && (raw.startsWith('0101000020') || raw.startsWith('0101000000'))) {
    return parseWKBHex(raw);
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.coordinates) && r.coordinates.length >= 2) {
      return { lng: r.coordinates[0] as number, lat: r.coordinates[1] as number };
    }
  }
  if (typeof raw === 'string') {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
        return { lng: obj.coordinates[0] as number, lat: obj.coordinates[1] as number };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: EventDetail };

export function useEventDetail(eventId: string | null, userId: string | null) {
  const [state, setState] = useState<DetailState>({ status: 'idle' });
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const [eventResult, attendeeResult] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventId).single(),
          userId
            ? supabase
                .from('event_attendees')
                .select('event_id')
                .eq('event_id', eventId)
                .eq('user_id', userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelled) return;
        if (eventResult.error) throw new Error(eventResult.error.message);

        const row = eventResult.data as Record<string, unknown>;
        const coords = extractLatLng(row.location);
        const event: Event = {
          ...(row as unknown as Event),
          location: coords ?? { lat: 0, lng: 0 },
        };

        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name, created_at')
          .eq('id', event.host_id)
          .maybeSingle();

        if (cancelled) return;

        setState({
          status: 'ready',
          detail: {
            ...event,
            host: profileData as Profile | null,
            is_attending: !!attendeeResult.data,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load event',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, userId, retryTick]);

  const retry = useCallback(() => setRetryTick((n) => n + 1), []);

  const rsvp = useCallback(async () => {
    if (state.status !== 'ready') return;
    const id = state.detail.id;
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      return {
        status: 'ready',
        detail: { ...prev.detail, is_attending: true, attendee_count: prev.detail.attendee_count + 1 },
      };
    });
    const { error } = await supabase.rpc('rsvp_event', { p_event_id: id });
    if (error) {
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        return {
          status: 'ready',
          detail: { ...prev.detail, is_attending: false, attendee_count: Math.max(prev.detail.attendee_count - 1, 0) },
        };
      });
    }
  }, [state]);

  const cancelRsvp = useCallback(async () => {
    if (state.status !== 'ready') return;
    const id = state.detail.id;
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      return {
        status: 'ready',
        detail: { ...prev.detail, is_attending: false, attendee_count: Math.max(prev.detail.attendee_count - 1, 0) },
      };
    });
    const { error } = await supabase.rpc('cancel_rsvp', { p_event_id: id });
    if (error) {
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        return {
          status: 'ready',
          detail: { ...prev.detail, is_attending: true, attendee_count: prev.detail.attendee_count + 1 },
        };
      });
    }
  }, [state]);

  return { state, retry, rsvp, cancelRsvp };
}
