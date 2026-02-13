
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from './reports';

// Mock DB Helper
const mockGet = vi.fn();
const mockAll = vi.fn();

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

describe('ReportService Security', () => {
    let mockDb: any;
    let service: ReportService;

    beforeEach(() => {
        mockDb = createMockBuilder();
        service = new ReportService(mockDb, 'tenant_123');
        vi.clearAllMocks();
    });

    it('should escape HTML in top class titles to prevent XSS', async () => {
        // Mock getAttendance data
        // 1. totalBookings
        mockGet.mockResolvedValueOnce({ count: 100 });
        // 2. totalCheckins
        mockGet.mockResolvedValueOnce({ count: 80 });
        // 3. topClasses - MALICIOUS TITLE
        mockAll.mockResolvedValueOnce([{
            title: '<script>alert("XSS")</script>',
            attendees: 50
        }]);
        // 4. dailyData
        mockAll.mockResolvedValueOnce([]);

        const data = await service.getReportData('attendance', new Date(), new Date());
        const html = await service.generateEmailSummary('attendance', data);

        // Assert
        expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });

    it('should calculate active_members metric as a daily snapshot', async () => {
        const start = new Date('2024-01-01');
        const end = new Date('2024-01-03');

        // Mock select for active_members
        mockAll.mockResolvedValueOnce([
            { id: 'm1', joinedAt: new Date('2023-12-01') },
            { id: 'm2', joinedAt: new Date('2024-01-02') }
        ]);

        const result = await service.query({
            metrics: ['active_members'],
            dimensions: ['date'],
            filters: { startDate: start, endDate: end }
        });

        expect(mockAll).toHaveBeenCalled();
        expect(result.summary.active_members).toBe(2);
        expect(result.chartData).toHaveLength(3); // Jan 1, 2, 3

        // Jan 1: only m1 was joined
        expect(result.chartData[0].active_members).toBe(1);
        // Jan 2: m1 and m2 joined
        expect(result.chartData[1].active_members).toBe(2);
        // Jan 3: m1 and m2 joined
        expect(result.chartData[2].active_members).toBe(2);
    });
});
