import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 }, // Ramp up to 20 users
        { duration: '1m', target: 20 },  // Stay at 20 users
        { duration: '30s', target: 0 },  // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'garden-yoga'; // Using known active tenant

export default function () {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);

    const from = today.toISOString().split('T')[0];
    const to = nextMonth.toISOString().split('T')[0];

    const params = {
        headers: {
            'X-Tenant-Slug': TENANT_SLUG,
        },
    };

    const res = http.get(`${BASE_URL}/classes?from=${from}&to=${to}`, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'latency is < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}
