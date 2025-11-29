import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { requireAnyAuth } from '@/lib/middleware/requireAuth';

/**
 * POST /api/orders
 * 
 * Place a new order to the orderbook service.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
    // Require authentication
    const authResult = await requireAnyAuth(request);
    if (authResult.error) {
        return authResult.response;
    }

    const user_id = authResult.session!.user_id;

    try {
        const body = await request.json();
        const { symbol, side, type, price, quantity, client_order_id } = body;

        // Validate input
        if (!symbol || !side || !type || !quantity) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Forward to orderbook service
        const orderbook_url = process.env.ORDERBOOK_URL || 'http://localhost:3001';
        const response = await fetch(`${orderbook_url}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: client_order_id || uuid(),
                user_id,
                symbol,
                side,
                type,
                price,
                quantity,
            }),
        });

        const result = await response.json();

        return NextResponse.json({
            success: true,
            server_order_id: result.server_order_id,
            status: result.status,
            filled_quantity: result.matched ? quantity : 0,
            trades: result.trades,
        });
    } catch (error) {
        console.error('Error placing order:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to place order' },
            { status: 500 }
        );
    }
}
