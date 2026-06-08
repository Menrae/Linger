import { useEffect } from 'react';
import { useFilterStore } from '../store/filterStore';

// Writes filter state to URL query params via replaceState so filter views
// are shareable without polluting browser history.
export function useFilterSync() {
  const timeRange = useFilterStore((s) => s.timeRange);
  const customFrom = useFilterStore((s) => s.customFrom);
  const customTo = useFilterStore((s) => s.customTo);
  const tags = useFilterStore((s) => s.tags);
  const minCapacity = useFilterStore((s) => s.minCapacity);
  const affiliation = useFilterStore((s) => s.affiliation);

  useEffect(() => {
    const params = new URLSearchParams();

    if (timeRange) params.set('timeRange', timeRange);
    if (timeRange === 'custom' && customFrom) params.set('from', customFrom.toISOString());
    if (timeRange === 'custom' && customTo) params.set('to', customTo.toISOString());
    if (tags.length > 0) params.set('tags', tags.join(','));
    if (minCapacity !== null) params.set('minCapacity', String(minCapacity));
    if (affiliation) params.set('affiliation', affiliation);

    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [timeRange, customFrom, customTo, tags, minCapacity, affiliation]);
}
