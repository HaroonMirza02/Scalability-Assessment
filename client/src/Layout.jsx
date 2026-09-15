import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout, getUsername } from './api';

export default function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const username = getUsername();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-brand">
                    <Link to="/">Scalability Assessment</Link>

                </div>
                <nav className="header-nav">
                    <Link
                        to="/"
                        className={`nav-link ${isActive('/') ? 'active' : ''}`}
                    >
                        Orders
                    </Link>
                    <Link
                        to="/dashboard"
                        className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                    >
                        Reports
                    </Link>
                    <Link
                        to="/upload"
                        className={`nav-link ${isActive('/upload') ? 'active' : ''}`}
                    >
                        File Storage
                    </Link>
                </nav>
                <div className="header-user">
                    <span className="username">{username || 'User'}</span>
                    <button className="btn-secondary logout-btn" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
            </header>
            <main className="app-main-content">
                {children}
            </main>
            <footer className="app-footer">
                <p>© 2026 Vision71 Production Suite. Built for Scalability and Observability.</p>
            </footer>
        </div>
    );
}
