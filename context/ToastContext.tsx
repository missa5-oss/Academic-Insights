import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification object
 */
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

/**
 * Toast context type definition
 */
interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/** Default toast duration in milliseconds */
const DEFAULT_DURATION = 5000;

/**
 * Toast icon component based on type
 */
const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const iconProps = { size: 20, className: 'flex-shrink-0' };

  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} className={`${iconProps.className} text-green-500`} />;
    case 'error':
      return <AlertCircle {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case 'warning':
      return <AlertTriangle {...iconProps} className={`${iconProps.className} text-yellow-500`} />;
    case 'info':
      return <Info {...iconProps} className={`${iconProps.className} text-blue-500`} />;
  }
};

/**
 * Single toast notification component
 */
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${bgColors[toast.type]} animate-slide-in`}
    >
      <ToastIcon type={toast.type} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm text-gray-600">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
};

/**
 * Toast container that renders all active toasts
 */
const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

/**
 * Toast provider component.
 * Wrap your app with this to enable toast notifications.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    const duration = toast.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message, duration: 8000 }); // Errors stay longer
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * Hook to access toast notifications.
 * Must be used within a ToastProvider.
 *
 * @example
 * ```tsx
 * const toast = useToast();
 * toast.success('Project saved!');
 * toast.error('Failed to save', 'Please try again');
 * ```
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
