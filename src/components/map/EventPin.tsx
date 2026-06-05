import { useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { useMapStore } from '../../store/mapStore';
import type { Event } from '../../types';

const TAG_COLORS: Record<string, string> = {
  sports: '#3B82F6',
  music: '#A855F7',
  food: '#F97316',
  arts: '#EC4899',
  tech: '#06B6D4',
  outdoors: '#22C55E',
  social: '#EAB308',
  education: '#8B5CF6',
};

const DEFAULT_COLOR = '#6B7280';

function tagColor(tags: string[]): string {
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) return color;
  }
  return DEFAULT_COLOR;
}

interface EventPinProps {
  event: Event;
  isNew?: boolean;
}

export function EventPin({ event, isNew }: EventPinProps) {
  const [hovered, setHovered] = useState(false);
  const setSelectedEvent = useMapStore((s) => s.setSelectedEvent);
  const color = tagColor(event.tags);

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
        className="relative cursor-pointer"
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
