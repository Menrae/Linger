import { useEffect } from 'react';
import { useFilterStore } from '../../store/filterStore';
import { TAG_COLORS, ALL_TAGS } from '../../types';
import type { TimeRange } from '../../store/filterStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function toDateInputValue(d: Date | null): string {
  if (!d) return '';
  // toISOString() gives UTC; slice to YYYY-MM-DD for the date input
  return d.toISOString().slice(0, 10);
}

export function FilterTray({ isOpen, onClose }: Props) {
  const timeRange = useFilterStore((s) => s.timeRange);
  const customFrom = useFilterStore((s) => s.customFrom);
  const customTo = useFilterStore((s) => s.customTo);
  const tags = useFilterStore((s) => s.tags);
  const minCapacity = useFilterStore((s) => s.minCapacity);
  const affiliation = useFilterStore((s) => s.affiliation);
  const setTimeRange = useFilterStore((s) => s.setTimeRange);
  const setCustomRange = useFilterStore((s) => s.setCustomRange);
  const toggleTag = useFilterStore((s) => s.toggleTag);
  const setMinCapacity = useFilterStore((s) => s.setMinCapacity);
  const setAffiliation = useFilterStore((s) => s.setAffiliation);
  const clearAll = useFilterStore((s) => s.clearAll);

  const activeCount =
    (timeRange !== null ? 1 : 0) +
    (tags.length > 0 ? 1 : 0) +
    (minCapacity !== null ? 1 : 0) +
    (affiliation ? 1 : 0);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function handleTimeClick(range: Exclude<TimeRange, null>) {
    setTimeRange(timeRange === range ? null : range);
  }

  function handleFromDate(value: string) {
    if (!value) return;
    const from = new Date(value + 'T00:00:00');
    const to = customTo ?? new Date(value + 'T23:59:59.999');
    setCustomRange(from, to);
  }

  function handleToDate(value: string) {
    if (!value) return;
    const to = new Date(value + 'T23:59:59.999');
    const from = customFrom ?? new Date(value + 'T00:00:00');
    setCustomRange(from, to);
  }

  function handleClearAll() {
    clearAll();
    onClose();
  }

  const timeButtons: { label: string; value: Exclude<TimeRange, null> }[] = [
    { label: 'Today', value: 'today' },
    { label: 'This Weekend', value: 'weekend' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <>
      {/* Backdrop — always in DOM, fades in/out */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-[250ms] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Tray panel — always in DOM, slides in/out */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter events"
        className={`fixed inset-x-0 bottom-0 z-[41] flex flex-col bg-gray-900 rounded-t-2xl max-h-[80vh] shadow-2xl transition-transform duration-[250ms] ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-6">

          {/* TIME */}
          <section>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Time
            </h3>
            <div className="flex gap-2">
              {timeButtons.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTimeClick(value)}
                  className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                    timeRange === value
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeRange === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={toDateInputValue(customFrom)}
                    onChange={(e) => handleFromDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={toDateInputValue(customTo)}
                    onChange={(e) => handleToDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* TAGS */}
          <section>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Tags
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TAGS.map((tag) => {
                const selected = tags.includes(tag);
                const color = TAG_COLORS[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors duration-150 min-h-[44px] ${
                      selected ? '' : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                    style={
                      selected
                        ? {
                            color,
                            backgroundColor: `${color}33`, // 20% opacity
                            borderColor: color,
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }
                        : undefined
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {/* CAPACITY */}
          <section>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Capacity
            </h3>
            <input
              type="number"
              min="1"
              value={minCapacity ?? ''}
              onChange={(e) => setMinCapacity(e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="Any"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-gray-500"
            />
            <p className="mt-1.5 text-xs text-white/50">
              Minimum spots — events with unlimited capacity always included
            </p>
          </section>

          {/* AFFILIATION */}
          <section>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Affiliation
            </h3>
            <input
              type="text"
              value={affiliation ?? ''}
              onChange={(e) => setAffiliation(e.target.value || null)}
              placeholder="Organization or group"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-gray-500"
            />
          </section>
        </div>

        {/* Footer — sticky at bottom */}
        <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3 flex items-center justify-between bg-gray-900/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleClearAll}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear all
          </button>

          {activeCount > 0 && (
            <span className="text-xs text-gray-500">
              {activeCount} filter{activeCount !== 1 ? 's' : ''} active
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-150 min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
