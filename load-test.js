import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    // Default options, can be overridden by CLI args
    vus: 10,
    duration: '10s',
};

// Login once at setup
export function setup() {
    const loginUrl = 'http://localhost:3000/api/auth/login';
    const payload = JSON.stringify({
        username: 'testuser',
        password: 'password123',
    });
    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    const res = http.post(loginUrl, payload, params);
    const token = res.json().token;
    if (!token) {
        throw new Error('JWT token is missing, login failed: ' + res.body);
    }
    return { token: token };
}

export default function (data) {
    const token = data.token;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const rand = Math.random();

    if (rand < 0.60) {
        // 60% Read-heavy: paginated orders list
        const page = Math.floor(Math.random() * 50) + 1;
        const res = http.get(`http://localhost:3000/api/orders?page=${page}&limit=20`, { headers });
        check(res, {
            'read: code is 200': (r) => r.status === 200,
            'read: has orders': (r) => r.json().orders !== undefined
        });
    } else if (rand < 0.80) {
        // 20% Write-heavy: create new order
        const payload = JSON.stringify({
            customerName: 'Load Test Customer',
            item: 'Wireless Mouse',
            price: 29.99,
            quantity: 1,
            creditCardNumber: '4111-1234-5678-9012'
        });
        const res = http.post('http://localhost:3000/api/orders', payload, { headers });
        check(res, {
            'create: code is 201': (r) => r.status === 201
        });
    } else if (rand < 0.90) {
        // 10% CPU/DB-heavy: order aggregates report
        const res = http.get('http://localhost:3000/api/orders/report/summary', { headers });
        check(res, {
            'report: code is 200': (r) => r.status === 200,
            'report: cpuDuration calculated': (r) => r.json().cpuDurationMs !== undefined
        });
    } else if (rand < 0.95) {
        // 5% Storage-heavy: file uploads
        const fileContent = 'B'.repeat(50 * 1024); // 50KB payload
        const file = http.file(fileContent, 'heavy_load_image.jpg', 'image/jpeg');
        const fd = { file: file };
        const uploadHeaders = {
            'Authorization': `Bearer ${token}`
        };
        const res = http.post('http://localhost:3000/api/upload', fd, { headers: uploadHeaders });
        check(res, {
            'upload: code is 201': (r) => r.status === 201
        });
    } else {
        // 5% Read single item
        // First query list page 1
        const resList = http.get('http://localhost:3000/api/orders?page=1&limit=5', { headers });
        if (resList.status === 200) {
            const orders = resList.json().orders;
            if (orders && orders.length > 0) {
                const orderId = orders[0]._id;
                const resSingle = http.get(`http://localhost:3000/api/orders/${orderId}`, { headers });
                check(resSingle, {
                    'single: code is 200': (r) => r.status === 200
                });
            }
        }
    }

    // 100ms think time between requests to map realistic client pacing
    sleep(0.1);
}
