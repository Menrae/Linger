import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

type ToastListener = (toast: Omit<ToastItem, 'id'>) => void;
const listeners = new Set<ToastListener>();
let nextId = 0;

export function showToast(message: string, action?: { label: string; onClick: () => void }) {
  listeners.forEach((fn) => fn({ message, action }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add: ToastListener = (t) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed left-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))', transform: 'translateX(-50%)' }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm px-4 py-2.5 rounded-full shadow-lg shadow-black/40 pointer-events-auto whitespace-nowrap"
          style={{ animation: 'toast-in 150ms ease-out forwards' }}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
