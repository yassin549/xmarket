'use client';

/**
 * Admin: Stock Management Dashboard
 * 
 * List and manage all stocks/variables
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Variable {
    variable_id: string;
    symbol: string;
    name: string;
    category: string;
    status: string;
    reality_value: number;
    last_reality_update: string | null;
    created_at: string;
}

export default function StocksManagementPage() {
    const router = useRouter();
    const [variables, setVariables] = useState<Variable[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');

    const fetchVariables = async () => {
        try {
            setLoading(true);
            const url = filter === 'all'
                ? '/api/admin/variables'
                : `/api/admin/variables?status=${filter}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                setVariables(data.variables);
            } else {
                setError(data.error || 'Failed to fetch stocks');
            }
        } catch (err) {
            setError('Network error');
            console.error('Error fetching stocks:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVariables();
    }, [filter]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'paused': return 'bg-yellow-100 text-yellow-800';
            case 'delisted': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
                        <p className="text-gray-600 mt-2">Manage stocks and reality engine configuration</p>
                    </div>

                    <button
                        onClick={() => router.push('/admin/stocks/create')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        + Create New Stock
                    </button>
                </div>

                {/* Filters */}
                <div className="mb-6 flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg font-medium ${filter === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilter('paused')}
                        className={`px-4 py-2 rounded-lg font-medium ${filter === 'paused' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                    >
                        Paused
                    </button>
                    <button
                        onClick={() => setFilter('delisted')}
                        className={`px-4 py-2 rounded-lg font-medium ${filter === 'delisted' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                    >
                        Delisted
                    </button>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Loading stocks...</p>
                    </div>
                )}

                {/* Table */}
                {!loading && !error && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        {variables.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">No stocks found</p>
                                <button
                                    onClick={() => router.push('/admin/stocks/create')}
                                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create First Stock
                                </button>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Symbol
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Category
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Reality Value
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Last Update
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {variables.map((variable) => (
                                        <tr key={variable.variable_id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono font-semibold text-gray-900">
                                                    {variable.symbol}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{variable.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                                    {variable.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(variable.status)}`}>
                                                    {variable.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-gray-900">
                                                    ${variable.reality_value?.toFixed(2) || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(variable.last_reality_update)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => router.push(`/admin/stocks/edit/${variable.variable_id}`)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
