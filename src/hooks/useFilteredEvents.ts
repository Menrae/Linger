import { useMemo } from 'react';
import { useFilterStore } from '../store/filterStore';
import type { Event } from '../types';

// In a dedicated hook (not inline in MapView) so the date math and multi-step
// filter chain stay readable in isolation; MapView's concern is rendering only.

function getTodayRange(): [Date, Date] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getWeekendRange(): [Date, Date] {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  // Offset to the Friday of the current calendar week (negative = past days).
  const daysToFriday = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysToFriday);
  friday.setHours(17, 0, 0, 0); // 5:00 PM
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);
  return [friday, sunday];
}

export function useFilteredEvents(events: Event[]): {
  filteredEvents: Event[];
  dimmedEvents: Event[];
} {
  const timeRange = useFilterStore((s) => s.timeRange);
  const customFrom = useFilterStore((s) => s.customFrom);
  const customTo = useFilterStore((s) => s.customTo);
  const tags = useFilterStore((s) => s.tags);
  const minCapacity = useFilterStore((s) => s.minCapacity);
  const affiliation = useFilterStore((s) => s.affiliation);

  const filteredEvents = useMemo(() => {
    const hasFilters =
      timeRange !== null || tags.length > 0 || minCapacity !== null || !!affiliation;
    if (!hasFilters) return events;

    return events.filter((event) => {
      // 1. Time range
      if (timeRange) {
        const startsAt = new Date(event.starts_at);
        let from: Date;
        let to: Date;

        if (timeRange === 'today') {
          [from, to] = getTodayRange();
        } else if (timeRange === 'weekend') {
          [from, to] = getWeekendRange();
        } else {
          // custom — show all while the user hasn't set both bounds yet
          if (!customFrom || !customTo) {
            from = new Date(0);
            to = new Date(8640000000000000);
          } else {
            from = customFrom;
            to = customTo;
          }
        }

        if (startsAt < from || startsAt > to) return false;
      }

      // 2. Tags — any overlap passes
      if (tags.length > 0 && !event.tags.some((t) => tags.includes(t))) return false;

      // 3. Capacity — unlimited (null) always passes; otherwise must meet minimum
      if (minCapacity !== null && event.capacity !== null && event.capacity < minCapacity)
        return false;

      // 4. Affiliation — case-insensitive exact match
      if (
        affiliation &&
        (!event.affiliation ||
          event.affiliation.toLowerCase() !== affiliation.toLowerCase())
      )
        return false;

      return true;
    });
  }, [events, timeRange, customFrom, customTo, tags, minCapacity, affiliation]);

  // Events that exist in the cache but don't pass filters → render as dimmed pins.
  const dimmedEvents = useMemo(() => {
    const filteredIds = new Set(filteredEvents.map((e) => e.id));
    return events.filter((e) => !filteredIds.has(e.id));
  }, [events, filteredEvents]);

  return { filteredEvents, dimmedEvents };
}
