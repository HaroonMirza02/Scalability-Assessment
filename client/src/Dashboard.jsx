import React, { useState, useEffect } from 'react';
import { request } from './api';

export default function Dashboard() {
    const [report, setReport] = useState([]);
    const [cpuMs, setCpuMs] = useState(0);
    const [processedAt, setProcessedAt] = useState('');
    const [cached, setCached] = useState(false);

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchReport = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const data = await request('GET', '/api/orders/report/summary');
            setReport(data.report || []);
            setCpuMs(data.cpuDurationMs || 0);
            setProcessedAt(data.processedAt || '');
            setCached(data.cached || false);
        } catch (err) {
            setErrorMsg(err.message || 'The data aggregation engine yielded a timeout or network query error.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const totalCalculatedRevenue = report.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
    const totalCalculatedVolume = report.reduce((sum, item) => sum + (item.totalVolume || 0), 0);

    return (
        <div className="orders-container">
            <div className="page-header">
                <div>
                    <h1>Performance & Query Metrics</h1>
                    <p className="subtitle">Real-time heavy aggregation engine outputs (Cached server-side for 10s)</p>
                </div>
                <button
                    onClick={fetchReport}
                    disabled={loading}
                    className="btn-primary"
                >
                    {loading ? 'Aggregating...' : 'Refresh Metrics'}
                </button>
            </div>

            {errorMsg && (
                <div className="message-box error-box margin-bottom-lg">
                    <p>{errorMsg}</p>
                    <button className="btn-secondary btn-sm" onClick={fetchReport}>
                        Retry Dashboard Pull
                    </button>
                </div>
            )}

            {loading ? (
                <div className="dashboard-skeleton">
                    <div className="skeleton-grid-3">
                        <div className="skeleton-card"></div>
                        <div className="skeleton-card"></div>
                        <div className="skeleton-card"></div>
                    </div>
                    <div className="skeleton-box margin-top-lg h-200"></div>
                </div>
            ) : (
                <>
                    <div className="stats-grid-3">
                        <div className="stat-card">
                            <span className="stat-label">Total Revenue Stream</span>
                            <span className="stat-value">${totalCalculatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="stat-subtext">Sum of all transaction logs in database</span>
                        </div>

                        <div className="stat-card">
                            <span className="stat-label">Units Logged</span>
                            <span className="stat-value">{totalCalculatedVolume.toLocaleString()} units</span>
                            <span className="stat-subtext">Cumulative package count</span>
                        </div>

                        <div className="stat-card">
                            <span className="stat-label">Compute Time</span>
                            <span className="stat-value">{cpuMs.toFixed(2)} ms</span>
                            <span className="stat-subtext">
                                {cached ? (
                                    <span className="badge-success">Cached (L2 Memory hit)</span>
                                ) : (
                                    <span className="badge-alert">Cold (Full Database Scan)</span>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="card margin-top-lg">
                        <div className="card-header border-bottom">
                            <h3>Product Sales Aggregation</h3>
                            <p className="subtitle">Volume, pricing thresholds, and earnings per item class</p>
                        </div>

                        <div className="table-responsive">
                            <table className="orders-table">
                                <thead>
                                    <tr>
                                        <th>Item Class</th>
                                        <th className="text-right">Units Transacted</th>
                                        <th className="text-right">Median Unit Cost</th>
                                        <th className="text-right">Aggregate Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.map((item, idx) => (
                                        <tr key={item._id || idx}>
                                            <td className="font-weight-600">{item._id || 'Unknown Item'}</td>
                                            <td className="text-right">{item.totalVolume?.toLocaleString() || 0}</td>
                                            <td className="text-right">${item.averagePrice?.toFixed(2) || '0.00'}</td>
                                            <td className="text-right font-weight-600">${item.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                                        </tr>
                                    ))}
                                    {report.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="text-center text-secondary">
                                                No category logging exists. Post orders to see sales metrics.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {processedAt && (
                        <div className="last-updated-footer">
                            Data snapshot processed at: <strong>{new Date(processedAt).toLocaleString()}</strong>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
