import { useState, useCallback, useRef, useEffect } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { MapBounds } from '../types';

export function useMapBounds(mapRef: React.RefObject<MapRef | null>) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onMoveEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      const b = map.getBounds();
      if (!b) return;
      setBounds({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      });
    }, 300);
  }, [mapRef]);

  return { bounds, onMoveEnd };
}
