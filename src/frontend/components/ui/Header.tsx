'use client';

/**
 * Header Component
 * 
 * Main navigation header with user menu.
 */

import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from './Button';

export function Header() {
    const { user, logout } = useAuth();

    return (
        <header className="sticky top-0 z-50 bg-[var(--surface-10)]/90 backdrop-blur-lg border-b border-[var(--glass-border)]">
            <div className="container mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent-30)] rounded-lg" />
                        <span className="text-xl font-bold text-gradient">
                            Everything Market
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link
                            href="/discover"
                            className="text-[var(--text-20)] hover:text-[var(--text-10)] transition-colors"
                        >
                            Discover
                        </Link>
                        <Link
                            href="/markets"
                            className="text-[var(--text-20)] hover:text-[var(--text-10)] transition-colors"
                        >
                            Markets
                        </Link>
                        {user && (
                            <Link
                                href="/dashboard"
                                className="text-[var(--text-20)] hover:text-[var(--text-10)] transition-colors"
                            >
                                Dashboard
                            </Link>
                        )}
                        {user?.role === 'admin' || user?.role === 'super-admin' ? (
                            <Link
                                href="/admin"
                                className="text-[var(--text-20)] hover:text-[var(--text-10)] transition-colors"
                            >
                                Admin
                            </Link>
                        ) : null}
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                <span className="text-sm text-[var(--muted-20)] hidden md:block">
                                    {user.display_name || user.email}
                                </span>
                                <Button variant="ghost" size="sm" onClick={logout}>
                                    Sign Out
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login">
                                    <Button variant="ghost" size="sm">
                                        Sign In
                                    </Button>
                                </Link>
                                <Link href="/signup">
                                    <Button variant="primary" size="sm">
                                        Sign Up
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
