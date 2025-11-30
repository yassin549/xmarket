'use client';

/**
 * Providers Component
 * 
 * Client-side providers wrapper for the application.
 */

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}
