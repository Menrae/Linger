import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useAuthStore } from '../../store/authStore';
import { useEventDetail } from '../../hooks/useEventDetail';
import { TAG_COLORS } from '../../types';
import type { EventTag } from '../../types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TagPill({ tag }: { tag: string }) {
  const color = TAG_COLORS[tag as EventTag] ?? '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color, backgroundColor: `${color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {tag}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="px-4 pb-6 pt-2 space-y-4 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-700 rounded w-1/2" />
      <div className="h-4 bg-gray-700 rounded w-2/3" />
      <div className="h-4 bg-gray-700 rounded w-1/3" />
      <div className="flex gap-2 pt-2">
        <div className="h-6 bg-gray-700 rounded-full w-20" />
        <div className="h-6 bg-gray-700 rounded-full w-24" />
      </div>
      <div className="h-10 bg-gray-700 rounded-xl mt-2" />
    </div>
  );
}

export function EventDrawer() {
  const selectedEventId = useMapStore((s) => s.selectedEventId);
  const setSelectedEvent = useMapStore((s) => s.setSelectedEvent);
  const user = useAuthStore((s) => s.user);

  const { state, retry, rsvp, cancelRsvp } = useEventDetail(selectedEventId, user?.id ?? null);
  const [copied, setCopied] = useState(false);

  const isOpen = selectedEventId !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setSelectedEvent]);

  const handleShare = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-[250ms] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSelectedEvent(null)}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
        className={`fixed inset-x-0 bottom-0 z-[41] flex flex-col bg-gray-900 rounded-t-2xl max-h-[60vh] shadow-2xl transition-transform duration-[250ms] ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header: drag handle + close */}
        <div className="relative flex justify-center items-center px-12 pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
          <button
            onClick={() => setSelectedEvent(null)}
            aria-label="Close event detail"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {state.status === 'loading' && <Skeleton />}

          {state.status === 'error' && (
            <div className="px-4 pb-6 pt-4 flex flex-col items-center gap-3 text-center">
              <p className="text-gray-400 text-sm">{state.message}</p>
              <button
                onClick={retry}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="px-4 pb-6 pt-1 space-y-3">
              {/* Title */}
              <h2 className="text-white text-xl font-semibold leading-tight">
                {state.detail.title}
              </h2>

              {/* Host */}
              <p className="text-gray-400 text-sm">
                Hosted by{' '}
                <span className="text-gray-200">
                  {state.detail.host?.display_name ?? 'Anonymous'}
                </span>
              </p>

              {/* Date / time */}
              <div className="flex items-start gap-2 text-sm text-gray-300">
                <svg
                  className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
                <span>
                  {formatDateTime(state.detail.starts_at)}
                  {state.detail.ends_at && ` — ${formatDateTime(state.detail.ends_at)}`}
                </span>
              </div>

              {/* Address */}
              <div className="flex items-start gap-2 text-sm text-gray-300">
                <svg
                  className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
                <span>{state.detail.address}</span>
              </div>

              {/* Attendees + capacity */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg
                  className="w-4 h-4 flex-shrink-0 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                  />
                </svg>
                <span>
                  {state.detail.attendee_count} attending
                  {state.detail.capacity !== null && ` · ${state.detail.capacity} spots total`}
                </span>
              </div>

              {/* Tags */}
              {state.detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {state.detail.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </div>
              )}

              {/* Affiliation */}
              {state.detail.affiliation && (
                <p className="text-gray-400 text-sm">
                  <span className="text-gray-500">Affiliation: </span>
                  {state.detail.affiliation}
                </p>
              )}

              {/* Description */}
              {state.detail.description && (
                <p className="text-gray-300 text-sm leading-relaxed pt-1">
                  {state.detail.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3">
                {user ? (
                  state.detail.is_attending ? (
                    <button
                      onClick={() => void cancelRsvp()}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                    >
                      Cancel RSVP
                    </button>
                  ) : (
                    <button
                      onClick={() => void rsvp()}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                    >
                      RSVP
                    </button>
                  )
                ) : (
                  <p className="flex-1 flex items-center text-gray-500 text-xs">Sign in to RSVP</p>
                )}

                <button
                  onClick={() => void handleShare()}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors min-w-[80px]"
                >
                  {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}
