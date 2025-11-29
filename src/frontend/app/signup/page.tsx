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

export default function SignupPage() {
    const router = useRouter();
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

            // Store token in localStorage
            localStorage.setItem('auth_token', data.token);

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 px-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Create Account
                        </h1>
                        <p className="text-slate-400">
                            Join Everything Market and start trading
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        {/* Display Name */}
                        <div className="mb-4">
                            <label
                                htmlFor="displayName"
                                className="block text-sm font-medium text-slate-300 mb-2"
                            >
                                Display Name
                            </label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Your name"
                                disabled={loading}
                            />
                        </div>

                        {/* Email */}
                        <div className="mb-4">
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-slate-300 mb-2"
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="you@example.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Password */}
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
                                placeholder="At least 8 characters"
                                required
                                disabled={loading}
                                minLength={8}
                            />
                            <p className="text-slate-500 text-xs mt-1">
                                Must be at least 8 characters
                            </p>
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
                            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-blue-500/50 mb-4"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        {/* Login Link */}
                        <p className="text-center text-slate-400 text-sm">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="text-blue-400 hover:text-blue-300 font-medium transition"
                            >
                                Sign in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
