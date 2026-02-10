import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
    stages: [
        { duration: '30s', target: 10 }, // Ramp up to 10 users
        { duration: '1m', target: 10 },  // Stay at 10 users
        { duration: '30s', target: 0 },  // Ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],   // http errors should be less than 1%
        http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

// NOTE: This script assumes you have a way to generate valid auth tokens or bypass auth.
// For integration testing, one might use a predefined test user token or a "backdoor" if enabled in env.
// For now, this is a placeholder structure.
// WE STRONGLY RECOMMEND implementing a "setup" step that creates a user via API and gets a token,
// if your API supports public registration + login.

export function setup() {
    // Optional: Create a user and return the token
    // const res = http.post(`${BASE_URL}/api/auth/register`, { ... });
    // return { token: res.json('token') };
    return { token: 'PLACEHOLDER_TOKEN' };
}

export default function (data) {
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`,
        },
    };

    const payload = JSON.stringify({
        classId: 'PLACEHOLDER_CLASS_ID',
        attendanceType: 'in_person',
    });

    const res = http.post(`${BASE_URL}/api/bookings`, payload, params);

    check(res, {
        'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    sleep(1);
}
