import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '24px',
                    border: '1px solid var(--color-error)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                    margin: '16px 0',
                    fontFamily: 'var(--font-sans)',
                }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Something went wrong</h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {this.state.error?.message || 'An unexpected rendering error occurred inside this section.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            border: '1px solid var(--color-error)',
                            backgroundColor: 'var(--color-bg-primary)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-error)',
                            cursor: 'pointer',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
