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
    } else if (req.url.includes('/check-slug')) {
        res.end(JSON.stringify({ valid: true }));
    } else if (req.url.includes('/public/plans')) {
        res.end(JSON.stringify([
            { id: 'plan_launch', name: 'Launch', slug: 'launch', prices: { monthly: 4900, annual: 47000 }, trialDays: 14 }
        ]));
    } else if (req.url.includes('/onboarding/studio')) {
        res.end(JSON.stringify({ tenant: { slug: 'new-studio', name: 'New Studio' } }));
    } else if (req.url.includes('/tenant/settings')) {
        res.end(JSON.stringify({ success: true }));
    } else if (req.url.includes('/locations')) {
        res.end(JSON.stringify({ id: 'loc_1', name: 'Main Studio' }));
    } else if (req.url.includes('/analytics')) {
        res.end(JSON.stringify({
            summary: { activeMembers: 150, revenue: 1250000, bookings: 450 },
            trends: [
                { date: '2026-01-01', value: 100 },
                { date: '2026-02-01', value: 150 }
            ]
        }));
    } else {
        res.end(JSON.stringify([]));
    }
});

server.listen(8787, () => {
    console.log('Mock API server listening on port 8787');
});
