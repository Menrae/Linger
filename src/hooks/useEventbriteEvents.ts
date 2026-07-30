import { useEffect, useState, useRef } from 'react';
import type { Event, EventTag, MapBounds } from '../types';

const TOKEN = import.meta.env.VITE_EVENTBRITE_TOKEN as string | undefined;
const BASE = 'https://www.eventbriteapi.com/v3';

const CATEGORY_TAG: Record<string, EventTag> = {
  '103': 'Arts & Culture',  // Music
  '105': 'Food & Drink',
  '106': 'Social',          // Community & Culture
  '107': 'Arts & Culture',  // Performing & Visual Arts
  '108': 'Arts & Culture',  // Film, Media & Entertainment
  '109': 'Sports & Fitness',
  '110': 'Outdoors',        // Travel & Outdoor
  '115': 'Family',          // Family & Education
  '119': 'Wellness',
  '121': 'Social',          // Hobbies & Special Interest
};

interface EbAddress {
  localized_address_display?: string;
}
interface EbVenue {
  latitude?: string;
  longitude?: string;
  name?: string;
  address?: EbAddress;
}
interface EbEvent {
  id: string;
  created: string;
  name: { text: string };
  description?: { text?: string };
  start: { utc: string };
  end?: { utc: string };
  capacity?: number;
  category_id?: string;
  url: string;
  venue?: EbVenue;
}

function toEvent(raw: EbEvent): Event | null {
  const venue = raw.venue;
  if (!venue?.latitude || !venue?.longitude) return null;
  const lat = parseFloat(venue.latitude);
  const lng = parseFloat(venue.longitude);
  if (isNaN(lat) || isNaN(lng)) return null;
  return {
    id: `eb-${raw.id}`,
    created_at: raw.created,
    host_id: 'eventbrite',
    title: raw.name.text.slice(0, 120),
    description: raw.description?.text?.slice(0, 2000) ?? null,
    location: { lat, lng },
    address: venue.address?.localized_address_display ?? venue.name ?? '',
    starts_at: raw.start.utc,
    ends_at: raw.end?.utc ?? null,
    capacity: raw.capacity ?? null,
    tags: [CATEGORY_TAG[raw.category_id ?? ''] ?? 'Other'],
    affiliation: null,
    is_public: true,
    attendee_count: 0,
    source: 'eventbrite',
    url: raw.url,
  };
}

export function useEventbriteEvents(bounds: MapBounds | null): Event[] {
  const [events, setEvents] = useState<Event[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!TOKEN || !bounds) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    let cancelled = false;

    timerRef.current = setTimeout(() => {
      const { minLat, minLng, maxLat, maxLng } = bounds;
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      // Approx degrees-to-km conversion; cap at 50km to avoid huge responses
      const radiusKm = Math.min(Math.ceil(Math.abs(maxLat - minLat) * 55.6), 50);

      const params = new URLSearchParams({
        'location.latitude': String(centerLat),
        'location.longitude': String(centerLng),
        'location.within': `${radiusKm}km`,
        'expand': 'venue',
        'sort_by': 'date',
        'start_date.range_start': new Date().toISOString().split('.')[0] + 'Z',
      });

      fetch(`${BASE}/events/search/?${params}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
        .then((r) => r.json())
        .then((data: { events?: EbEvent[] }) => {
          if (cancelled) return;
          setEvents(
            (data.events ?? []).map(toEvent).filter((e): e is Event => e !== null),
          );
        })
        .catch(() => { if (!cancelled) setEvents([]); });
    }, 1000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bounds?.minLat, bounds?.minLng, bounds?.maxLat, bounds?.maxLng]); // eslint-disable-line react-hooks/exhaustive-deps

  return events;
}
