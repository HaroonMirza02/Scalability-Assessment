import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request } from './api';

export default function OrderCreate() {
    const navigate = useNavigate();
    const [customerName, setCustomerName] = useState('');
    const [item, setItem] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [creditCardNumber, setCreditCardNumber] = useState('');

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        // Field checks
        if (!customerName.trim()) return setErrorMsg('Customer name is required.');
        if (!item.trim()) return setErrorMsg('Item description is required.');
        if (!price || isNaN(price) || parseFloat(price) <= 0) return setErrorMsg('Price must be a positive number.');
        if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) return setErrorMsg('Quantity must be an integer greater than 0.');

        setLoading(true);
        try {
            await request('POST', '/api/orders', {
                customerName: customerName.trim(),
                item: item.trim(),
                price: parseFloat(price),
                quantity: parseInt(quantity),
                creditCardNumber: creditCardNumber.trim() || 'Unavailable'
            });
            navigate('/');
        } catch (err) {
            setErrorMsg(err.message || 'Failed to submit order to pipeline.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="orders-container">
            <Link to="/" className="back-link">← Cancel and Back</Link>

            <div className="form-container-boxed">
                <div className="form-header">
                    <h1>Track New Transaction</h1>
                    <p className="subtitle">Enter customer details and purchase data to push to order log pipeline</p>
                </div>

                {errorMsg && (
                    <div className="message-box error-box margin-bottom-lg">
                        <span>{errorMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="entry-form">
                    <div className="form-group">
                        <label htmlFor="customerName">Customer Name</label>
                        <input
                            id="customerName"
                            type="text"
                            placeholder="e.g. John Doe"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="item">Item Name</label>
                        <input
                            id="item"
                            type="text"
                            placeholder="e.g. Wireless Mouse"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label htmlFor="price">Unit Price ($)</label>
                            <input
                                id="price"
                                type="text"
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="quantity">Quantity</label>
                            <input
                                id="quantity"
                                type="number"
                                min="1"
                                step="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="creditCardNumber">Credit Card Number Mock (Optional)</label>
                        <input
                            id="creditCardNumber"
                            type="text"
                            placeholder="e.g. 4111-XXXX-XXXX-1111"
                            value={creditCardNumber}
                            onChange={(e) => setCreditCardNumber(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-actions border-top-divider">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Submitting to pipeline...' : 'Dispatch Order'}
                        </button>
                        <Link to="/" className="btn-secondary text-center">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
