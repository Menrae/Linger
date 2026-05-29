import { useRef, useCallback } from 'react';
import Map, { NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useMapStore } from '../../store/mapStore';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const { lat, lng, zoom, loading } = useUserLocation();
  const setViewport = useMapStore((s) => s.setViewport);

  const onMoveEnd = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setViewport({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  }, [setViewport]);

  if (loading) return null;

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: lat, longitude: lng, zoom }}
      style={{ width: '100%', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onMoveEnd={onMoveEnd}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl position="top-right" trackUserLocation={false} />
    </Map>
  );
}
