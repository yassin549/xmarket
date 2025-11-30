'use client';

/**
 * Header Component
 * 
 * Main navigation header with user menu.
 */

import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from './Button';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Header() {
    const { user, logout } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { href: '/discover', label: 'Discover' },
        { href: '/markets', label: 'Markets' },
        { href: '/news', label: 'News' },
    ];

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[var(--bg-05)]/80 backdrop-blur-md border-b border-[var(--glass-border)]' : 'bg-transparent'
                }`}
        >
            <div className="container mx-auto px-6">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent-50)] rounded-xl shadow-[0_0_20px_var(--primary-glow)] group-hover:shadow-[0_0_30px_var(--primary-glow)] transition-all duration-300 flex items-center justify-center text-white font-bold text-xl">
                            X
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">
                            Xmarket
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium transition-colors hover:text-[var(--primary-50)] ${pathname === link.href ? 'text-[var(--primary-50)]' : 'text-[var(--text-20)]'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        {user && (
                            <Link
                                href="/dashboard"
                                className={`text-sm font-medium transition-colors hover:text-[var(--primary-50)] ${pathname === '/dashboard' ? 'text-[var(--primary-50)]' : 'text-[var(--text-20)]'
                                    }`}
                            >
                                Dashboard
                            </Link>
                        )}
                        {user?.role === 'admin' || user?.role === 'super-admin' ? (
                            <Link
                                href="/admin"
                                className={`text-sm font-medium transition-colors hover:text-[var(--primary-50)] ${pathname === '/admin' ? 'text-[var(--primary-50)]' : 'text-[var(--text-20)]'
                                    }`}
                            >
                                Admin
                            </Link>
                        ) : null}
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-[var(--muted-20)] hidden lg:block">
                                    {user.display_name || user.email}
                                </span>
                                <Button variant="ghost" size="sm" onClick={logout}>
                                    Sign Out
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link href="/login">
                                    <Button variant="ghost" size="sm">
                                        Sign In
                                    </Button>
                                </Link>
                                <Link href="/signup">
                                    <Button variant="primary" size="sm" className="shadow-[0_0_15px_var(--primary-glow)]">
                                        Get Started
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
