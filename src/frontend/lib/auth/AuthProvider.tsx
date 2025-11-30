'use client';

/**
 * Auth Provider Context
 * 
 * Provides authentication state and methods throughout the application.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    user_id: string;
    email: string;
    role: string;
    display_name?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Fetch current user on mount
    useEffect(() => {
        refreshUser();
    }, []);

    const refreshUser = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include', // Important: include cookies
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (token: string) => {
        // Token is already set as cookie by the API
        // Just refresh the user state
        await refreshUser();
    };

    const logout = async () => {
        // Call logout endpoint to clear cookie
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }

        setUser(null);
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
