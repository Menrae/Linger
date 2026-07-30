import { memo, useState } from 'react';
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

export const EventPin = memo(function EventPin({ event, isNew, isDimmed }: EventPinProps) {
  const [hovered, setHovered] = useState(false);
  const setSelectedEvent = useMapStore((s) => s.setSelectedEvent);
  const setSelectedExternalEvent = useMapStore((s) => s.setSelectedExternalEvent);
  const selectedEventId = useMapStore((s) => s.selectedEventId);
  const isSelected = selectedEventId === event.id;
  const color = tagColor(event.tags);
  const isExternal = event.source === 'eventbrite';

  if (isDimmed) {
    return (
      <Marker longitude={event.location.lng} latitude={event.location.lat} anchor="center">
        <div className="opacity-25 w-[44px] h-[44px] flex items-center justify-center">
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
        if (isExternal) {
          setSelectedExternalEvent(event);
        } else {
          setSelectedEvent(event.id);
        }
      }}
    >
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: 44, height: 44 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isExternal && (
          <div
            className={`absolute w-5 h-5 rounded-full border-2 border-orange-400/70 pointer-events-none transition-transform duration-150${isSelected ? ' scale-[1.4]' : ''}`}
          />
        )}
        <div
          style={{ backgroundColor: color }}
          className={`w-4 h-4 rounded-full border-2 border-white shadow-md transition-transform duration-150${isNew ? ' animate-pin-enter' : ''}${isSelected ? ' scale-[1.4]' : ''}`}
        />
        {hovered && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg pointer-events-none">
            {event.title}
          </div>
        )}
      </div>
    </Marker>
  );
});
