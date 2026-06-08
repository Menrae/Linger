import { useFilterStore } from '../../store/filterStore';

interface Props {
  onClick: () => void;
}

export function FilterPill({ onClick }: Props) {
  const activeCount = useFilterStore(
    (s) =>
      (s.timeRange !== null ? 1 : 0) +
      (s.tags.length > 0 ? 1 : 0) +
      (s.minCapacity !== null ? 1 : 0) +
      (s.affiliation ? 1 : 0),
  );

  return (
    <button
      onClick={onClick}
      aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-gray-900/95 backdrop-blur-sm text-white text-sm font-medium pl-3.5 pr-4 py-2.5 rounded-full shadow-lg shadow-black/40 hover:bg-gray-800 transition-colors"
    >
      {/* Adjustments / sliders icon */}
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
        />
      </svg>

      <span>Filters</span>

      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-bold leading-none">
          {activeCount}
        </span>
      )}
    </button>
  );
}
