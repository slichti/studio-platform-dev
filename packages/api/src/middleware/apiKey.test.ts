import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyMiddleware } from './apiKey';

const mockVerifyKey = vi.fn();
vi.mock('../services/api-keys', () => ({ ApiKeyService: { verifyKey: (...args: any[]) => mockVerifyKey(...args) } }));

const mockFindFirst = vi.fn();
const mockCreateDb = vi.fn(() => ({
    query: { tenants: { findFirst: mockFindFirst } },
}));
vi.mock('../db', () => ({ createDb: (...args: any[]) => mockCreateDb(...args) }));

function createMockContext(authHeader?: string) {
    const setFn = vi.fn();
    const nextFn = vi.fn().mockResolvedValue(undefined);
    const c = {
        req: { header: (name: string) => (name === 'Authorization' ? authHeader : undefined) },
        env: { DB: {} },
        set: setFn,
    } as any;
    return { c, next: nextFn, setFn };
}

describe('apiKeyMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindFirst.mockResolvedValue({ id: 'tenant_1', slug: 'test', name: 'Test' });
    });

    it('calls next without setting auth when Authorization is not Bearer sp_', async () => {
        const { c, next, setFn } = createMockContext('Bearer user_jwt_token');
        await apiKeyMiddleware(c, next);
        expect(mockVerifyKey).not.toHaveBeenCalled();
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('sets tenant and auth and calls next when valid API key', async () => {
        mockVerifyKey.mockResolvedValueOnce({ id: 'key_1', tenantId: 'tenant_1', name: 'Test Key' });
        const { c, next, setFn } = createMockContext('Bearer sp_abcdef1234567890');
        await apiKeyMiddleware(c, next);
        expect(mockVerifyKey).toHaveBeenCalledWith(expect.anything(), 'sp_abcdef1234567890');
        expect(setFn).toHaveBeenCalledWith('tenant', { id: 'tenant_1', slug: 'test', name: 'Test' });
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({
            userId: 'system_key',
            claims: expect.objectContaining({ role: 'api_key', tenantId: 'tenant_1', keyId: 'key_1', name: 'Test Key' }),
        }));
        expect(setFn).toHaveBeenCalledWith('isImpersonating', false);
        expect(next).toHaveBeenCalled();
    });

    it('calls next without setting auth when verifyKey returns null', async () => {
        mockVerifyKey.mockResolvedValueOnce(null);
        const { c, next, setFn } = createMockContext('Bearer sp_invalidkey');
        await apiKeyMiddleware(c, next);
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('calls next without setting auth when tenant findFirst returns null', async () => {
        mockVerifyKey.mockResolvedValueOnce({ id: 'key_1', tenantId: 'tenant_missing', name: 'Key' });
        mockFindFirst.mockResolvedValueOnce(null);
        const { c, next, setFn } = createMockContext('Bearer sp_validkey');
        await apiKeyMiddleware(c, next);
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
});
