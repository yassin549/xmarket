'use client';

/**
 * Chart Component
 * 
 * Wrapper for charts with controls and loading states.
 */

import { ReactNode } from 'react';

interface ChartProps {
    title?: string;
    children: ReactNode;
    loading?: boolean;
    error?: string;
    controls?: ReactNode;
    className?: string;
}

export function Chart({
    title,
    children,
    loading,
    error,
    controls,
    className = '',
}: ChartProps) {
    return (
        <div className={`bg-[var(--surface-10)] border border-[var(--glass-border)] rounded-xl p-6 ${className}`}>
            {/* Header */}
            {(title || controls) && (
                <div className="flex items-center justify-between mb-6">
                    {title && (
                        <h3 className="text-lg font-semibold text-[var(--text-10)]">
                            {title}
                        </h3>
                    )}
                    {controls && <div className="flex gap-2">{controls}</div>}
                </div>
            )}

            {/* Content */}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-10)]/80 backdrop-blur-sm rounded-lg z-10">
                        <div className="flex items-center gap-2">
                            <svg
                                className="animate-spin h-5 w-5 text-[var(--primary-50)]"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            <span className="text-sm text-[var(--muted-20)]">Loading chart...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="py-12 text-center">
                        <p className="text-[var(--danger)]">{error}</p>
                    </div>
                )}

                {!error && children}
            </div>
        </div>
    );
}
