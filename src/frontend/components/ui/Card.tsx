'use client';

/**
 * Card Component
 * 
 * Reusable card for displaying data.
 */

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    variant?: 'solid' | 'glass' | 'elevated';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    hover?: boolean;
    glow?: boolean;
}

export function Card({
    children,
    variant = 'solid',
    size = 'md',
    className = '',
    hover = false,
    glow = false,
}: CardProps) {
    const baseClasses = 'rounded-[var(--radius-lg)] transition-all duration-300 relative overflow-hidden';

    const variantClasses = {
        solid: 'bg-[var(--surface-10)] border border-[var(--glass-border)]',
        glass: 'glass-panel',
        elevated: 'glass-panel-elevated',
    };

    const sizeClasses = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    const hoverClasses = hover
        ? 'hover:bg-[var(--surface-20)] hover:shadow-lg cursor-pointer hover:-translate-y-1'
        : '';

    const glowClasses = glow
        ? 'before:absolute before:inset-0 before:bg-gradient-to-b before:from-[var(--glass-highlight)] before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300'
        : '';

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${hoverClasses} ${glowClasses} ${className}`}
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
