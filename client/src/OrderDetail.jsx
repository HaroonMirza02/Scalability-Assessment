import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { request } from './api';

export default function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [item, setItem] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [creditCardNumber, setCreditCardNumber] = useState('');
    const [createdAt, setCreatedAt] = useState('');

    const [errorMsg, setErrorMsg] = useState('');
    const [infoMsg, setInfoMsg] = useState('');

    const fetchOrderDetail = async () => {
        setLoading(true);
        setErrorMsg('');
        setInfoMsg('');
        try {
            const data = await request('GET', `/api/orders/${id}`);
            setCustomerName(data.customerName || '');
            setItem(data.item || '');
            setPrice(data.price?.toString() || '');
            setQuantity(data.quantity?.toString() || '');
            setCreditCardNumber(data.creditCardNumber || '');
            setCreatedAt(data.createdAt || '');
        } catch (err) {
            setErrorMsg(err.message || 'Could not fetch order specifications.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderDetail();
    }, [id]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setInfoMsg('');

        // Pre-submit validation
        if (!customerName.trim()) return setErrorMsg('Customer name is required.');
        if (!item.trim()) return setErrorMsg('Item description is required.');
        if (isNaN(price) || parseFloat(price) <= 0) return setErrorMsg('Price must be a positive number.');
        if (isNaN(quantity) || parseInt(quantity) <= 0) return setErrorMsg('Quantity must be an integer > 0.');

        setSaving(true);
        try {
            const response = await request('PUT', `/api/orders/${id}`, {
                customerName: customerName.trim(),
                item: item.trim(),
                price: parseFloat(price),
                quantity: parseInt(quantity),
                creditCardNumber: creditCardNumber.trim() || 'Unavailable'
            });

            // Show confirmation immediately since our API does not support fake optimistic UI. We show exact values confirming server state.
            setCustomerName(response.customerName);
            setItem(response.item);
            setPrice(response.price?.toString());
            setQuantity(response.quantity?.toString());
            setCreditCardNumber(response.creditCardNumber);

            setInfoMsg('Order state saved and confirmed on server. Note: If another user modified this record concurrently, yours might overwrite their changes (last-write-wins policy is active at the DB tier).');
        } catch (err) {
            setErrorMsg(`Save Failed: ${err.message}. Do not assume this update succeeded.`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this order? This action is irreversible.')) {
            return;
        }

        setDeleting(true);
        setErrorMsg('');
        setInfoMsg('');
        try {
            await request('DELETE', `/api/orders/${id}`);
            navigate('/');
        } catch (err) {
            setErrorMsg(`Delete Failed: ${err.message}. The document may still exist.`);
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="orders-container">
                <Link to="/" className="back-link">← Back to pipeline</Link>
                <div className="skeleton-detail">
                    <div className="skeleton-title w-40"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line w-60"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="orders-container">
            <Link to="/" className="back-link">← Back to Pipeline</Link>

            <div className="detail-layout">
                <div className="detail-details-pane">
                    <div className="page-header justify-start gap-4">
                        <div>
                            <h1>Order #{id.slice(-6).toUpperCase()}</h1>
                            <p className="subtitle">Registered on {new Date(createdAt).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="concurrency-warning-banner">
                        <strong>⚠️ Concurrency Policy Notice:</strong> This database uses a direct <em>Last-Write-Wins</em> transaction policy. Concurrent updates will overwrite silently. Refresh this page to ensure you are viewing the absolute latest server-side representation prior to saving.
                    </div>

                    {errorMsg && (
                        <div className="message-box error-box margin-bottom-lg">
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {infoMsg && (
                        <div className="message-box success-box margin-bottom-lg">
                            <span>{infoMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className="detail-form">
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label htmlFor="customerName">Customer Name</label>
                                <input
                                    id="customerName"
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    disabled={saving || deleting}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="item">Item Description</label>
                                <input
                                    id="item"
                                    type="text"
                                    value={item}
                                    onChange={(e) => setItem(e.target.value)}
                                    disabled={saving || deleting}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="price">Price ($)</label>
                                <input
                                    id="price"
                                    type="text"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    disabled={saving || deleting}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="quantity">Quantity</label>
                                <input
                                    id="quantity"
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    disabled={saving || deleting}
                                />
                            </div>

                            <div className="form-group full-width">
                                <label htmlFor="creditCardNumber">Credit Card Number Mock</label>
                                <input
                                    id="creditCardNumber"
                                    type="text"
                                    value={creditCardNumber}
                                    onChange={(e) => setCreditCardNumber(e.target.value)}
                                    disabled={saving || deleting}
                                />
                            </div>
                        </div>

                        <div className="form-actions-wrapper">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={saving || deleting}
                            >
                                {saving ? 'Saving changes...' : 'Save Updates'}
                            </button>

                            <button
                                type="button"
                                className="btn-secondary danger-btn"
                                onClick={handleDelete}
                                disabled={saving || deleting}
                            >
                                {deleting ? 'Deleting...' : 'Delete Order'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
