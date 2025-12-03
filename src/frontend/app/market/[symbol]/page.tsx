'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import RealityChart from '@/components/RealityChart';
import VolumeProfile from '@/components/VolumeProfile';
import LLMReasoningPanel from '@/components/LLMReasoningPanel';

export default function MarketPage() {
    const params = useParams();
    const symbol = params.symbol as string;
    const [range, setRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
    const [variable, setVariable] = useState<any>(null);

    useEffect(() => {
        // Fetch basic variable info
        fetch(`/api/variables/${symbol}/history?range=24h`)
            .then(res => res.json())
            .then(data => {
                if (data.variable) setVariable(data.variable);
            })
            .catch(console.error);
    }, [symbol]);

    if (!variable) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">{variable.name}</h1>
                        <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wider">
                            {variable.category}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-4">
                        <span className="text-4xl font-bold text-blue-500">
                            {variable.currentValue.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-sm">Reality Engine Value</span>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Chart & Analysis (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">
                        <RealityChart symbol={symbol} range={range} />
                        <LLMReasoningPanel symbol={symbol} />
                    </div>

                    {/* Right Column: Market Data (1/3 width) */}
                    <div className="space-y-6">
                        <VolumeProfile symbol={symbol} />

                        {/* Market Rules / Info */}
                        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                            <h3 className="text-gray-400 text-sm font-medium mb-4">Market Rules</h3>
                            <ul className="space-y-3 text-sm text-gray-300">
                                <li className="flex gap-2">
                                    <span className="text-blue-500">•</span>
                                    Updates autonomously 3x daily
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500">•</span>
                                    AI analyzes global news sources
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500">•</span>
                                    Impact score determines value change
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500">•</span>
                                    Trading allowed 24/7
                                </li>
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
