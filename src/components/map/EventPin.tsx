import { useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { useMapStore } from '../../store/mapStore';
import { TAG_COLORS } from '../../types';
import type { Event, EventTag } from '../../types';

const DEFAULT_COLOR = '#6B7280';

function tagColor(tags: string[]): string {
  for (const tag of tags) {
    const color = TAG_COLORS[tag as EventTag];
    if (color) return color;
  }
  return DEFAULT_COLOR;
}

interface EventPinProps {
  event: Event;
  isNew?: boolean;
  isDimmed?: boolean;
}

export function EventPin({ event, isNew, isDimmed }: EventPinProps) {
  const [hovered, setHovered] = useState(false);
  const setSelectedEvent = useMapStore((s) => s.setSelectedEvent);
  const selectedEventId = useMapStore((s) => s.selectedEventId);
  const isSelected = selectedEventId === event.id;
  const color = tagColor(event.tags);

  if (isDimmed) {
    return (
      <Marker longitude={event.location.lng} latitude={event.location.lat} anchor="center">
        <div className="opacity-25">
          <div
            style={{ backgroundColor: color }}
            className="w-4 h-4 rounded-full border-2 border-white shadow-md"
          />
        </div>
      </Marker>
    );
  }

  return (
    <Marker
      longitude={event.location.lng}
      latitude={event.location.lat}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        setSelectedEvent(event.id);
      }}
    >
      <div
        className={`relative cursor-pointer transition-transform duration-150 ${isSelected ? 'scale-[1.2]' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{ backgroundColor: color }}
          className={`w-4 h-4 rounded-full border-2 border-white shadow-md${isNew ? ' animate-pin-enter' : ''}`}
        />
        {hovered && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg pointer-events-none">
            {event.title}
          </div>
        )}
      </div>
    </Marker>
  );
}
