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
