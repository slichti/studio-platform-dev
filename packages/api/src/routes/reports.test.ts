import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import reportsApp from './reports';

// Mock DB
const mockGet = vi.fn();
const mockAll = vi.fn();

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
        select: vi.fn(() => builder)
    };
    return builder;
};

const mockDb = createMockBuilder();

vi.mock('../db', () => ({
    createDb: () => mockDb
}));

// Mock Hono Context
const createMockContext = () => ({
    // ... not really used since we use integration request
});

describe('Reports API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createTestApp = () => {
        const testApp = new Hono<{ Bindings: { DB: any }, Variables: { tenant: { id: string } } }>();
        testApp.use('*', async (c, next) => {
            c.set('tenant', { id: 'tenant_123' });
            await next();
        });
        testApp.route('/', reportsApp);
        return testApp;
    };

    describe('GET /revenue', () => {
        it('calculates gross volume correctly', async () => {
            // Setup Mocks
            // 1. Retail
            mockGet.mockResolvedValueOnce({ total: 1000 }); // $10.00
            // 2. Packs
            mockGet.mockResolvedValueOnce({ total: 5000 }); // $50.00
            // 3. Active Subs
            mockAll.mockResolvedValueOnce([
                { price: 2000 }, // $20.00
                { price: 3000 }  // $30.00
            ]);
            // 4. Time series mocks (Retail, Packs)
            mockAll.mockResolvedValueOnce([{ date: '2023-01-05', amount: 1000 }]);
            mockAll.mockResolvedValueOnce([{ date: '2023-01-10', amount: 5000 }]);

            const app = createTestApp();
            const res = await app.request('/revenue?startDate=2023-01-01&endDate=2023-01-31', {
                method: 'GET'
            }, {
                DB: {} // Inject DB env
            });

            if (res.status !== 200) {
                console.error(await res.text());
            }
            expect(res.status).toBe(200);

            const data = await res.json() as any;

            // Expected
            // Retail: 1000
            // Packs: 5000
            // MRR: 5000
            // Renewals Estimate: 5000
            // Gross: 1000 + 5000 + 5000 = 11000

            expect(data.breakdown.retail).toBe(1000);
            expect(data.breakdown.packs).toBe(5000);
            expect(data.breakdown.mrr).toBe(5000);
            expect(data.breakdown.renewals).toBe(5000);
            expect(data.grossVolume).toBe(11000);
        });
    });
});
