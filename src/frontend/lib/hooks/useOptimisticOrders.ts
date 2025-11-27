/**
 * Optimistic Orders Hook
 * 
 * Manages order submission with optimistic UI updates.
 */

'use client';

import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';

export interface Order {
    order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    price?: number;
    quantity: number;
    status: 'pending' | 'accepted' | 'filled' | 'rejected';
    filled_quantity?: number;
    created_at: Date;
}

export function useOptimisticOrders(symbol: string) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const submitOrder = useCallback(async (orderInput: {
        side: 'buy' | 'sell';
        type: 'limit' | 'market';
        price?: number;
        quantity: number;
    }) => {
        const clientOrderId = uuid();

        // Create optimistic order
        const optimisticOrder: Order = {
            order_id: clientOrderId,
            symbol,
            ...orderInput,
            status: 'pending',
            filled_quantity: 0,
            created_at: new Date(),
        };

        // Add optimistically to state
        setOrders(prev => [optimisticOrder, ...prev]);
        setSubmitting(true);

        try {
            // Submit to API
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    ...orderInput,
                    client_order_id: clientOrderId,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Update with server response
                setOrders(prev => prev.map(order =>
                    order.order_id === clientOrderId
                        ? {
                            ...order,
                            order_id: result.server_order_id,
                            status: result.status,
                            filled_quantity: result.filled_quantity || 0,
                        }
                        : order
                ));

                return { success: true, order_id: result.server_order_id };
            } else {
                // Remove on error
                setOrders(prev => prev.filter(order => order.order_id !== clientOrderId));
                return { success: false, error: result.error };
            }
        } catch (error) {
            // Remove on network error
            setOrders(prev => prev.filter(order => order.order_id !== clientOrderId));
            return { success: false, error: 'Network error' };
        } finally {
            setSubmitting(false);
        }
    }, [symbol]);

    const cancelOrder = useCallback(async (orderId: string) => {
        try {
            const response = await fetch('/api/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, symbol }),
            });

            const result = await response.json();

            if (result.success) {
                setOrders(prev => prev.filter(order => order.order_id !== orderId));
                return { success: true };
            }

            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: 'Network error' };
        }
    }, [symbol]);

    return {
        orders,
        submitOrder,
        cancelOrder,
        submitting,
    };
}
