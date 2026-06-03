import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Event, MapBounds } from '../types';

function parseWKBHex(hex: string): { lat: number; lng: number } | null {
  if (hex.length < 50) return null;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const lng = view.getFloat64(9, true); // little-endian
  const lat = view.getFloat64(17, true);
  return { lat, lng };
}

function extractLatLng(raw: unknown): { lat: number; lng: number } | null {
  // Case 1: WKB hex string — PostgREST's actual wire format for GEOGRAPHY columns
  if (typeof raw === 'string' && (raw.startsWith('0101000020') || raw.startsWith('0101000000'))) {
    return parseWKBHex(raw);
  }
  // Case 2: already a parsed GeoJSON object
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.coordinates) && r.coordinates.length >= 2) {
      return { lng: r.coordinates[0] as number, lat: r.coordinates[1] as number };
    }
  }
  // Case 3: JSON string of a GeoJSON object
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

function isInBounds(lat: number, lng: number, bounds: MapBounds): boolean {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

export function useEvents(bounds: MapBounds | null) {
  const cache = useRef(new Map<string, Event>());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const boundsRef = useRef<MapBounds | null>(null);

  const mergeAndCommit = useCallback((incoming: Event[]) => {
    const prevCache = cache.current;
    const currentBounds = boundsRef.current;

    if (currentBounds && prevCache.size > 0) {
      const prevInNew = [...prevCache.values()].filter((e) =>
        isInBounds(e.location.lat, e.location.lng, currentBounds),
      );
      const overlapRatio = prevInNew.length / prevCache.size;
      if (overlapRatio < 0.2) {
        prevCache.clear();
      }
    }

    for (const e of incoming) {
      prevCache.set(e.id, e);
    }
    setEvents([...prevCache.values()]);
  }, []);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    if (!bounds) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc('events_in_bounds', {
        min_lat: bounds.minLat,
        min_lng: bounds.minLng,
        max_lat: bounds.maxLat,
        max_lng: bounds.maxLng,
      })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          setError(new Error(rpcError.message));
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const parsed: Event[] = rows.map((row) => {
          const coords = extractLatLng(row.location);
          return {
            ...(row as unknown as Event),
            location: coords ?? { lat: 0, lng: 0 },
          };
        });
        mergeAndCommit(parsed);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bounds]); // mergeAndCommit is stable (empty deps, reads boundsRef)

  useEffect(() => {
    const channel = supabase
      .channel('public:events:insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const coords = extractLatLng(row.location);
          if (!coords) return;
          const currentBounds = boundsRef.current;
          if (currentBounds && !isInBounds(coords.lat, coords.lng, currentBounds)) return;
          const event: Event = {
            ...(row as unknown as Event),
            location: coords,
          };
          cache.current.set(event.id, event);
          setEvents([...cache.current.values()]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { events, loading, error };
}
