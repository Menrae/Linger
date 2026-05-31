import { Marker } from 'react-map-gl/mapbox';
import { clusterIndex } from '../../lib/supercluster';
import type { MapRef } from 'react-map-gl/mapbox';

interface EventClusterProps {
  clusterId: number;
  longitude: number;
  latitude: number;
  pointCount: number;
  mapRef: React.RefObject<MapRef | null>;
}

function clusterSize(count: number): number {
  if (count > 50) return 52;
  if (count >= 10) return 44;
  return 36;
}

export function EventCluster({
  clusterId,
  longitude,
  latitude,
  pointCount,
  mapRef,
}: EventClusterProps) {
  const size = clusterSize(pointCount);

  function handleClick() {
    const map = mapRef.current;
    if (!map) return;
    const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
    map.flyTo({ center: [longitude, latitude], zoom: expansionZoom, duration: 400 });
  }

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center" onClick={handleClick}>
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-indigo-500 bg-opacity-80 border-2 border-white shadow-lg flex items-center justify-center cursor-pointer text-white font-semibold text-sm"
      >
        {pointCount}
      </div>
    </Marker>
  );
}
