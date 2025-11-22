/**
 * Main App Component
 * ==================
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:symbol" element={<div>Stock Detail (Coming Soon)</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
