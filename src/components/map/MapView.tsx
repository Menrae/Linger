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
import { useFilterStore } from '../../store/filterStore';
import { EventPin } from './EventPin';
import { EventCluster } from './EventCluster';
import { AuthModal } from '../ui/AuthModal';
import { FilterPill } from '../ui/FilterPill';
import { FilterTray } from '../ui/FilterTray';
import { CreateEventModal } from '../events/CreateEventModal';
import { EventDrawer } from '../events/EventDrawer';
import { ProfilePanel } from '../profile/ProfilePanel';
import { showToast } from '../ui/Toast';
import type { Event, EventFormData } from '../../types';

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
  const setSelectedEvent = useMapStore((s) => s.setSelectedEvent);
  const editingEvent = useMapStore((s) => s.editingEvent);
  const setEditingEvent = useMapStore((s) => s.setEditingEvent);
  const user = useAuthStore((s) => s.user);
  const displayName = useAuthStore((s) => s.displayName);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const clearAll = useFilterStore((s) => s.clearAll);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);

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
  const { events, loading: eventsLoading, error: eventsError, retry, recentEventIds, addOptimisticEvent, replaceOptimisticEvent, removeOptimisticEvent } =
    useEvents(bounds);

  // Client-side filtering — no extra network calls on filter change.
  // filteredEvents → clustered normally (full opacity).
  // dimmedEvents → rendered as individual pins at 25% opacity, never clustered.
  const { filteredEvents, dimmedEvents } = useFilteredEvents(events);
  const { clusters } = useCluster(filteredEvents, bounds, viewport.zoom);

  // True empty state: fetched, no events in viewport at all
  const showEmptyState =
    events.length === 0 && !eventsLoading && bounds !== null && !placementMode;

  // Filter empty state: events exist but all filtered out
  const showFilterEmpty = filteredEvents.length === 0 && events.length > 0;

  // Toast on fetch error
  useEffect(() => {
    if (eventsError) {
      showToast("Couldn't load events", { label: 'Retry', onClick: retry });
    }
  }, [eventsError, retry]);

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
      if (placementMode) {
        setPendingLocation([e.lngLat.lng, e.lngLat.lat]);
      } else {
        setSelectedEvent(null);
      }
    },
    [placementMode, setPendingLocation, setSelectedEvent],
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

  const handleEditFailure = useCallback(
    (formData: EventFormData, location: [number, number], originalEvent: Event) => {
      restoredSubmission.current = {
        formData,
        location,
        error: 'Failed to save changes. Your edits are preserved — please try again.',
      };
      setEditingEvent(originalEvent);
      setPendingLocation(location);
      enterPlacementMode();
    },
    [setEditingEvent, setPendingLocation, enterPlacementMode],
  );

  const profileLabel = (() => {
    const name = displayName ?? user?.email ?? '';
    return name.length > 16 ? `${name.slice(0, 16)}…` : name;
  })();

  const initial = (displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none text-center max-w-[calc(100vw-2rem)]">
            Tap the map to place your event
          </div>
        )}

        {/* Auth / Host controls — offset from top to account for safe area */}
        <div
          className="absolute right-2 z-10 flex flex-col items-end gap-1"
          style={{ top: 'calc(9rem + env(safe-area-inset-top))' }}
        >
          {user ? (
            <>
              {/* Profile chip */}
              <button
                onClick={() => setProfilePanelOpen(true)}
                className="flex items-center gap-2 bg-black/50 hover:bg-black/70 rounded-full pl-1 pr-3 py-1 transition-colors min-h-[44px]"
                aria-label="Open profile"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 select-none">
                    {initial}
                  </div>
                )}
                <span className="text-white text-xs max-w-[120px] truncate">{profileLabel}</span>
              </button>

              <button
                onClick={handleHostButton}
                className={`text-white text-sm rounded-lg px-3 py-1.5 font-medium transition-colors duration-150 shadow-lg min-h-[44px] ${
                  placementMode
                    ? 'bg-gray-600 hover:bg-gray-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {placementMode ? 'Cancel' : 'Host Event'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-white text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5 font-medium transition-colors duration-150 shadow-lg min-h-[44px]"
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

        {/* Sonar ping empty state — shown when viewport has no events */}
        {showEmptyState && (
          <Marker longitude={lng} latitude={lat} anchor="center">
            <div className="sonar-container">
              <div className="sonar-ring" />
              <div className="sonar-ring" />
              <div className="sonar-ring" />
              <div className="sonar-core" />
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

      {/* "No matches" pill — filters active but nothing passes */}
      {showFilterEmpty && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[42] flex items-center gap-1.5 bg-gray-900/95 backdrop-blur-sm text-white/70 text-xs px-3.5 py-2 rounded-full shadow-lg whitespace-nowrap transition-opacity duration-150"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          No matches ·{' '}
          <button
            onClick={clearAll}
            className="text-indigo-400 hover:text-indigo-300 transition-colors duration-150 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Invitation card — true empty state, below FilterPill */}
      {showEmptyState && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[42] w-[calc(100%-2rem)] max-w-xs"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-2xl shadow-black/50 text-center">
            <h3 className="text-white text-base font-semibold mb-1">No events nearby yet</h3>
            <p className="text-white/50 text-sm mb-4">
              {user
                ? 'Linger is just getting started here.'
                : 'Sign in to host the first event'}
            </p>
            <button
              onClick={user ? handleHostButton : () => setAuthModalOpen(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors duration-150"
            >
              {user ? 'Host the first event →' : 'Sign in →'}
            </button>
          </div>
        </div>
      )}

      {/* Filter pill — sits above map, below modals (z-40) */}
      <FilterPill onClick={() => setTrayOpen(true)} />
      <FilterTray isOpen={trayOpen} onClose={() => setTrayOpen(false)} />

      {/* Event detail drawer — always in DOM, slides up when selectedEventId is set */}
      <EventDrawer />

      {/* Profile panel — slides in from left */}
      <ProfilePanel
        isOpen={profilePanelOpen}
        onClose={() => setProfilePanelOpen(false)}
        removeEventFromCache={removeOptimisticEvent}
      />

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}

      {pendingLocation && (
        <CreateEventModal
          onFlyTo={flyTo}
          initialValues={restoredSubmission.current?.formData}
          initialEvent={editingEvent ?? undefined}
          submitError={restoredSubmission.current?.error}
          addOptimisticEvent={addOptimisticEvent}
          replaceOptimisticEvent={replaceOptimisticEvent}
          removeOptimisticEvent={removeOptimisticEvent}
          onSubmitFailure={handleSubmitFailure}
          onEditFailure={handleEditFailure}
        />
      )}
    </>
  );
}
