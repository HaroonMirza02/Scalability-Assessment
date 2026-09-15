import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from './api';

export default function OrderList() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const limit = 10;

    const fetchOrders = async (page) => {
        setLoading(true);
        setErrorMsg('');
        try {
            const data = await request('GET', `/api/orders?page=${page}&limit=${limit}`);
            setOrders(data.orders || []);
            setCurrentPage(data.page || page);
            setTotalPages(data.totalPages || 1);
            setTotalOrders(data.totalOrders || 0);
        } catch (err) {
            setErrorMsg(err.message || 'Failed to retrieve orders. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders(currentPage);
    }, [currentPage]);

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    return (
        <div className="orders-container">
            <div className="page-header">
                <div>
                    <h1>Orders Pipeline</h1>
                    <p className="subtitle">Overview of tracked systems transactions ({totalOrders} total)</p>
                </div>
                <Link to="/orders/create" className="btn-primary">
                    + Create Order
                </Link>
            </div>

            {errorMsg && (
                <div className="message-box error-box margin-bottom-lg">
                    <p>{errorMsg}</p>
                    <button className="btn-secondary btn-sm" onClick={() => fetchOrders(currentPage)}>
                        Retry Query
                    </button>
                </div>
            )}

            {loading ? (
                <div className="skeleton-table">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="skeleton-row">
                            <div className="skeleton-cell w-30"></div>
                            <div className="skeleton-cell w-20"></div>
                            <div className="skeleton-cell w-15"></div>
                            <div className="skeleton-cell w-15"></div>
                            <div className="skeleton-cell w-20"></div>
                        </div>
                    ))}
                </div>
            ) : orders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <h3>No orders recorded</h3>
                    <p>Get started by creating your first transactional log entry.</p>
                    <Link to="/orders/create" className="btn-primary">
                        Create Order
                    </Link>
                </div>
            ) : (
                <>
                    <div className="table-responsive">
                        <table className="orders-table">
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Item Descriptor</th>
                                    <th className="text-right">Price</th>
                                    <th className="text-right">Quantity</th>
                                    <th className="text-right">Total</th>
                                    <th>CC Mask</th>
                                    <th>Timestamp</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => (
                                    <tr
                                        key={order._id}
                                        className="order-row-clickable"
                                        onClick={() => navigate(`/orders/${order._id}`)}
                                    >
                                        <td className="font-weight-600">{order.customerName}</td>
                                        <td>{order.item}</td>
                                        <td className="text-right">${order.price.toFixed(2)}</td>
                                        <td className="text-right">{order.quantity}</td>
                                        <td className="text-right font-weight-600">
                                            ${(order.price * order.quantity).toFixed(2)}
                                        </td>
                                        <td className="text-mono font-size-sm">{order.cardMasked || 'Unavailable'}</td>
                                        <td className="text-secondary font-size-sm">
                                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <span className="link-btn-text">View / Edit</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination-wrapper">
                        <div className="pagination-info">
                            Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({orders.length} items here)
                        </div>
                        <div className="pagination-controls">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loading}
                                className="btn-secondary btn-sm"
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || loading}
                                className="btn-secondary btn-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
