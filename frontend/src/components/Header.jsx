import { Link } from 'react-router-dom'
import './Header.css'

function Header({ stocks, selectedStock, onSelectStock }) {
    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <Link to="/" className="logo">
                        <span className="logo-icon">📊</span>
                        <span className="logo-text">Everything Market</span>
                    </Link>

                    {stocks.length > 0 && (
                        <select
                            className="stock-selector"
                            value={selectedStock || ''}
                            onChange={(e) => onSelectStock(e.target.value)}
                        >
                            {stocks.map(stock => (
                                <option key={stock.symbol} value={stock.symbol}>
                                    {stock.symbol} - {stock.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <nav className="header-nav">
                    <Link to="/" className="nav-link">Dashboard</Link>
                    <Link to="/admin" className="nav-link">Admin</Link>
                </nav>
            </div>
        </header>
    )
}

export default Header
