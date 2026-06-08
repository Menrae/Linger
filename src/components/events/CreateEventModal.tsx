import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Map, { Marker } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { z } from 'zod';
import { useMapStore } from '../../store/mapStore';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { geocodeAddress, reverseGeocode } from '../../lib/mapbox';
import { TAG_COLORS, ALL_TAGS } from '../../types';
import type { Event, EventFormData, GeocodeSuggestion } from '../../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const eventSchema = z.object({
  address: z.string().min(1, { message: 'Address is required' }),
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(120, { message: 'Title must be at most 120 characters' }),
  description: z.string().max(2000, { message: 'Description must be at most 2000 characters' }),
  starts_at: z
    .string()
    .min(1, { message: 'Start time is required' })
    .refine((v) => new Date(v) > new Date(), { message: 'Start time must be in the future' }),
  ends_at: z.string(),
  capacity: z.string(),
  tags: z
    .array(z.string())
    .min(1, { message: 'Select at least one tag' })
    .max(5, { message: 'Select at most 5 tags' }),
  affiliation: z.string(),
  is_public: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.ends_at && data.starts_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
    ctx.addIssue({
      code: 'custom',
      message: 'End time must be after start time',
      path: ['ends_at'],
    });
  }
  if (data.capacity && isNaN(parseInt(data.capacity, 10))) {
    ctx.addIssue({
      code: 'custom',
      message: 'Capacity must be a whole number',
      path: ['capacity'],
    });
  }
  if (data.capacity && parseInt(data.capacity, 10) < 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'Capacity must be at least 1',
      path: ['capacity'],
    });
  }
});

interface Props {
  // flyTo is passed as a callback instead of mapRef so the modal doesn't need
  // to know about the react-map-gl MapRef type or the main map's internal state.
  onFlyTo: (lng: number, lat: number) => void;
  initialValues?: EventFormData | null;
  submitError?: string | null;
  addOptimisticEvent: (event: Event) => void;
  replaceOptimisticEvent: (tempId: string, event: Event) => void;
  removeOptimisticEvent: (id: string) => void;
  onSubmitFailure: (formData: EventFormData, location: [number, number]) => void;
}

const EMPTY_FORM: EventFormData = {
  address: '',
  title: '',
  description: '',
  starts_at: '',
  ends_at: '',
  capacity: '',
  tags: [],
  affiliation: '',
  is_public: true,
};

export function CreateEventModal({
  onFlyTo,
  initialValues,
  submitError,
  addOptimisticEvent,
  replaceOptimisticEvent,
  removeOptimisticEvent,
  onSubmitFailure,
}: Props) {
  const pendingLocation = useMapStore((s) => s.pendingLocation);
  const setPendingLocation = useMapStore((s) => s.setPendingLocation);
  const exitPlacementMode = useMapStore((s) => s.exitPlacementMode);
  const user = useAuthStore((s) => s.user);

  const init = initialValues ?? EMPTY_FORM;
  const [address, setAddress] = useState(init.address);
  const [title, setTitle] = useState(init.title);
  const [description, setDescription] = useState(init.description);
  const [starts_at, setStartsAt] = useState(init.starts_at);
  const [ends_at, setEndsAt] = useState(init.ends_at);
  const [capacity, setCapacity] = useState(init.capacity);
  const [tags, setTags] = useState<string[]>(init.tags);
  const [affiliation, setAffiliation] = useState(init.affiliation);
  const [is_public, setIsPublic] = useState(init.is_public);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(submitError ?? null);

  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const miniMapRef = useRef<MapRef>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reverse-geocode the tapped location on first mount if no address was provided
  useEffect(() => {
    if (address || !pendingLocation) return;
    reverseGeocode(pendingLocation[0], pendingLocation[1]).then((result) => {
      if (result) setAddress(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // Fly the mini map whenever the pinned location changes (tap or autocomplete)
  useEffect(() => {
    if (!pendingLocation) return;
    miniMapRef.current?.flyTo({
      center: [pendingLocation[0], pendingLocation[1]],
      zoom: 14,
      duration: 500,
    });
  }, [pendingLocation]);

  // Escape key closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitPlacementMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exitPlacementMode]);

  // Show any externally-provided submit error as the banner
  useEffect(() => {
    if (submitError) setBannerError(submitError);
  }, [submitError]);

  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    geocodeTimer.current = setTimeout(() => {
      void geocodeAddress(value).then((results) => {
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      });
    }, 400);
  }, []);

  const handleSelectSuggestion = useCallback(
    (suggestion: GeocodeSuggestion) => {
      setAddress(suggestion.label);
      setSuggestions([]);
      setShowSuggestions(false);
      setPendingLocation([suggestion.lng, suggestion.lat]);
      onFlyTo(suggestion.lng, suggestion.lat);
    },
    [setPendingLocation, onFlyTo],
  );

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBannerError(null);
    setFieldErrors({});

    const formData: EventFormData = {
      address,
      title,
      description,
      starts_at,
      ends_at,
      capacity,
      tags,
      affiliation,
      is_public,
    };

    const result = eventSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    const location = pendingLocation;
    if (!location || !user) return;

    const tempId = crypto.randomUUID();

    const optimisticEvent: Event = {
      id: tempId,
      created_at: new Date().toISOString(),
      host_id: user.id,
      title,
      description: description || null,
      location: { lng: location[0], lat: location[1] },
      address,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: ends_at ? new Date(ends_at).toISOString() : null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      tags,
      affiliation: affiliation || null,
      is_public,
      attendee_count: 0,
    };

    addOptimisticEvent(optimisticEvent);
    // Close immediately — async insert continues in the background after unmount.
    // The callback props (addOptimisticEvent, replaceOptimisticEvent, removeOptimisticEvent,
    // onSubmitFailure) are stable MapView functions; calling them post-unmount is safe.
    exitPlacementMode();

    void (async () => {
      try {
        const { data, error: insertError } = await supabase
          .from('events')
          .insert({
            host_id: user.id,
            title,
            description: description || null,
            location: `SRID=4326;POINT(${location[0]} ${location[1]})`,
            address,
            starts_at: new Date(starts_at).toISOString(),
            ends_at: ends_at ? new Date(ends_at).toISOString() : null,
            capacity: capacity ? parseInt(capacity, 10) : null,
            tags,
            affiliation: affiliation || null,
            is_public,
          })
          .select()
          .single();

        if (insertError || !data) {
          removeOptimisticEvent(tempId);
          onSubmitFailure(formData, location);
        } else {
          const row = data as unknown as Record<string, unknown>;
          replaceOptimisticEvent(tempId, {
            ...optimisticEvent,
            id: row.id as string,
            created_at: row.created_at as string,
          });
        }
      } catch {
        removeOptimisticEvent(tempId);
        onSubmitFailure(formData, location);
      }
    })();
  }

  if (!pendingLocation) return null;

  const inputClass = (field: string) =>
    `w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border ${
      fieldErrors[field] ? 'border-red-500' : 'border-gray-700'
    } focus:outline-none focus:border-indigo-500 placeholder-gray-500`;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create event"
      onClick={(e) => {
        if (e.target === e.currentTarget) exitPlacementMode();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-white text-lg font-semibold">Create Event</h2>
          <button
            type="button"
            onClick={exitPlacementMode}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Left: form */}
            <form id="create-event-form" onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
              {bannerError && (
                <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {bannerError}
                </div>
              )}

              {/* Address */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search for an address…"
                  className={inputClass('address')}
                  autoComplete="off"
                />
                {fieldErrors.address && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.address}</p>
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onMouseDown={() => handleSelectSuggestion(s)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-300">Title</label>
                  <span className="text-xs text-gray-500">{title.length}/120</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                  placeholder="What's the event?"
                  className={inputClass('title')}
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-300">
                    Description <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <span className="text-xs text-gray-500">{description.length}/2000</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  placeholder="Tell people what to expect…"
                  rows={3}
                  className={`${inputClass('description')} resize-none`}
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.description}</p>
                )}
              </div>

              {/* Start / End time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Starts</label>
                  <input
                    type="datetime-local"
                    value={starts_at}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={`${inputClass('starts_at')} [color-scheme:dark]`}
                  />
                  {fieldErrors.starts_at && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.starts_at}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ends <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={ends_at}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={`${inputClass('ends_at')} [color-scheme:dark]`}
                  />
                  {fieldErrors.ends_at && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.ends_at}</p>
                  )}
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Capacity <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Unlimited"
                  className={inputClass('capacity')}
                />
                {fieldErrors.capacity && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.capacity}</p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags{' '}
                  <span className="text-gray-500 font-normal">
                    ({tags.length}/5 selected, at least 1 required)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_TAGS.map((tag) => {
                    const selected = tags.includes(tag);
                    const color = TAG_COLORS[tag];
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'border-transparent text-white'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                        style={selected ? { backgroundColor: color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.tags && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.tags}</p>
                )}
              </div>

              {/* Affiliation */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Affiliation</label>
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="Organization, school, or group (optional)"
                  className={inputClass('affiliation')}
                />
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Public event</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={is_public}
                  onClick={() => setIsPublic((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                    is_public ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      is_public ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </form>

            {/* Right: mini map preview */}
            <div className="relative md:border-l border-gray-800">
              <div className="h-48 md:h-full md:min-h-[400px]">
                <Map
                  ref={miniMapRef}
                  initialViewState={{
                    longitude: pendingLocation[0],
                    latitude: pendingLocation[1],
                    zoom: 14,
                  }}
                  interactive={false}
                  attributionControl={false}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/dark-v11"
                  mapboxAccessToken={MAPBOX_TOKEN}
                >
                  <Marker
                    longitude={pendingLocation[0]}
                    latitude={pendingLocation[1]}
                    anchor="center"
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#6366f1',
                        border: '2px solid #fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      }}
                    />
                  </Marker>
                </Map>
              </div>
              <p className="absolute bottom-3 left-3 right-3 text-xs text-gray-400 bg-gray-900/80 rounded px-2 py-1 text-center pointer-events-none">
                Tap the map behind this panel to reposition your pin
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={exitPlacementMode}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-event-form"
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg"
          >
            Post Event
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
