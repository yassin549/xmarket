/**
 * OrderForm Component
 * 
 * Form for placing buy/sell orders with optimistic UI.
 */

'use client';

import { useState } from 'react';

interface OrderFormProps {
    symbol: string;
    onSubmit?: (order: { side: 'buy' | 'sell'; price: number; quantity: number }) => void;
}

export default function OrderForm({ symbol, onSubmit }: OrderFormProps) {
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const orderData = {
                side,
                type: orderType,
                price: orderType === 'limit' ? parseFloat(price) : undefined,
                quantity: parseFloat(quantity),
            };

            if (onSubmit) {
                onSubmit(orderData as any);
            } else {
                // Default: send to API
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol,
                        ...orderData,
                    }),
                });

                const result = await response.json();

                if (result.success) {
                    // Reset form
                    setPrice('');
                    setQuantity('');
                    alert('Order placed successfully!');
                } else {
                    alert(`Order failed: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Failed to place order:', error);
            alert('Network error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Place Order</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Side Selection */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setSide('buy')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${side === 'buy'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Buy
                    </button>
                    <button
                        type="button"
                        onClick={() => setSide('sell')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${side === 'sell'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Sell
                    </button>
                </div>

                {/* Order Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order Type
                    </label>
                    <select
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as 'limit' | 'market')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="limit">Limit</option>
                        <option value="market">Market</option>
                    </select>
                </div>

                {/* Price (for limit orders) */}
                {orderType === 'limit' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price ($)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                        />
                    </div>
                )}

                {/* Quantity */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity
                    </label>
                    <input
                        type="number"
                        step="0.0001"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${side === 'buy'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {submitting ? 'Placing Order...' : `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
                </button>
            </form>
        </div>
    );
}
