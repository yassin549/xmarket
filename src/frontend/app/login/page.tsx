'use client';

/**
 * User Login Page
 * /login
 * 
 * Email/password authentication for regular users.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Login failed');
                setLoading(false);
                return;
            }

            // Use AuthProvider login method with user data from response
            await login(data.token, data.user);

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-00)] px-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--primary-50)] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent-50)] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse delay-1000" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <Card variant="glass" className="shadow-2xl border-[var(--glass-border)]">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2 font-display">
                            Welcome Back
                        </h1>
                        <p className="text-[var(--muted-20)]">
                            Sign in to your Everything Market account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            disabled={loading}
                        />

                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            disabled={loading}
                        />

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
                            Sign In
                        </Button>

                        <p className="text-center text-[var(--muted-30)] text-sm">
                            Don't have an account?{' '}
                            <Link
                                href="/signup"
                                className="text-[var(--primary-50)] hover:text-[var(--primary-40)] font-medium transition-colors"
                            >
                                Sign up
                            </Link>
                        </p>
                    </form>
                </Card>
            </div>
        </div>
    );
}
