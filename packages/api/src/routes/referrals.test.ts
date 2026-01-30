import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import referralsApp from './referrals';

// Mock DB
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn(() => Promise.resolve()) })) }));

// Recursive mock builder
const createMockBuilder = () => {
    const builder: any = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        leftJoin: vi.fn(() => builder),
        groupBy: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        get: mockGet,
        all: mockAll,
        insert: mockInsert,
        select: vi.fn(() => builder),
        update: vi.fn(() => builder),
        set: vi.fn(() => builder),
        run: vi.fn(() => Promise.resolve())
    };
    return builder;
};

const mockDb = createMockBuilder();

vi.mock('../db', () => ({
    createDb: () => mockDb
}));

// Mock params (Using global crypto shim if needed or trusting Node env)
// Vitest environment 'node' has crypto global.

describe('Referrals API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createTestApp = (permissions: string[] = []) => {
        const testApp = new Hono<{ Bindings: { DB: any }, Variables: { tenant: { id: string }, member: { id: string }, can: (p: string) => boolean } }>();
        testApp.use('*', async (c, next) => {
            c.set('tenant', { id: 'tenant_123' });
            c.set('member', { id: 'member_123' });
            c.set('can', (permission: string) => permissions.includes(permission));
            await next();
        });
        testApp.route('/', referralsApp);
        return testApp;
    };

    describe('GET /my-code', () => {
        it('generates a new code if none exists', async () => {
            mockGet.mockResolvedValueOnce(null); // No existing code

            const app = createTestApp();
            const res = await app.request('/my-code', { method: 'GET' }, { DB: {} });

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.code).toHaveLength(8);
            expect(mockInsert).toHaveBeenCalled();
        });

        it('returns existing code if present', async () => {
            mockGet.mockResolvedValueOnce({ code: 'ABC12345' });

            const app = createTestApp();
            const res = await app.request('/my-code', { method: 'GET' }, { DB: {} });

            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.code).toBe('ABC12345');
        });
    });

    describe('GET /stats', () => {
        it('returns correct aggregation', async () => {
            mockAll.mockResolvedValueOnce([
                { status: 'pending' },
                { status: 'pending' },
                { status: 'completed' },
                { status: 'rewarded' }
            ]);

            const app = createTestApp(['manage_marketing']);
            const res = await app.request('/stats', { method: 'GET' }, { DB: {} });

            expect(res.status).toBe(200);
            const data = await res.json() as any;

            expect(data.total).toBe(4);
            expect(data.pending).toBe(2);
            expect(data.completed).toBe(1);
            expect(data.rewarded).toBe(1);
        });

        it('denies access to non-owners', async () => {
            const app = createTestApp([]); // No permissions
            const res = await app.request('/stats', { method: 'GET' }, { DB: {} });
            expect(res.status).toBe(403);
        });
    });
});
