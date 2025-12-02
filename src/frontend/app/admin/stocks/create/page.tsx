'use client';

/**
 * Admin: Create New Stock/Variable
 * 
 * Form for admins to create new tradable stocks with reality sources configuration.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
    { value: 'tech', label: 'Technology' },
    { value: 'politics', label: 'Politics' },
    { value: 'environment', label: 'Environment' },
    { value: 'economy', label: 'Economy' },
    { value: 'society', label: 'Society' },
    { value: 'culture', label: 'Culture' },
    { value: 'health', label: 'Health' },
    { value: 'energy', label: 'Energy' }
];

interface FormData {
    symbol: string;
    name: string;
    description: string;
    category: string;
    tags: string;  // Comma-separated
    reality_sources: string[];
    impact_keywords: string; // Comma-separated
    llm_context: string;
    initial_value: number;
}

export default function CreateStockPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<FormData>({
        symbol: '',
        name: '',
        description: '',
        category: 'tech',
        tags: '',
        reality_sources: [''],
        impact_keywords: '',
        llm_context: '',
        initial_value: 100
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate reality sources
            const validSources = formData.reality_sources.filter(url => url.trim() !== ' ');
            if (validSources.length === 0) {
                throw new Error('At least one reality source URL is required');
            }

            // Parse tags and keywords
            const tags = formData.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag !== '');

            const impact_keywords = formData.impact_keywords
                .split(',')
                .map(keyword => keyword.trim())
                .filter(keyword => keyword !== '');

            const payload = {
                symbol: formData.symbol.toUpperCase(),
                name: formData.name,
                description: formData.description,
                category: formData.category,
                tags,
                reality_sources: validSources,
                impact_keywords,
                llm_context: formData.llm_context || undefined,
                initial_value: formData.initial_value
            };

            const response = await fetch('/api/admin/variables/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create stock');
            }

            // Success! Redirect to stock list
            router.push('/admin/stocks');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const addRealitySource = () => {
        setFormData({
            ...formData,
            reality_sources: [...formData.reality_sources, '']
        });
    };

    const removeRealitySource = (index: number) => {
        setFormData({
            ...formData,
            reality_sources: formData.reality_sources.filter((_, i) => i !== index)
        });
    };

    const updateRealitySource = (index: number, value: string) => {
        const newSources = [...formData.reality_sources];
        newSources[index] = value;
        setFormData({
            ...formData,
            reality_sources: newSources
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Create New Stock/Variable</h1>
                    <p className="text-gray-600 mt-2">
                        Configure a new tradable stock with reality sources for automated price updates
                    </p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Information */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

                        <div className="space-y-4">
                            {/* Symbol */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Symbol <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="CLIMATE-TEMP"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                                    maxLength={20}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    2-20 characters, uppercase letters, numbers, and hyphens only
                                </p>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Global Average Temperature"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Tracks global temperature trends based on climate data and scientific reports"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tags
                                </label>
                                <input
                                    type="text"
                                    placeholder="climate, weather, global (comma-separated)"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.tags}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                />
                            </div>

                            {/* Initial Value */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Initial Value <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.initial_value}
                                    onChange={(e) => setFormData({ ...formData, initial_value: parseFloat(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Starting price for this stock (default: 100.00)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Reality Engine Configuration - CRITICAL SECTION */}
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-2 text-blue-900">
                            🤖 Reality Engine Configuration
                        </h2>
                        <p className="text-sm text-blue-700 mb-4">
                            Configure URLs to scrape and keywords for AI analysis. The reality engine will update stock prices based on real-world data.
                        </p>

                        <div className="space-y-6">
                            {/* Reality Sources */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reality Sources (URLs to Scrape) <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-600 mb-3">
                                    Add URLs that the AI will scrape for real-world data. Examples: news sites, blogs, research papers, data sources.
                                </p>

                                <div className="space-y-2">
                                    {formData.reality_sources.map((url, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://example.com/news/climate or https://data.source.org/api"
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                value={url}
                                                onChange={(e) => updateRealitySource(index, e.target.value)}
                                            />
                                            {formData.reality_sources.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRealitySource(index)}
                                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addRealitySource}
                                    className="mt-3 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                                >
                                    + Add Another URL
                                </button>
                            </div>

                            {/* Impact Keywords */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Impact Keywords
                                </label>
                                <input
                                    type="text"
                                    placeholder="increase, decrease, record high, crisis, improvement (comma-separated)"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.impact_keywords}
                                    onChange={(e) => setFormData({ ...formData, impact_keywords: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Keywords to guide AI analysis (e.g., "increase" = positive, "crisis" = negative)
                                </p>
                            </div>

                            {/* LLM Context */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    LLM Context (Optional)
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Analyze content to determine if the metric is increasing or decreasing. Positive impact = metric going up. Negative impact = metric going down. Focus on data-driven reports and scientific findings."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={formData.llm_context}
                                    onChange={(e) => setFormData({ ...formData, llm_context: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Additional instructions to help the AI understand how to analyze content for this stock
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                        >
                            {loading ? 'Creating...' : 'Create Stock'}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push('/admin/stocks')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
