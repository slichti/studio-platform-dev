
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChurnService } from './churn';

describe('ChurnService', () => {
    let mockDb: any;
    let churnService: ChurnService;

    beforeEach(() => {
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn(),
            query: {
                tenantMembers: {
                    findFirst: vi.fn()
                }
            }
        };
        churnService = new ChurnService(mockDb, 'tenant-1');
    });

    it('should return high risk if days since last attendance > 60', async () => {
        const lastDate = new Date();
        lastDate.setDate(lastDate.getDate() - 65);

        mockDb.get.mockResolvedValue({ date: lastDate }); // booking found
        mockDb.query.tenantMembers.findFirst.mockResolvedValue({ joinedAt: new Date() });

        const result = await churnService.analyzeMemberRisk('member-1');
        expect(result.riskLevel).toBe('high');
        expect(result.churnScore).toBe(10);
    });

    it('should return low risk if days since last attendance < 14', async () => {
        const lastDate = new Date();
        lastDate.setDate(lastDate.getDate() - 5);

        mockDb.get.mockResolvedValue({ date: lastDate });
        mockDb.query.tenantMembers.findFirst.mockResolvedValue({ joinedAt: new Date() });

        const result = await churnService.analyzeMemberRisk('member-1');
        expect(result.riskLevel).toBe('low');
        expect(result.churnScore).toBe(100);
    });

    it('should return medium risk if days since last attendance > 30 and < 60', async () => {
        const lastDate = new Date();
        lastDate.setDate(lastDate.getDate() - 40);

        mockDb.get.mockResolvedValue({ date: lastDate });
        mockDb.query.tenantMembers.findFirst.mockResolvedValue({ joinedAt: new Date() });

        const result = await churnService.analyzeMemberRisk('member-1');
        expect(result.riskLevel).toBe('medium');
        expect(result.churnScore).toBe(40);
    });
});
