'use client';

/**
 * Input Component
 * 
 * Reusable input field with validation states.
 */

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--text-20)] mb-2">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
            w-full px-4 py-3 
            bg-[var(--surface-10)] 
            border ${error ? 'border-[var(--danger)]' : 'border-[var(--glass-border)]'}
            rounded-lg 
            text-[var(--text-10)] 
            placeholder-[var(--muted-30)]
            focus:outline-none 
            focus:ring-2 
            ${error ? 'focus:ring-[var(--danger)]' : 'focus:ring-[var(--primary-50)]'}
            focus:border-transparent
            transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1 text-sm text-[var(--muted-30)]">{helperText}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
