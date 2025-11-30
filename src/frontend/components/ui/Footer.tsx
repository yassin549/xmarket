'use client';

/**
 * Footer Component
 * 
 * Site footer with links and branding.
 */

import Link from 'next/link';

export function Footer() {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        Product: [
            { label: 'Markets', href: '/markets' },
            { label: 'Discover', href: '/discover' },
            { label: 'News', href: '/news' },
        ],
        Company: [
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Careers', href: '/careers' },
        ],
        Legal: [
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
        ],
    };

    return (
        <footer className="bg-[var(--bg-00)] border-t border-[var(--glass-border)] pt-16 pb-8">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    {/* Brand */}
                    <div className="col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent-50)] rounded-lg flex items-center justify-center text-white font-bold">
                                X
                            </div>
                            <span className="text-xl font-bold text-white">
                                Xmarket
                            </span>
                        </Link>
                        <p className="text-[var(--muted-30)] text-sm leading-relaxed">
                            The first platform for trading real-world variables using the Three-Chart System. Trade on reality.
                        </p>
                    </div>

                    {/* Links */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category}>
                            <h4 className="font-bold text-white mb-4">{category}</h4>
                            <ul className="space-y-2">
                                {links.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-[var(--muted-30)] hover:text-[var(--primary-50)] text-sm transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-[var(--glass-border)] flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[var(--muted-40)] text-sm">
                        © {currentYear} Xmarket Inc. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        {/* Social Icons could go here */}
                    </div>
                </div>
            </div>
        </footer>
    );
}
