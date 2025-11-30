'use client';

/**
 * User Signup Page
 * /signup
 * 
 * Email/password registration for new users.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function SignupPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    display_name: displayName
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Signup failed');
                setLoading(false);
                return;
            }

            // Use AuthProvider login method (assuming signup returns token, or auto-login)
            if (data.token) {
                await login(data.token);
                router.push('/dashboard');
            } else {
                // If no token returned, redirect to login
                router.push('/login');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-00)] px-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[var(--primary-50)] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse" />
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-[var(--accent-50)] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <Card variant="glass" className="shadow-2xl border-[var(--glass-border)]">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2 font-display">
                            Create Account
                        </h1>
                        <p className="text-[var(--muted-20)]">
                            Join Everything Market and start trading
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Display Name"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            disabled={loading}
                        />

                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            disabled={loading}
                        />

                        <div>
                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                required
                                disabled={loading}
                                minLength={8}
                            />
                            <p className="text-[var(--muted-30)] text-xs mt-1.5">
                                Must be at least 8 characters
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
                                <p className="text-[var(--danger)] text-sm text-center">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            loading={loading}
                        >
                            Create Account
                        </Button>

                        <p className="text-center text-[var(--muted-30)] text-sm">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="text-[var(--primary-50)] hover:text-[var(--primary-40)] font-medium transition-colors"
                            >
                                Sign in
                            </Link>
                        </p>
                    </form>
                </Card>
            </div>
        </div>
    );
}
