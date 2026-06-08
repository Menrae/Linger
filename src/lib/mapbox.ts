import type { GeocodeSuggestion } from '../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export async function geocodeAddress(query: string): Promise<GeocodeSuggestion[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=address,place,poi`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{ place_name: string; center: [number, number] }>;
    };
    return (data.features ?? []).map((f) => ({
      label: f.place_name,
      lng: f.center[0],
      lat: f.center[1],
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lng: number, lat: number): Promise<string> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = (await res.json()) as {
      features?: Array<{ place_name: string }>;
    };
    return data.features?.[0]?.place_name ?? '';
  } catch {
    return '';
  }
}
