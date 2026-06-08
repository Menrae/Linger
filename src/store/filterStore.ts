import { create } from 'zustand';

export type TimeRange = 'today' | 'weekend' | 'custom' | null;

interface FilterState {
  timeRange: TimeRange;
  customFrom: Date | null;
  customTo: Date | null;
  tags: string[];
  minCapacity: number | null;
  affiliation: string | null;
}

interface FilterStore extends FilterState {
  setTimeRange: (range: TimeRange) => void;
  setCustomRange: (from: Date, to: Date) => void;
  setTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setMinCapacity: (n: number | null) => void;
  setAffiliation: (s: string | null) => void;
  clearAll: () => void;
}

const DEFAULT_STATE: FilterState = {
  timeRange: null,
  customFrom: null,
  customTo: null,
  tags: [],
  minCapacity: null,
  affiliation: null,
};

// Runs at module load time — before any React render — so filters hydrated
// from the URL are present on the very first render (no flash of unfiltered state).
function readUrlParams(): Partial<FilterState> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const out: Partial<FilterState> = {};

  const tr = p.get('timeRange');
  if (tr === 'today' || tr === 'weekend' || tr === 'custom') out.timeRange = tr;

  const fromStr = p.get('from');
  if (fromStr) {
    const d = new Date(fromStr);
    if (!isNaN(d.getTime())) out.customFrom = d;
  }

  const toStr = p.get('to');
  if (toStr) {
    const d = new Date(toStr);
    if (!isNaN(d.getTime())) out.customTo = d;
  }

  const tagsParam = p.get('tags');
  if (tagsParam) out.tags = tagsParam.split(',').filter(Boolean);

  const minCap = p.get('minCapacity');
  if (minCap) {
    const n = parseInt(minCap, 10);
    if (!isNaN(n) && n > 0) out.minCapacity = n;
  }

  const aff = p.get('affiliation');
  if (aff) out.affiliation = aff;

  return out;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...DEFAULT_STATE,
  ...readUrlParams(),

  setTimeRange: (timeRange) => set({ timeRange }),
  setCustomRange: (customFrom, customTo) => set({ customFrom, customTo }),
  setTags: (tags) => set({ tags }),
  toggleTag: (tag) =>
    set((s) => ({
      tags: s.tags.includes(tag)
        ? s.tags.filter((t) => t !== tag)
        : s.tags.length < 5
          ? [...s.tags, tag]
          : s.tags,
    })),
  setMinCapacity: (minCapacity) => set({ minCapacity }),
  setAffiliation: (affiliation) => set({ affiliation }),
  clearAll: () => set(DEFAULT_STATE),
}));
