import { useRef, useCallback } from 'react';
import Map, { NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useMapBounds } from '../../hooks/useMapBounds';
import { useEvents } from '../../hooks/useEvents';
import { useCluster } from '../../hooks/useCluster';
import { useMapStore } from '../../store/mapStore';
import { EventPin } from './EventPin';
import { EventCluster } from './EventCluster';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const { lat, lng, zoom, loading } = useUserLocation();
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);

  const { bounds, onMoveEnd: boundsOnMoveEnd } = useMapBounds(mapRef);
  const { events, recentEventIds } = useEvents(bounds);
  const { clusters } = useCluster(events, bounds, viewport.zoom);

  const onMoveEnd = useCallback(() => {
    boundsOnMoveEnd();
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setViewport({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  }, [boundsOnMoveEnd, setViewport]);

  const onLoad = useCallback(() => {
    boundsOnMoveEnd();
  }, [boundsOnMoveEnd]);

  if (loading) return null;

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: lat, longitude: lng, zoom }}
      style={{ width: '100%', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
    >
      <NavigationControl position="top-right" />
      <GeolocateControl position="top-right" trackUserLocation={false} />

      {clusters.map((item) => {
        const [longitude, latitude] = item.geometry.coordinates;
        if (item.properties.cluster) {
          return (
            <EventCluster
              key={`cluster-${item.id}`}
              clusterId={item.id as number}
              longitude={longitude}
              latitude={latitude}
              pointCount={item.properties.point_count}
              mapRef={mapRef}
            />
          );
        }
        return (
          <EventPin
            key={`pin-${item.properties.id}`}
            event={item.properties}
            isNew={recentEventIds.has(item.properties.id)}
          />
        );
      })}
    </Map>
  );
}
