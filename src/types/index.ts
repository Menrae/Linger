export type AuthUser = import('@supabase/supabase-js').User;

export type EventTag =
  | 'Outdoors'
  | 'Arts & Culture'
  | 'Food & Drink'
  | 'Sports & Fitness'
  | 'Learning'
  | 'Social'
  | 'Wellness'
  | 'Family'
  | 'Causes'
  | 'Other';

export const TAG_COLORS: Record<EventTag, string> = {
  'Outdoors': '#22C55E',
  'Arts & Culture': '#EC4899',
  'Food & Drink': '#F97316',
  'Sports & Fitness': '#3B82F6',
  'Learning': '#8B5CF6',
  'Social': '#EAB308',
  'Wellness': '#06B6D4',
  'Family': '#F43F5E',
  'Causes': '#14B8A6',
  'Other': '#6B7280',
};

export const ALL_TAGS = Object.keys(TAG_COLORS) as EventTag[];

export interface GeocodeSuggestion {
  label: string;
  lng: number;
  lat: number;
}

export interface EventFormData {
  address: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  capacity: string;
  tags: string[];
  affiliation: string;
  is_public: boolean;
}

export interface Event {
  id: string;
  created_at: string;
  host_id: string;
  title: string;
  description: string | null;
  location: { lat: number; lng: number };
  address: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  tags: string[];
  affiliation: string | null;
  is_public: boolean;
  attendee_count: number;
}

export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}
