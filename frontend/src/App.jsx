import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/AdminPanel'
import Header from './components/Header'
import './App.css'

function App() {
    const [stocks, setStocks] = useState([])
    const [selectedStock, setSelectedStock] = useState(null)

    useEffect(() => {
        // Fetch available stocks
        fetch('/api/v1/stocks')
            .then(res => res.json())
            .then(data => {
                setStocks(data)
                if (data.length > 0) {
                    setSelectedStock(data[0].symbol)
                }
            })
            .catch(err => console.error('Error fetching stocks:', err))
    }, [])

    return (
        <Router>
            <div className="app">
                <Header
                    stocks={stocks}
                    selectedStock={selectedStock}
                    onSelectStock={setSelectedStock}
                />

                <main className="main-content">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Dashboard
                                    selectedStock={selectedStock}
                                    stocks={stocks}
                                />
                            }
                        />
                        <Route path="/admin" element={<AdminPanel />} />
                    </Routes>
                </main>
            </div>
        </Router>
    )
}

export default App
