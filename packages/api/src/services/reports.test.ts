
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

        const html = await service.generateEmailSummary('attendance');

        // Assert
        expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });
});
