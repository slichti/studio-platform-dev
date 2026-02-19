
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from './bookings';

// Mock Resend to avoid selderee import issues
vi.mock('resend', () => {
    return {
        Resend: class {
            emails = { send: vi.fn() };
        }
    };
});

// Mock DB Helper
const mockGet = vi.fn();
const mockFindFirst = vi.fn();
const mockRun = vi.fn();

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
        all: vi.fn(),
        select: vi.fn(() => builder),
        update: vi.fn(() => builder),
        set: vi.fn(() => builder),
        run: mockRun,
        // Query API
        query: {
            bookings: {
                findFirst: mockFindFirst
            },
            tenantMembers: {
                findFirst: vi.fn()
            },
            progressMetricDefinitions: {
                findFirst: vi.fn()
            }
        }
    };
    return builder;
};

describe('BookingService Security', () => {
    let mockDb: any;
    let service: BookingService;

    beforeEach(() => {
        mockDb = createMockBuilder();
        mockGet.mockReset();
        mockFindFirst.mockReset();
        mockRun.mockReset();

        service = new BookingService(mockDb, { RESEND_API_KEY: 'mock' });
    });

    it('IDOR Check: Should throw error if tenantId does not match booking owner tenant', async () => {
        const bookingId = 'booking_123';
        const attackerTenantId = 'tenant_attacker';
        const victimTenantId = 'tenant_victim';

        // Mock finding the booking
        mockFindFirst.mockResolvedValue({
            id: bookingId,
            memberId: 'mem_1',
            member: {
                id: 'mem_1',
                tenantId: victimTenantId, // Booking belongs to Victim Tenant
                user: {},
                tenant: { branding: {}, settings: {} }
            },
            class: { title: 'Yoga' }
        });

        // Attempt checkIn with Attacker Tenant Context
        await expect(service.checkIn(bookingId, true, attackerTenantId))
            .rejects.toThrow("Unauthorized access to booking");

        expect(mockRun).not.toHaveBeenCalled();
    });

    it('IDOR Check: Should succeed if tenantId matches', async () => {
        const bookingId = 'booking_123';
        const tenantId = 'tenant_correct';

        // Mock finding the booking
        mockFindFirst.mockResolvedValue({
            id: bookingId,
            memberId: 'mem_1',
            member: {
                id: 'mem_1',
                tenantId: tenantId,
                user: {},
                tenant: { id: tenantId, branding: {}, settings: {} }
            },
            class: { title: 'Yoga' }
        });

        // Attempt checkIn with Correct Tenant Context
        mockGet.mockResolvedValueOnce({ count: 5 }); // Mock attendance count
        await service.checkIn(bookingId, true, tenantId);

        // Should update DB
        expect(mockRun).toHaveBeenCalled();
    });
});
