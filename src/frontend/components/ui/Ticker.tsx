'use client';

/**
 * Ticker Component
 * 
 * Scrolling ticker strip for displaying live market data.
 */

import { useEffect, useRef } from 'react';

interface TickerItem {
    symbol: string;
    shortLabel: string;
    changePct: number;
    state: 'up' | 'down' | 'neutral';
}

interface TickerProps {
    items: TickerItem[];
    speed?: number; // pixels per second
}

export function Ticker({ items, speed = 50 }: TickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const scroll = scrollRef.current;
        if (!container || !scroll) return;

        let animationId: number;
        let scrollPosition = 0;
        const scrollWidth = scroll.scrollWidth / 2; // We duplicate items, so divide by 2

        const animate = () => {
            scrollPosition += speed / 60; // 60fps
            if (scrollPosition >= scrollWidth) {
                scrollPosition = 0;
            }
            if (scroll) {
                scroll.style.transform = `translateX(-${scrollPosition}px)`;
            }
            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => cancelAnimationFrame(animationId);
    }, [items, speed]);

    // Duplicate items for seamless loop
    const duplicatedItems = [...items, ...items];

    return (
        <div
            ref={containerRef}
            className="overflow-hidden bg-[var(--surface-10)] border-y border-[var(--glass-border)] py-2"
        >
            <div ref={scrollRef} className="flex gap-8 whitespace-nowrap">
                {duplicatedItems.map((item, index) => (
                    <div
                        key={`${item.symbol}-${index}`}
                        className="inline-flex items-center gap-2 px-4"
                    >
                        <span className="font-semibold text-[var(--text-10)]">
                            {item.symbol}
                        </span>
                        <span className="text-sm text-[var(--muted-20)]">
                            {item.shortLabel}
                        </span>
                        <span
                            className={`text-sm font-medium ${item.state === 'up'
                                    ? 'text-[var(--success)]'
                                    : item.state === 'down'
                                        ? 'text-[var(--danger)]'
                                        : 'text-[var(--muted-20)]'
                                }`}
                        >
                            {item.state === 'up' && '▲'}
                            {item.state === 'down' && '▼'}
                            {item.changePct.toFixed(2)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
