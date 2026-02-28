import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optionalAuthMiddleware } from './optionalAuth';

vi.mock('hono/jwt', () => ({
    verify: vi.fn().mockResolvedValue({ sub: 'user_123' }),
}));

function createMockContext(overrides: {
    authHeader?: string;
    testAuth?: string;
    env?: Record<string, unknown>;
} = {}) {
    const { authHeader, testAuth, env = { ENVIRONMENT: 'production' } } = overrides;
    const setFn = vi.fn();
    const getFn = vi.fn().mockReturnValue(undefined);
    const nextFn = vi.fn().mockResolvedValue(undefined);

    const c = {
        req: {
            header: (name: string) => (name === 'Authorization' ? authHeader : name === 'TEST-AUTH' ? testAuth : undefined),
            query: () => undefined,
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
});
