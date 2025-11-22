/**
 * StockCard Component
 * ===================
 * 
 * Displays:
 * - Final Price (large, prominent)
 * - Reality Score vs Market Price breakdown
 * - Confidence indicator
 * - Price change indicator
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StockCard.css';

export default function StockCard({ symbol, name, data }) {
    const navigate = useNavigate();
    const [priceChange, setPriceChange] = useState(0);
    const [prevPrice, setPrevPrice] = useState(data?.final_price || 50);

    useEffect(() => {
        if (data?.final_price) {
            const change = data.final_price - prevPrice;
            setPriceChange(change);
            setPrevPrice(data.final_price);
        }
    }, [data?.final_price]);

    if (!data) {
        return (
            <div className="stock-card loading">
                <div className="stock-header">
                    <h2>{symbol}</h2>
                    <p className="stock-name">{name}</p>
                </div>
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    const { final_price, reality_score, confidence } = data;
    const changePercent = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
    const isPositive = priceChange >= 0;

    return (
        <div
            className={`stock-card ${isPositive ? 'positive' : 'negative'}`}
            onClick={() => navigate(`/stock/${symbol}`)}
        >
            <div className="stock-header">
                <h2>{symbol}</h2>
                <p className="stock-name">{name}</p>
            </div>

            <div className="price-section">
                <div className="final-price">
                    <span className="price-label">Final Price</span>
                    <span className="price-value">{final_price.toFixed(2)}</span>
                    {priceChange !== 0 && (
                        <span className={`price-change ${isPositive ? 'up' : 'down'}`}>
                            {isPositive ? '↑' : '↓'} {Math.abs(changePercent).toFixed(2)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="breakdown">
                <div className="breakdown-item">
                    <span className="label">Reality Score</span>
                    <span className="value reality">{reality_score.toFixed(1)}</span>
                </div>
                <div className="breakdown-item">
                    <span className="label">Market Price</span>
                    <span className="value market">{data.market_price?.toFixed(1) || 'N/A'}</span>
                </div>
            </div>

            <div className="confidence-bar">
                <div className="confidence-label">
                    <span>Confidence</span>
                    <span>{(confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="confidence-track">
                    <div
                        className="confidence-fill"
                        style={{ width: `${confidence * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
