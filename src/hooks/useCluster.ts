import { useEffect, useMemo } from 'react';
import { clusterIndex } from '../lib/supercluster';
import type { Event, MapBounds } from '../types';
import type { ClusterFeature, PointFeature } from 'supercluster';

export type ClusterOrPoint =
  | ClusterFeature<{ cluster: true; point_count: number; point_count_abbreviated: string | number }>
  | PointFeature<Event & { cluster?: false }>;

export function useCluster(
  events: Event[],
  bounds: MapBounds | null,
  zoom: number,
): { clusters: ClusterOrPoint[] } {
  const features = useMemo(
    () =>
      events.map((event) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [event.location.lng, event.location.lat] as [number, number],
        },
        properties: { ...event, cluster: false as const },
      })),
    [events],
  );

  useEffect(() => {
    clusterIndex.load(features);
  }, [features]);

  const clusters = useMemo((): ClusterOrPoint[] => {
    if (!bounds) return [];
    const bbox: [number, number, number, number] = [
      bounds.minLng,
      bounds.minLat,
      bounds.maxLng,
      bounds.maxLat,
    ];
    return clusterIndex.getClusters(bbox, Math.round(zoom)) as ClusterOrPoint[];
  }, [bounds, zoom]);

  return { clusters };
}
