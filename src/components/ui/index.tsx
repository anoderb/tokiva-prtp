import React, { useEffect } from 'react';

// =========================================================================
// 1. BUTTON COMPONENT
// =========================================================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.97] rounded-xl focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-teal-500/20 hover:from-emerald-400 hover:to-teal-500 focus:ring-2 focus:ring-teal-500/40',
    secondary: 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 focus:ring-2 focus:ring-zinc-600/40',
    danger: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20 hover:from-rose-400 hover:to-red-500 focus:ring-2 focus:ring-rose-500/40',
    success: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 focus:ring-2 focus:ring-blue-500/40',
    ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2.5 text-sm min-h-[44px]', // Mobile-friendly 44px tap target
    lg: 'px-6 py-3.5 text-base min-h-[50px]',
    icon: 'p-2.5 min-w-[44px] min-h-[44px]',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// =========================================================================
// 2. INPUT COMPONENT
// =========================================================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  className = '',
  label,
  error,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">{label}</label>}
      <input
        className={`w-full px-4 py-2.5 text-sm bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all duration-200 min-h-[44px] ${
          error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
};

// =========================================================================
// 3. MODAL COMPONENT
// =========================================================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-md bg-zinc-950 border border-zinc-800/80 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden transform animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Swipe-to-Dismiss Indicator */}
        <div className="sm:hidden flex justify-center py-2.5">
          <div className="w-12 h-1 bg-zinc-800 rounded-full" onClick={onClose} />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 text-sm text-zinc-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// 4. TOAST NOTIFICATION COMPONENT & CONTROLLER
// =========================================================================
export interface ToastInfo {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastItemProps {
  toast: ToastInfo;
  onClose: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const typeStyles = {
    info: 'bg-zinc-900 border-zinc-850 text-zinc-100',
    success: 'bg-emerald-950/80 border-emerald-800/50 text-emerald-200 backdrop-blur-md',
    warning: 'bg-amber-950/80 border-amber-800/50 text-amber-200 backdrop-blur-md',
    error: 'bg-rose-950/80 border-rose-800/50 text-rose-200 backdrop-blur-md',
  };

  const icons = {
    info: (
      <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border rounded-xl shadow-lg transition-all duration-300 animate-in slide-in-from-top-4 sm:slide-in-from-bottom-4 duration-300 ${
        typeStyles[toast.type || 'info']
      }`}
    >
      {icons[toast.type || 'info']}
      <span className="text-sm font-medium tracking-wide">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="ml-auto text-zinc-500 hover:text-zinc-300 focus:outline-none"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
