'use client';

/**
 * Input Component
 * 
 * Reusable input field with label and error state.
 */

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--text-20)] mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted-30)]">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`input ${icon ? 'pl-10' : ''} ${error ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]' : ''
                            } ${className}`}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1 text-sm text-[var(--danger)] animate-fade-in">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
