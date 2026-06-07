import { useRef, useCallback, useState } from 'react';
import Map, { NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useMapBounds } from '../../hooks/useMapBounds';
import { useEvents } from '../../hooks/useEvents';
import { useCluster } from '../../hooks/useCluster';
import { useMapStore } from '../../store/mapStore';
import { useAuthStore } from '../../store/authStore';
import { EventPin } from './EventPin';
import { EventCluster } from './EventCluster';
import { AuthModal } from '../ui/AuthModal';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const { lat, lng, zoom, loading } = useUserLocation();
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
    <>
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

      <div className="absolute top-36 right-2 z-10 flex flex-col items-end gap-1">
        {user ? (
          <>
            <span className="text-white text-xs bg-black/50 rounded px-2 py-1 max-w-[160px] truncate">
              {user.email && user.email.length > 20
                ? `${user.email.slice(0, 20)}…`
                : user.email}
            </span>
            <button
              onClick={() => void signOut()}
              className="text-white text-xs bg-black/50 hover:bg-black/70 rounded px-2 py-1 transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="text-white text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5 font-medium transition-colors shadow-lg"
          >
            Sign in to host
          </button>
        )}
      </div>

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

    {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </>
  );
}
