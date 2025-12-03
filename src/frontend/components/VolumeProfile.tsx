'use client';

import { useEffect, useState } from 'react';

interface VolumeProfileProps {
    symbol: string;
}

export default function VolumeProfile({ symbol }: VolumeProfileProps) {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/variables/${symbol}/volume-profile`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Failed to fetch volume profile:', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [symbol]);

    if (!data) return <div className="h-48 animate-pulse bg-gray-800 rounded-lg" />;

    const buyPercentage = (data.buyPressure * 100).toFixed(0);
    const sellPercentage = (100 - parseFloat(buyPercentage)).toFixed(0);

    return (
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm font-medium mb-4">Market Pressure (24h)</h3>

            {/* Pressure Gauge */}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-500 font-bold">{buyPercentage}% Buy</span>
                    <span className="text-red-500 font-bold">{sellPercentage}% Sell</span>
                </div>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                        className="bg-green-500 h-full transition-all duration-500"
                        style={{ width: `${buyPercentage}%` }}
                    />
                    <div
                        className="bg-red-500 h-full transition-all duration-500"
                        style={{ width: `${sellPercentage}%` }}
                    />
                </div>
            </div>

            {/* Trader Counts */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{data.totalBuyers}</div>
                    <div className="text-xs text-gray-400">Unique Buyers</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-white">{data.totalSellers}</div>
                    <div className="text-xs text-gray-400">Unique Sellers</div>
                </div>
            </div>
        </div>
    );
}
