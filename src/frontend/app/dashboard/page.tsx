'use client';

/**
 * User Dashboard Page
 * /dashboard
 * 
 * Main dashboard for authenticated users.
 */

import { useAuth } from '@/lib/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export default function DashboardPage() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-00)]">
                <div className="text-[var(--text-20)]">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null; // Middleware will redirect
    }

    return (
        <div className="min-h-screen bg-[var(--bg-00)] py-8">
            <div className="container mx-auto px-6">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Welcome back, {user.display_name || user.email}!
                    </h1>
                    <p className="text-[var(--muted-20)]">
                        Your Xmarket dashboard
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card variant="glass">
                        <h3 className="text-xl font-bold text-white mb-2">Markets</h3>
                        <p className="text-[var(--muted-30)] mb-4">
                            Explore and trade on real-world events
                        </p>
                        <Link
                            href="/discover"
                            className="text-[var(--primary-50)] hover:text-[var(--primary-40)] font-medium"
                        >
                            Browse Markets →
                        </Link>
                    </Card>

                    <Card variant="glass">
                        <h3 className="text-xl font-bold text-white mb-2">Your Portfolio</h3>
                        <p className="text-[var(--muted-30)] mb-4">
                            View your positions and performance
                        </p>
                        <span className="text-[var(--muted-40)] text-sm">
                            Coming soon
                        </span>
                    </Card>

                    <Card variant="glass">
                        <h3 className="text-xl font-bold text-white mb-2">Orders</h3>
                        <p className="text-[var(--muted-30)] mb-4">
                            Manage your active and historical orders
                        </p>
                        <span className="text-[var(--muted-40)] text-sm">
                            Coming soon
                        </span>
                    </Card>
                </div>

                <div className="mt-8">
                    <Card variant="glass">
                        <h3 className="text-xl font-bold text-white mb-4">Account Information</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-30)]">Email:</span>
                                <span className="text-white">{user.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-30)]">Role:</span>
                                <span className="text-white capitalize">{user.role}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-30)]">User ID:</span>
                                <span className="text-white font-mono text-xs">{user.user_id}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
