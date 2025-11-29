/**
 * Footer Component
 * 
 * Site footer with links and legal information.
 */

import Link from 'next/link';

export function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-[var(--surface-10)] border-t border-[var(--glass-border)] mt-20">
            <div className="container mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent-30)] rounded-lg" />
                            <span className="text-lg font-bold text-[var(--text-10)]">
                                Everything Market
                            </span>
                        </div>
                        <p className="text-sm text-[var(--muted-20)]">
                            Trade on reality. The first platform for trading real-world variables.
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h3 className="font-semibold text-[var(--text-10)] mb-4">Product</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/discover" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Discover
                                </Link>
                            </li>
                            <li>
                                <Link href="/markets" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Markets
                                </Link>
                            </li>
                            <li>
                                <Link href="/how-it-works" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    How It Works
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h3 className="font-semibold text-[var(--text-10)] mb-4">Company</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/about" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    About
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Contact
                                </Link>
                            </li>
                            <li>
                                <Link href="/blog" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Blog
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="font-semibold text-[var(--text-10)] mb-4">Legal</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/privacy" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-sm text-[var(--muted-20)] hover:text-[var(--text-10)] transition-colors">
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                    <p className="text-sm text-center text-[var(--muted-30)]">
                        © {currentYear} Everything Market. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
