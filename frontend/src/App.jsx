import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Copilot from './pages/Copilot';
import Dashboard from './pages/Dashboard';
import './App.css';

function Nav() {
  const location = useLocation();
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="mark">☕</span> BrewMatic
      </div>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Copilot
        </Link>
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
          Dashboard
        </Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Copilot />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;