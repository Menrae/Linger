import { useRef, useCallback, useState, useEffect } from 'react';
import Map, { NavigationControl, GeolocateControl, Marker } from 'react-map-gl/mapbox';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useMapBounds } from '../../hooks/useMapBounds';
import { useEvents } from '../../hooks/useEvents';
import { useCluster } from '../../hooks/useCluster';
import { useFilteredEvents } from '../../hooks/useFilteredEvents';
import { useMapStore } from '../../store/mapStore';
import { useAuthStore } from '../../store/authStore';
import { EventPin } from './EventPin';
import { EventCluster } from './EventCluster';
import { AuthModal } from '../ui/AuthModal';
import { FilterPill } from '../ui/FilterPill';
import { FilterTray } from '../ui/FilterTray';
import { CreateEventModal } from '../events/CreateEventModal';
import type { EventFormData } from '../../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

export function MapView() {
  const mapRef = useRef<MapRef>(null);
  const { lat, lng, zoom, loading } = useUserLocation();
  const viewport = useMapStore((s) => s.viewport);
  const setViewport = useMapStore((s) => s.setViewport);
  const placementMode = useMapStore((s) => s.placementMode);
  const pendingLocation = useMapStore((s) => s.pendingLocation);
  const enterPlacementMode = useMapStore((s) => s.enterPlacementMode);
  const exitPlacementMode = useMapStore((s) => s.exitPlacementMode);
  const setPendingLocation = useMapStore((s) => s.setPendingLocation);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  // useRef instead of useState: Zustand's useSyncExternalStore flushes a
  // re-render synchronously when setPendingLocation fires, before React can
  // commit a pending setRestoredSubmission call. The ref is written first,
  // so it's already populated when the modal's first render reads it.
  const restoredSubmission = useRef<{
    formData: EventFormData;
    location: [number, number];
    error: string;
  } | null>(null);

  const { bounds, onMoveEnd: boundsOnMoveEnd } = useMapBounds(mapRef);
  const { events, recentEventIds, addOptimisticEvent, replaceOptimisticEvent, removeOptimisticEvent } =
    useEvents(bounds);

  // Client-side filtering — no extra network calls on filter change.
  // filteredEvents → clustered normally (full opacity).
  // dimmedEvents → rendered as individual pins at 25% opacity, never clustered.
  const { filteredEvents, dimmedEvents } = useFilteredEvents(events);
  const { clusters } = useCluster(filteredEvents, bounds, viewport.zoom);

  // Sync crosshair cursor with placement mode
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = placementMode ? 'crosshair' : '';
  }, [placementMode]);

  // Clear restored submission data when the modal is closed
  useEffect(() => {
    if (!pendingLocation) restoredSubmission.current = null;
  }, [pendingLocation]);

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

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!placementMode) return;
      setPendingLocation([e.lngLat.lng, e.lngLat.lat]);
    },
    [placementMode, setPendingLocation],
  );

  const flyTo = useCallback((lngVal: number, latVal: number) => {
    mapRef.current?.flyTo({ center: [lngVal, latVal], zoom: 14, duration: 1000 });
  }, []);

  const handleHostButton = useCallback(() => {
    if (placementMode) {
      exitPlacementMode();
    } else {
      enterPlacementMode();
    }
  }, [placementMode, enterPlacementMode, exitPlacementMode]);

  const handleSubmitFailure = useCallback(
    (formData: EventFormData, location: [number, number]) => {
      // Write to ref before Zustand calls so the value is present when
      // setPendingLocation's synchronous re-render mounts the modal.
      restoredSubmission.current = {
        formData,
        location,
        error: 'Failed to save event. Your changes are preserved — please try again.',
      };
      setPendingLocation(location);
      enterPlacementMode();
    },
    [setPendingLocation, enterPlacementMode],
  );

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
        onClick={onMapClick}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" trackUserLocation={false} />

        {/* Placement mode instruction banner */}
        {placementMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
            Click anywhere on the map to place your event — or search by address below
          </div>
        )}

        {/* Auth / Host controls */}
        <div className="absolute top-36 right-2 z-10 flex flex-col items-end gap-1">
          {user ? (
            <>
              <span className="text-white text-xs bg-black/50 rounded px-2 py-1 max-w-[160px] truncate">
                {user.email && user.email.length > 20 ? `${user.email.slice(0, 20)}…` : user.email}
              </span>
              <button
                onClick={handleHostButton}
                className={`text-white text-sm rounded-lg px-3 py-1.5 font-medium transition-colors shadow-lg ${
                  placementMode
                    ? 'bg-gray-600 hover:bg-gray-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {placementMode ? 'Cancel' : 'Host Event'}
              </button>
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

        {/* Pulsing placement marker */}
        {pendingLocation && (
          <Marker longitude={pendingLocation[0]} latitude={pendingLocation[1]} anchor="center">
            <div className="pending-marker">
              <div className="pending-marker-ring" />
              <div className="pending-marker-core" />
            </div>
          </Marker>
        )}

        {/* Dimmed pins — rendered first (underneath) so active pins sit on top.
            They never cluster: only filteredEvents go through useCluster. */}
        {dimmedEvents.map((event) => (
          <EventPin key={`dim-${event.id}`} event={event} isDimmed />
        ))}

        {/* Active clusters and individual pins */}
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

      {/* Filter pill — sits above map, below modals (z-40) */}
      <FilterPill onClick={() => setTrayOpen(true)} />
      <FilterTray isOpen={trayOpen} onClose={() => setTrayOpen(false)} />

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}

      {pendingLocation && (
        <CreateEventModal
          onFlyTo={flyTo}
          initialValues={restoredSubmission.current?.formData}
          submitError={restoredSubmission.current?.error}
          addOptimisticEvent={addOptimisticEvent}
          replaceOptimisticEvent={replaceOptimisticEvent}
          removeOptimisticEvent={removeOptimisticEvent}
          onSubmitFailure={handleSubmitFailure}
        />
      )}
    </>
  );
}
