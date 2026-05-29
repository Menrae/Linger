import { create } from 'zustand';

interface Viewport {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapState {
  viewport: Viewport;
  selectedEventId: string | null;
  placementMode: boolean;
  pendingLocation: [number, number] | null; // [lng, lat]

  setViewport: (viewport: Viewport) => void;
  setSelectedEvent: (id: string | null) => void;
  enterPlacementMode: () => void;
  exitPlacementMode: () => void;
  setPendingLocation: (coords: [number, number] | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { lat: 39.8283, lng: -98.5795, zoom: 4 },
  selectedEventId: null,
  placementMode: false,
  pendingLocation: null,

  setViewport: (viewport) => set({ viewport }),
  setSelectedEvent: (id) => set({ selectedEventId: id }),
  enterPlacementMode: () => set({ placementMode: true }),
  exitPlacementMode: () => set({ placementMode: false, pendingLocation: null }),
  setPendingLocation: (coords) => set({ pendingLocation: coords }),
}));
