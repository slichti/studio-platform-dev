const http = require('http');

const TENANT_SLUG = 'test-studio';
const MEMBER_ID = 'user_member_fixed_id';

let bookings = [];

const server = http.createServer((req, res) => {
    console.log(`[MOCK API] ${req.method} ${req.url}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    res.setHeader('Content-Type', 'application/json');

    if (req.url.includes('/tenants/')) {
        res.end(JSON.stringify({
            id: 'tenant_e2e_id',
            name: 'Test Studio',
            slug: TENANT_SLUG,
            branding: { primaryColor: '#4f46e5' }
        }));
    } else if (req.url.includes('/users/me')) {
        res.end(JSON.stringify({
            id: MEMBER_ID,
            firstName: 'E2E',
            lastName: 'Member',
            tenants: [{ slug: TENANT_SLUG, role: 'student' }]
        }));
    } else if (req.url.includes('/bookings/my-upcoming')) {
        // Return dynamic bookings
        res.end(JSON.stringify(bookings.map(id => ({
            id: 'booking_' + id,
            status: 'confirmed',
            classId: id,
            class: { id: id, title: 'Member Yoga Flow', startTime: new Date().toISOString() }
        }))));
    } else if (req.url.includes('/classes')) {
        res.end(JSON.stringify([
            {
                id: 'class_member_e2e_1',
                title: 'Member Yoga Flow',
                startTime: new Date().toISOString(),
                durationMinutes: 60,
                instructor: { profile: { firstName: 'Yogi' } },
                capacity: 20,
                bookedCount: 5,
                status: 'active'
            }
        ]));
    } else if (req.url.includes('/bookings') && req.method === 'POST') {
        // Simple extraction of classId from body if possible, else just assume E2E class
        bookings.push('class_member_e2e_1');
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, bookingId: 'new_booking_id' }));
    } else {
        res.end(JSON.stringify([]));
    }
});

server.listen(8787, () => {
    console.log('Mock API server listening on port 8787');
});
