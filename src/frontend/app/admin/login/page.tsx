'use client';

/**
 * Admin Login Page
 * /admin/login
 * 
 * Password-only authentication for administrators.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Authentication failed');
                setLoading(false);
                return;
            }

            // Cookie is automatically set by the API
            // Just redirect to admin dashboard
            router.push('/admin');
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Admin Access
                        </h1>
                        <p className="text-slate-400">
                            Enter administrator password to continue
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-slate-300 mb-2"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Enter admin password"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-blue-500/50"
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    Administrator access only. Unauthorized access is prohibited.
                </p>
            </div>
        </div>
    );
}
