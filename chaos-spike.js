import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    scenarios: {
        spike: {
            executor: 'constant-vus',
            vus: 500,
            duration: '90s',
            // No ramp — all 500 VUs start simultaneously
            startTime: '0s',
        },
    },
};

export function setup() {
    const res = http.post(
        'http://localhost:3000/api/auth/login',
        JSON.stringify({ username: 'testuser', password: 'password123' }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    const token = res.json().token;
    if (!token) throw new Error('Login failed: ' + res.body);
    return { token };
}

export default function (data) {
    const headers = {
        Authorization: `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };

    const rand = Math.random();
    if (rand < 0.70) {
        const page = Math.floor(Math.random() * 50) + 1;
        const res = http.get(`http://localhost:3000/api/orders?page=${page}&limit=20`, { headers });
        check(res, { 'spike read 200': (r) => r.status === 200 });
    } else {
        const res = http.post(
            'http://localhost:3000/api/orders',
            JSON.stringify({ customerName: 'Spike User', item: 'Keyboard', price: 49.99, quantity: 1 }),
            { headers }
        );
        check(res, { 'spike write 201': (r) => r.status === 201 });
    }
    sleep(0.1);
}
