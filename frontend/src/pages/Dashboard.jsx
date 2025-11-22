/**
 * Dashboard Page
 * ==============
 * 
 * Main landing page showing all stocks in a grid.
 */

import { useState, useEffect } from 'react';
import StockCard from '../components/StockCard';
import { fetchStocks, fetchScore, fetchMarketPressure } from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
    const [stocks, setStocks] = useState([]);
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load stocks on mount
    useEffect(() => {
        loadStocks();
        // Refresh every 10 seconds
        const interval = setInterval(loadStocks, 10000);
        return () => clearInterval(interval);
    }, []);

    async function loadStocks() {
        try {
            // For MVP, we'll use mock data or create helper endpoints
            // In production, backend should provide GET /api/v1/stocks

            // For now, load hardcoded stocks from localStorage or create defaults
            const mockStocks = JSON.parse(localStorage.getItem('stocks') || '[]');

            if (mockStocks.length === 0) {
                // Default stocks for testing
                const defaults = [
                    { symbol: 'TECH', name: 'Technology Sector', market_weight: 0.6, reality_weight: 0.4 },
                    { symbol: 'CLIMATE', name: 'Climate & Environment', market_weight: 0.5, reality_weight: 0.5 },
                    { symbol: 'HEALTH', name: 'Healthcare', market_weight: 0.7, reality_weight: 0.3 },
                ];
                setStocks(defaults);

                // Load scores for each
                for (const stock of defaults) {
                    await loadScoreForStock(stock.symbol);
                }
            } else {
                setStocks(mockStocks);
                for (const stock of mockStocks) {
                    await loadScoreForStock(stock.symbol);
                }
            }

            setLoading(false);
        } catch (err) {
            console.error('Failed to load stocks:', err);
            setError(err.message);
            setLoading(false);
        }
    }

    async function loadScoreForStock(symbol) {
        try {
            // Try to fetch from backend
            const score = await fetchScore(symbol);
            const pressure = await fetchMarketPressure(symbol);

            setScores(prev => ({
                ...prev,
                [symbol]: {
                    ...score,
                    market_price: pressure.market_price
                }
            }));
        } catch (err) {
            console.warn(`Failed to load score for ${symbol}:`, err);
            // Use mock data
            setScores(prev => ({
                ...prev,
                [symbol]: {
                    reality_score: 50 + Math.random() * 20 - 10,
                    final_price: 50 + Math.random() * 20 - 10,
                    market_price: 50 + Math.random() * 20 - 10,
                    confidence: 0.5 + Math.random() * 0.3
                }
            }));
        }
    }

    if (loading) {
        return (
            <div className="dashboard loading-state">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading stocks...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard error-state">
                <div className="error-message">
                    <h2>⚠️ Error</h2>
                    <p>{error}</p>
                    <button onClick={loadStocks}>Retry</button>
                </div>
            </div>
        );
    }

    if (stocks.length === 0) {
        return (
            <div className="dashboard empty-state">
                <div className="empty-message">
                    <h2>No Stocks Available</h2>
                    <p>Create stocks using the admin CLI:</p>
                    <pre>
                        python scripts/admin_cli.py create-stock TECH "Technology" --weights 0.6 0.4
                    </pre>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Everything Market</h1>
                <p className="subtitle">Reality-Powered Prediction Markets</p>
            </header>

            <div className="stocks-grid">
                {stocks.map(stock => (
                    <StockCard
                        key={stock.symbol}
                        symbol={stock.symbol}
                        name={stock.name}
                        data={scores[stock.symbol]}
                    />
                ))}
            </div>

            <div className="dashboard-footer">
                <p>Updated every 10 seconds • {stocks.length} stocks active</p>
            </div>
        </div>
    );
}
