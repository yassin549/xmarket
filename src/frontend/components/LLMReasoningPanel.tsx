'use client';

import { useEffect, useState } from 'react';

interface LLMReasoningPanelProps {
    symbol: string;
}

export default function LLMReasoningPanel({ symbol }: LLMReasoningPanelProps) {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/variables/${symbol}/reasoning`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Failed to fetch reasoning:', error);
            }
        };

        fetchData();
    }, [symbol]);

    if (!data || !data.latest) return null;

    const { latest } = data;
    const confidenceColor = latest.confidence > 0.8 ? 'text-green-400' :
        latest.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mt-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                        🤖 AI Analysis
                        <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded-full">
                            Autonomous
                        </span>
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                        Based on {latest.sources?.length || 0} verified sources
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white">{latest.impactScore}/100</div>
                    <div className="text-xs text-gray-500">Impact Score</div>
                </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-lg mb-4 border border-gray-700">
                <p className="text-gray-300 leading-relaxed text-sm">
                    {latest.reasoning}
                </p>
            </div>

            <div className="flex justify-between items-center text-xs">
                <div className="flex gap-2">
                    {latest.keywords?.map((k: string) => (
                        <span key={k} className="bg-gray-800 text-gray-400 px-2 py-1 rounded">
                            #{k}
                        </span>
                    ))}
                </div>
                <div className={`font-mono ${confidenceColor}`}>
                    Confidence: {(latest.confidence * 100).toFixed(0)}%
                </div>
            </div>

            {latest.sources?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">PRIMARY SOURCES</h4>
                    <ul className="space-y-1">
                        {latest.sources.map((source: string, i: number) => (
                            <li key={i}>
                                <a
                                    href={source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-md"
                                >
                                    {new URL(source).hostname} ↗
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
