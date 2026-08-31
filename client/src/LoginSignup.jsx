import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, setAuthToken, setUsername, getAuthToken } from './api';

export default function LoginSignup() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setFormUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorCode, setErrorCode] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Check if already authenticated on initial load
    React.useEffect(() => {
        if (getAuthToken()) {
            navigate('/');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorCode('');
        setSuccessMsg('');

        // Client-side validations
        if (!username.trim() || username.length < 3) {
            setErrorCode('Username must be at least 3 characters long.');
            return;
        }
        if (!password || password.length < 5) {
            setErrorCode('Password must be at least 5 characters long.');
            return;
        }

        setLoading(true);
        const path = isLogin ? '/api/auth/login' : '/api/auth/signup';

        try {
            const response = await request('POST', path, { username: username.trim(), password });

            if (isLogin) {
                setAuthToken(response.token);
                setUsername(username.trim());
                window.dispatchEvent(new Event('auth-status-change'));
                navigate('/');
            } else {
                setSuccessMsg('Account created successfully! You can now log in.');
                setIsLogin(true);
                setPassword('');
            }
        } catch (err) {
            setErrorCode(err.message || 'Authentication failed. Please check your credentials and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <div className="auth-header">
                    <h2>{isLogin ? 'Welcome back' : 'Create an account'}</h2>
                    <p>{isLogin ? 'Sign in to access your dashboard' : 'Join Vision71 scalability sandbox'}</p>
                </div>

                {errorCode && (
                    <div className="message-box error-box">
                        <span>{errorCode}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="message-box success-box">
                        <span>{successMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            placeholder="e.g. testuser"
                            value={username}
                            onChange={(e) => setFormUsername(e.target.value)}
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <div className="auth-footer">
                    {isLogin ? (
                        <p>
                            New here?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => { setIsLogin(false); setErrorCode(''); }}
                                disabled={loading}
                            >
                                Create an account
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => { setIsLogin(true); setErrorCode(''); }}
                                disabled={loading}
                            >
                                Sign in
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
