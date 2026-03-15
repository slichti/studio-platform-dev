import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optionalAuthMiddleware } from './optionalAuth';

vi.mock('hono/jwt', () => ({
    verify: vi.fn().mockResolvedValue({ sub: 'user_123' }),
}));

function createMockContext(overrides: {
    authHeader?: string;
    testAuth?: string;
    queryToken?: string;
    env?: Record<string, unknown>;
} = {}) {
    const { authHeader, testAuth, queryToken, env = { ENVIRONMENT: 'production' } } = overrides;
    const setFn = vi.fn();
    const getFn = vi.fn().mockReturnValue(undefined);
    const nextFn = vi.fn().mockResolvedValue(undefined);

    const c = {
        req: {
            header: (name: string) => (name === 'Authorization' ? authHeader : name === 'TEST-AUTH' ? testAuth : undefined),
            query: (key: string) => (key === 'token' ? queryToken : undefined),
        },
        env,
        set: setFn,
        get: getFn,
        executionCtx: { waitUntil: vi.fn() },
    } as any;

    return { c, next: nextFn, setFn };
}

describe('optionalAuthMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sets auth and calls next when ENVIRONMENT=test and TEST-AUTH header present', async () => {
        const { c, next, setFn } = createMockContext({ testAuth: 'user_mock', env: { ENVIRONMENT: 'test' } });
        await optionalAuthMiddleware(c, next);
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({ userId: 'user_mock', claims: { sub: 'user_mock', role: 'mock' } }));
        expect(next).toHaveBeenCalled();
    });

    it('calls next without setting auth when no token and no TEST-AUTH', async () => {
        const { c, next, setFn } = createMockContext({ env: { ENVIRONMENT: 'production' } });
        await optionalAuthMiddleware(c, next);
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('calls next without setting auth when ENVIRONMENT is not test even with TEST-AUTH', async () => {
        const { c, next, setFn } = createMockContext({ testAuth: 'user_mock', env: { ENVIRONMENT: 'production' } });
        await optionalAuthMiddleware(c, next);
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('sets auth and calls next when valid Bearer token is present and Clerk (RS256) verify succeeds', async () => {
        const { verify } = await import('hono/jwt');
        vi.mocked(verify).mockRejectedValueOnce(new Error('Not HS256')); // HS256 path fails
        vi.mocked(verify).mockResolvedValueOnce({ sub: 'user_456', role: 'user' }); // RS256 path succeeds
        const { c, next, setFn } = createMockContext({
            authHeader: 'Bearer valid.jwt.token',
            env: { ENVIRONMENT: 'production', CLERK_SECRET_KEY: 'sk_test', CLERK_PEM_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----' },
        });
        await optionalAuthMiddleware(c, next);
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({ userId: 'user_456', claims: expect.objectContaining({ sub: 'user_456' }) }));
        expect(next).toHaveBeenCalled();
    });
});
