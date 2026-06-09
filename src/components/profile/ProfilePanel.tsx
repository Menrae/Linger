import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore';
import { useMapStore } from '../../store/mapStore';
import { supabase } from '../../lib/supabase';
import { TAG_COLORS } from '../../types';
import type { Event, EventTag } from '../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseWKBHex(hex: string): { lat: number; lng: number } | null {
  if (hex.length < 50) return null;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const lng = view.getFloat64(9, true);
  const lat = view.getFloat64(17, true);
  return { lat, lng };
}

function extractLatLng(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw === 'string' && (raw.startsWith('0101000020') || raw.startsWith('0101000000'))) {
    return parseWKBHex(raw);
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.coordinates) && r.coordinates.length >= 2) {
      return { lng: r.coordinates[0] as number, lat: r.coordinates[1] as number };
    }
  }
  if (typeof raw === 'string') {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
        return { lng: obj.coordinates[0] as number, lat: obj.coordinates[1] as number };
      }
    } catch {
      return null;
    }
  }
  return null;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

const displayNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(40, 'Name must be at most 40 characters');

// ─── sub-components ──────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: string }) {
  const color = TAG_COLORS[tag as EventTag] ?? '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color, backgroundColor: `${color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {tag}
    </span>
  );
}

interface RsvpdEvent {
  event_id: string;
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  tags: string[];
  host_id: string;
  hostDisplayName: string | null;
}

// ─── ProfilePanel ─────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  removeEventFromCache: (id: string) => void;
}

export function ProfilePanel({ isOpen, onClose, removeEventFromCache }: Props) {
  const user = useAuthStore((s) => s.user);
  const displayName = useAuthStore((s) => s.displayName);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);
  const signOut = useAuthStore((s) => s.signOut);

  const enterPlacementMode = useMapStore((s) => s.enterPlacementMode);
  const setPendingLocation = useMapStore((s) => s.setPendingLocation);
  const setEditingEvent = useMapStore((s) => s.setEditingEvent);

  // Hosted events
  const [hostedTab, setHostedTab] = useState<'upcoming' | 'past'>('upcoming');
  const [hostedEvents, setHostedEvents] = useState<Event[]>([]);
  const [hostedLoading, setHostedLoading] = useState(false);

  // RSVPd events
  const [rsvpdEvents, setRsvpdEvents] = useState<RsvpdEvent[]>([]);
  const [rsvpdLoading, setRsvpdLoading] = useState(false);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const initial = (displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  // ── ESC to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // ── Fetch hosted events ────────────────────────────────────────────────────
  const fetchHostedEvents = useCallback(async () => {
    if (!user) return;
    setHostedLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('host_id', user.id)
      .order('starts_at', { ascending: hostedTab === 'upcoming' })
      .gt('starts_at', hostedTab === 'upcoming' ? now : '1970-01-01')
      .lte('starts_at', hostedTab === 'past' ? now : '9999-12-31');

    if (!error && data) {
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const parsed: Event[] = rows.map((row) => {
        const coords = extractLatLng(row.location);
        return { ...(row as unknown as Event), location: coords ?? { lat: 0, lng: 0 } };
      });
      setHostedEvents(parsed);
    }
    setHostedLoading(false);
  }, [user, hostedTab]);

  // ── Fetch RSVPd events ─────────────────────────────────────────────────────
  const fetchRsvpdEvents = useCallback(async () => {
    if (!user) return;
    setRsvpdLoading(true);
    const now = new Date().toISOString();

    type AttendeeRow = { event_id: string; events: Record<string, unknown> | null };
    const { data, error } = await supabase
      .from('event_attendees')
      .select('event_id, events(*)')
      .eq('user_id', user.id)
      .order('rsvp_at', { ascending: false });

    if (!error && data) {
      const rows = (data as unknown as AttendeeRow[]) ?? [];
      const upcoming = rows
        .map((r) => r.events)
        .filter((e): e is Record<string, unknown> => !!e)
        .filter((e) => typeof e.starts_at === 'string' && e.starts_at > now);

      const hostIds = [...new Set(upcoming.map((e) => e.host_id as string))];
      let profileMap: Record<string, string | null> = {};

      if (hostIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', hostIds);
        if (profiles) {
          type ProfileRow = { id: string; display_name: string | null };
          profileMap = Object.fromEntries(
            (profiles as unknown as ProfileRow[]).map((p) => [p.id, p.display_name]),
          );
        }
      }

      setRsvpdEvents(
        upcoming.map((e) => ({
          event_id: e.id as string,
          id: e.id as string,
          title: e.title as string,
          starts_at: e.starts_at as string,
          ends_at: (e.ends_at as string | null) ?? null,
          tags: (e.tags as string[]) ?? [],
          host_id: e.host_id as string,
          hostDisplayName: profileMap[e.host_id as string] ?? null,
        })),
      );
    }
    setRsvpdLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    void fetchRsvpdEvents();
  }, [isOpen, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen || !user) return;
    void fetchHostedEvents();
  }, [isOpen, user?.id, hostedTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Name editing ──────────────────────────────────────────────────────────
  const startEditName = () => {
    setNameInput(displayName ?? '');
    setNameError(null);
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameError(null);
  };

  const saveDisplayName = async () => {
    const validation = displayNameSchema.safeParse(nameInput.trim());
    if (!validation.success) {
      setNameError(validation.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nameInput.trim() })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      setNameError('Failed to save. Please try again.');
      return;
    }
    setDisplayName(nameInput.trim());
    setEditingName(false);
    setNameError(null);
  };

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setUploadError('Upload failed. File must be an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Upload failed. Max 5MB.');
      return;
    }

    setUploadError(null);
    setUploadingAvatar(true);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadError('Upload failed. Max 5MB.');
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const oldAvatarUrl = avatarUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      setUploadError('Upload failed. Please try again.');
      setUploadingAvatar(false);
      return;
    }

    setAvatarUrl(publicUrl);

    // Delete previous avatar file from storage
    if (oldAvatarUrl) {
      const parts = oldAvatarUrl.split('/storage/v1/object/public/avatars/');
      if (parts[1]) {
        void supabase.storage.from('avatars').remove([parts[1]]);
      }
    }

    setUploadingAvatar(false);
  };

  // ── Delete hosted event ───────────────────────────────────────────────────
  const deleteEvent = async (eventId: string) => {
    setDeletingId(eventId);
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (!error) {
      setHostedEvents((prev) => prev.filter((e) => e.id !== eventId));
      removeEventFromCache(eventId);
      setConfirmDeleteId(null);
    }
    setDeletingId(null);
  };

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setPendingLocation([event.location.lng, event.location.lat]);
    enterPlacementMode();
    onClose();
  };

  // ── Cancel RSVP ───────────────────────────────────────────────────────────
  const cancelRsvp = async (eventId: string) => {
    const { error } = await supabase.rpc('cancel_rsvp', { p_event_id: eventId });
    if (!error) {
      setRsvpdEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const panel = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[45] bg-black/50 transition-opacity duration-[250ms] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        className={`fixed top-0 left-0 h-full z-[46] w-full sm:w-[380px] bg-gray-900 shadow-2xl flex flex-col transition-transform duration-[250ms] ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header: X button */}
        <div className="flex items-center justify-end px-4 pt-4 pb-2 flex-shrink-0">
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Avatar + identity section */}
          <div className="flex flex-col items-center px-6 pb-6 pt-2">
            {/* Avatar */}
            <div
              className="relative group cursor-pointer mb-4"
              onClick={() => fileInputRef.current?.click()}
              title="Change photo"
            >
              {avatarUrl ? (
                <div className="p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full">
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover block"
                  />
                </div>
              ) : (
                <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-3xl font-semibold select-none">{initial}</span>
                </div>
              )}

              {/* Camera overlay on hover */}
              {!uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                    />
                  </svg>
                </div>
              )}

              {/* Upload spinner */}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />

            {uploadError && (
              <p className="text-xs text-red-400 mb-2 text-center">{uploadError}</p>
            )}

            {/* Display name */}
            {editingName ? (
              <div className="w-full max-w-[260px]">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setNameError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveDisplayName();
                      if (e.key === 'Escape') cancelEditName();
                    }}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-1.5 text-base font-semibold text-center border border-gray-600 focus:outline-none focus:border-indigo-500"
                    maxLength={40}
                  />
                  <button
                    onClick={() => void saveDisplayName()}
                    disabled={savingName}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                    aria-label="Save name"
                  >
                    {savingName ? (
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={cancelEditName}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Cancel"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {nameError && (
                  <p className="mt-1 text-xs text-red-400 text-center">{nameError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white text-xl font-bold">
                  {displayName ?? user?.email ?? ''}
                </span>
                <button
                  onClick={startEditName}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Edit display name"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                    />
                  </svg>
                </button>
              </div>
            )}

            {user && (
              <p className="mt-1 text-xs text-gray-500">
                Joined {formatJoinedDate(user.created_at)}
              </p>
            )}
          </div>

          {/* Hosted events */}
          <div className="px-4 pb-4">
            <h3 className="text-white text-sm font-semibold mb-3 px-2">Your Events</h3>

            {/* Tab toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1 mb-3">
              {(['upcoming', 'past'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setHostedTab(tab)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
                    hostedTab === tab
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {hostedLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              </div>
            ) : hostedEvents.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">
                  {hostedTab === 'upcoming' ? 'No upcoming events' : 'No past events yet'}
                </p>
                {hostedTab === 'upcoming' && (
                  <p className="text-gray-600 text-xs mt-1">Host one by tapping the map</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {hostedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-gray-800 rounded-xl p-3 space-y-1.5"
                  >
                    <p className="text-white text-sm font-semibold leading-tight">{event.title}</p>
                    <p className="text-gray-400 text-xs">{formatEventDate(event.starts_at)}</p>

                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.tags.slice(0, 2).map((tag) => (
                          <TagChip key={tag} tag={tag} />
                        ))}
                        {event.tags.length > 2 && (
                          <span className="text-xs text-gray-500 self-center">
                            +{event.tags.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-gray-500 text-xs">{event.attendee_count} going</p>

                    {confirmDeleteId === event.id ? (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-400 flex-1">Delete this event?</span>
                        <button
                          onClick={() => void deleteEvent(event.id)}
                          disabled={deletingId === event.id}
                          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
                        >
                          {deletingId === event.id ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openEditModal(event)}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          aria-label="Edit event"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(event.id)}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
                          aria-label="Delete event"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RSVPd events */}
          <div className="px-4 pb-4 border-t border-gray-800 pt-4">
            <h3 className="text-white text-sm font-semibold mb-3 px-2">Going</h3>

            {rsvpdLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              </div>
            ) : rsvpdEvents.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">Nothing yet</p>
                <p className="text-gray-600 text-xs mt-1">Tap a pin to explore events near you</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rsvpdEvents.map((event) => (
                  <div key={event.id} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <p className="text-white text-sm font-semibold leading-tight">{event.title}</p>
                    <p className="text-gray-400 text-xs">{formatEventDate(event.starts_at)}</p>

                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.tags.slice(0, 2).map((tag) => (
                          <TagChip key={tag} tag={tag} />
                        ))}
                        {event.tags.length > 2 && (
                          <span className="text-xs text-gray-500 self-center">
                            +{event.tags.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-gray-500 text-xs">
                      Hosted by{' '}
                      <span className="text-gray-400">{event.hostDisplayName ?? 'Anonymous'}</span>
                    </p>

                    <button
                      onClick={() => void cancelRsvp(event.id)}
                      className="text-xs text-gray-400 hover:text-white transition-colors mt-1"
                    >
                      Cancel RSVP
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign out */}
          <div className="px-6 py-4 border-t border-gray-800">
            <button
              onClick={() => void handleSignOut()}
              className="text-sm text-red-500/70 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
