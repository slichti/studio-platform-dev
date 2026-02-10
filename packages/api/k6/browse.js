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
    const res = http.get(`${BASE_URL}/api/public/tenants/${TENANT_SLUG}/classes?from=2024-01-01&to=2024-12-31`);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'latency is < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}
