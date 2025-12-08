import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog for destructive actions.
 * Provides a styled modal with confirm/cancel buttons.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   title="Delete Project"
 *   message="Are you sure you want to delete this project?"
 *   variant="danger"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowConfirm(false)}
 * />
 * ```
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    warning: {
      icon: 'bg-yellow-100 text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    info: {
      icon: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full transform transition-all animate-fade-in-up">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto w-12 h-12 rounded-full ${styles.icon} flex items-center justify-center mb-4`}>
              <AlertTriangle size={24} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-slate-600 text-center text-sm">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
