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
        const token = localStorage.getItem('auth_token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            } else {
                // Token is invalid
                localStorage.removeItem('auth_token');
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (token: string) => {
        localStorage.setItem('auth_token', token);
        await refreshUser();
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
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
