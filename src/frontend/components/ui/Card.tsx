'use client';

/**
 * Card Component
 * 
 * Reusable card for displaying data.
 */

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    variant?: 'solid' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    hover?: boolean;
}

export function Card({
    children,
    variant = 'solid',
    size = 'md',
    className = '',
    hover = false,
}: CardProps) {
    const baseClasses = 'rounded-xl transition-all';

    const variantClasses = {
        solid: 'bg-[var(--surface-10)] border border-[var(--glass-border)]',
        glass: 'bg-[var(--glass-01)] backdrop-blur-lg border border-[var(--glass-border)]',
    };

    const sizeClasses = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    const hoverClasses = hover
        ? 'hover:bg-[var(--surface-20)] hover:shadow-lg cursor-pointer'
        : '';

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${hoverClasses} ${className}`}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
    return (
        <div className={`mb-4 ${className}`}>
            {children}
        </div>
    );
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
    return (
        <h3 className={`text-xl font-bold text-[var(--text-10)] ${className}`}>
            {children}
        </h3>
    );
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
    return (
        <div className={className}>
            {children}
        </div>
    );
}
