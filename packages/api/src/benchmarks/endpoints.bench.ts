import { bench, describe, vi } from 'vitest';
import { Hono } from 'hono';
import adminApp from '../routes/admin';
import classesApp from '../routes/classes';

// Mock DB
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

const createMockBuilder = () => {
    const builder: any = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        leftJoin: vi.fn(() => builder),
        groupBy: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        offset: vi.fn(() => builder),
        get: mockGet,
        all: mockAll,
        select: vi.fn(() => builder),
        // Query Builder mocks for relations
        query: {
            tenants: { findMany: mockFindMany, findFirst: mockFindFirst },
            users: { findFirst: mockFindFirst },
            tenantMembers: { findFirst: mockFindFirst },
            classes: { findFirst: mockFindFirst },
            bookings: { findMany: mockFindMany },
            waiverSignatures: { findMany: mockFindMany },
            subscriptions: { findMany: mockFindMany },
            studentNotes: { findMany: mockFindMany }
        }
    };
    return builder;
};

const mockDb = createMockBuilder();

vi.mock('../db', () => ({
    createDb: () => mockDb
}));

// Setup Large Datasets
const generateTenants = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
        id: `tenant_${i}`,
        name: `Tenant ${i}`,
        slug: `tenant-${i}`,
        tier: 'pro'
    }));
};

const generateBookings = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
        id: `booking_${i}`,
        memberId: `member_${i % 50}`, // 50 unique members
        status: 'confirmed',
        createdAt: new Date().toISOString()
    }));
};

describe('API Benchmarks', () => {

    describe('GET /admin/tenants (N+1 Optimization)', () => {
        const tenants = generateTenants(50);

        // Mock specific returns for this endpoint
        mockFindMany.mockResolvedValue(tenants); // Initial fetch
        mockAll.mockResolvedValue([
            { tenantId: 'tenant_0', count: 5 }, { tenantId: 'tenant_1', count: 10 } // Stats mocks
        ]);

        const app = new Hono<{ Bindings: any, Variables: any }>();
        app.use('*', async (c, next) => {
            c.set('auth', { userId: 'admin_user' });
            await next();
        });
        // We need to mock the system admin check middleware in admin.ts essentially or pass it
        // Since we are unit testing the route logic, let's mock the DB response for the auth check middleware too
        mockDb.query.users.findFirst.mockResolvedValue({ id: 'admin_user', isSystemAdmin: true });

        app.route('/', adminApp);

        bench('fetch 50 tenants with stats', async () => {
            await app.request('/tenants', { method: 'GET' }, { DB: {} });
        }, { time: 1000 }); // Run for 1s
    });

    describe('GET /classes/:id/bookings (Bulk Fetch)', () => {
        const bookingsData = generateBookings(500);

        // Mock DB calls
        // 1. Auth & Context checks
        mockDb.query.tenantMembers.findFirst.mockResolvedValue({ id: 'instructor_1', role: 'instructor' });

        // 2. Main booking fetch
        // classes.ts uses db.select().from(bookings)...
        mockAll.mockResolvedValueOnce(bookingsData);

        // 3. Bulk fetches (waivers, subs, notes)
        // These are subsequent calls. We just return empty or small arrays to avoid error
        mockAll.mockResolvedValue([]);

        const app = new Hono<{ Bindings: any, Variables: any }>();
        app.use('*', async (c, next) => {
            c.set('tenant', { id: 'tenant_1' });
            c.set('auth', { userId: 'user_1' });
            c.set('roles', ['instructor']);
            await next();
        });
        app.route('/', classesApp);

        bench('fetch 500 bookings with related data', async () => {
            await app.request('/class_123/bookings', { method: 'GET' }, { DB: {} });
        }, { time: 1000 });
    });
});
