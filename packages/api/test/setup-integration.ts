import { vi } from 'vitest';

// Global mock for EmailService to avoid heavy/broken dependencies in integration tests
vi.mock('../src/services/email', () => {
    return {
        EmailService: vi.fn().mockImplementation(() => ({
            sendWelcome: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendBookingConfirmation: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendInvitation: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendReceipt: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendBroadcast: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            syncContact: vi.fn().mockResolvedValue(undefined),
            sendGenericEmail: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendWaiverCopy: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendSubscriptionUpdateOwner: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendTenantUpgradeAlert: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendTemplate: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            notifyNoShow: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendSubRequestAlert: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendSubRequestFilled: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendWelcomeOwner: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendNewTenantAlert: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            sendOwnerInvitation: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
            retryEmail: vi.fn().mockResolvedValue({ success: true }),
            alert: vi.fn().mockResolvedValue(undefined)
        }))
    };
});
