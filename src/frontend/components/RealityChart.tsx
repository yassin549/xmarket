'use client';

import { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface RealityChartProps {
    symbol: string;
    range: '1h' | '24h' | '7d' | '30d';
}

export default function RealityChart({ symbol, range }: RealityChartProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/variables/${symbol}/history?range=${range}`);
                const json = await res.json();

                if (json.history) {
                    setData({
                        labels: json.history.map((h: any) =>
                            new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        ),
                        datasets: [
                            {
                                label: 'Reality Value',
                                data: json.history.map((h: any) => h.value),
                                borderColor: '#3b82f6', // Blue-500
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                fill: true,
                                tension: 0.4,
                                pointRadius: 0,
                                pointHoverRadius: 4
                            }
                        ]
                    });
                }
            } catch (error) {
                console.error('Failed to fetch chart data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [symbol, range]);

    if (loading) return <div className="h-64 animate-pulse bg-gray-800 rounded-lg" />;
    if (!data) return <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>;

    return (
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-400 text-sm font-medium">Reality Engine Value</h3>
                <div className="flex gap-2">
                    {['1h', '24h', '7d'].map((r) => (
                        <span
                            key={r}
                            className={`text-xs px-2 py-1 rounded cursor-pointer ${range === r ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {r.toUpperCase()}
                        </span>
                    ))}
                </div>
            </div>
            <div className="h-64">
                <Line
                    data={data}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: '#1f2937',
                                titleColor: '#9ca3af',
                                bodyColor: '#fff',
                                borderColor: '#374151',
                                borderWidth: 1
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false, color: '#374151' },
                                ticks: { color: '#6b7280', maxTicksLimit: 6 }
                            },
                            y: {
                                grid: { color: '#374151' },
                                ticks: { color: '#6b7280' }
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        }
                    }}
                />
            </div>
        </div>
    );
}
