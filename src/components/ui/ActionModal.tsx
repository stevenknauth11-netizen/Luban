'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, Info, Loader2, X } from 'lucide-react';

export interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  loading?: boolean;
  children?: React.ReactNode;
}

export function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary',
  loading = false,
  children,
}: ActionModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      btnStyle: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      btnStyle: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    },
    primary: {
      icon: Info,
      iconColor: 'text-slate-800',
      iconBg: 'bg-slate-100',
      btnStyle: 'bg-slate-900 hover:bg-slate-800 focus:ring-slate-500 text-white',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100',
      btnStyle: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white',
    },
  }[variant];

  const Icon = variantStyles.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[95%] sm:max-w-lg max-h-[92vh] overflow-y-auto transform transition-all animate-scaleUp"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${variantStyles.iconBg}`}>
              <Icon className={`w-5 h-5 ${variantStyles.iconColor}`} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{title}</h3>
              <div className="text-xs text-slate-500 mt-0.5">{description}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body if supplied */}
        {children && <div className="px-4 sm:px-6 py-3 sm:py-4">{children}</div>}

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors disabled:opacity-50 text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors disabled:opacity-50 ${variantStyles.btnStyle}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
