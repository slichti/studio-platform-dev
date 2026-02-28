import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authMiddleware } from './auth';

// Mock hono/jwt so we don't need real keys
vi.mock('hono/jwt', () => ({
    decode: vi.fn((token: string) => {
        if (token.startsWith('user_')) return { header: { alg: 'none' }, payload: {} };
        if (token === 'valid-impersonation') return { header: { alg: 'HS256' }, payload: {} };
        return { header: { alg: 'RS256' }, payload: { sub: 'user_123' } };
    }),
    verify: vi.fn().mockResolvedValue({ sub: 'user_123', impersonatorId: 'admin_1' }),
}));

// Mock db so createDb and update don't run
vi.mock('../db', () => ({ createDb: vi.fn(() => ({ update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ run: vi.fn() }) }) }) })) }));

function createMockContext(overrides: {
    authHeader?: string;
    upgrade?: string;
    method?: string;
    query?: Record<string, string>;
    testAuth?: string;
    env?: Record<string, unknown>;
    getAuth?: unknown;
} = {}) {
    const {
        authHeader,
        upgrade,
        method = 'GET',
        query = {},
        testAuth,
        env = { ENVIRONMENT: 'production', CLERK_PEM_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----' },
        getAuth,
    } = overrides;

    const setFn = vi.fn();
    const getFn = vi.fn().mockImplementation((key: string) => (key === 'auth' ? getAuth : undefined));
    const jsonFn = vi.fn().mockReturnValue(new Response());
    const nextFn = vi.fn().mockResolvedValue(undefined);

    const req = {
        header: (name: string) => {
            if (name === 'Authorization') return authHeader;
            if (name === 'Upgrade') return upgrade;
            if (name === 'TEST-AUTH') return testAuth;
            return undefined;
        },
        method,
        query: (key: string) => query[key],
        url: 'http://localhost/',
        raw: {},
    };

    const c = {
        req,
        env,
        set: setFn,
        get: getFn,
        json: jsonFn,
        executionCtx: { waitUntil: vi.fn() },
    } as any;

    return { c, next: nextFn, setFn, getFn, jsonFn };
}

describe('authMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when no Authorization, no Upgrade, no TEST-AUTH', async () => {
        const { c, next, jsonFn } = createMockContext({ env: { ENVIRONMENT: 'production' } });
        await authMiddleware(c, next);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
        expect(next).not.toHaveBeenCalled();
    });

    it('sets auth and calls next when ENVIRONMENT=test and TEST-AUTH header present', async () => {
        const { c, next, setFn } = createMockContext({
            testAuth: 'user_test_owner',
            env: { ENVIRONMENT: 'test', CLERK_PEM_PUBLIC_KEY: 'x' },
        });
        await authMiddleware(c, next);
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({ userId: 'user_test_owner', claims: expect.objectContaining({ sub: 'user_test_owner' }) }));
        expect(setFn).toHaveBeenCalledWith('isImpersonating', false);
        expect(next).toHaveBeenCalled();
    });

    it('sets guest auth when Upgrade=websocket, GET, and valid signed guestToken', async () => {
        // The middleware now verifies a signed guestToken JWT via hono/jwt
        const { verify: mockVerify } = await import('hono/jwt');
        vi.mocked(mockVerify).mockResolvedValueOnce({ sub: 'guest_abc123', role: 'guest', tenantSlug: 'my-studio' });
        const { c, next, setFn } = createMockContext({
            upgrade: 'websocket',
            method: 'GET',
            query: { guestToken: 'signed.guest.jwt' },
            env: { ENVIRONMENT: 'production', IMPERSONATION_SECRET: 'test-secret' },
        });
        await authMiddleware(c, next);
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({ userId: 'guest_abc123', claims: expect.objectContaining({ sub: 'guest_abc123', role: 'guest' }) }));
        expect(next).toHaveBeenCalled();
    });

    it('returns 401 when Upgrade=websocket and guestToken verification fails', async () => {
        const { verify: mockVerify } = await import('hono/jwt');
        vi.mocked(mockVerify).mockRejectedValueOnce(new Error('Invalid token'));
        const { c, next, jsonFn } = createMockContext({
            upgrade: 'websocket',
            method: 'GET',
            query: { guestToken: 'bad.guest.token' },
            env: { ENVIRONMENT: 'production', IMPERSONATION_SECRET: 'test-secret' },
        });
        await authMiddleware(c, next);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for WebSocket without guestToken or token', async () => {
        const { c, next, jsonFn } = createMockContext({
            upgrade: 'websocket',
            method: 'GET',
            query: { userId: 'user_123', tenantSlug: 'my-studio' },
            env: { ENVIRONMENT: 'production' },
        });
        await authMiddleware(c, next);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for WebSocket guest without guestToken', async () => {
        const { c, next, jsonFn } = createMockContext({
            upgrade: 'websocket',
            method: 'GET',
            query: { userId: 'guest_abc' },
            env: { ENVIRONMENT: 'production' },
        });
        await authMiddleware(c, next);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Unauthorized' }, 401);
        expect(next).not.toHaveBeenCalled();
    });

    it('sets auth and calls next when token starts with user_ and ENVIRONMENT is test', async () => {
        const { c, next, setFn } = createMockContext({
            authHeader: 'Bearer user_test_owner',
            env: { ENVIRONMENT: 'test', CLERK_PEM_PUBLIC_KEY: 'x' },
        });
        await authMiddleware(c, next);
        expect(setFn).toHaveBeenCalledWith('auth', expect.objectContaining({ userId: 'user_test_owner' }));
        expect(next).toHaveBeenCalled();
    });

    it('returns 401 when Bearer token present but verify fails (RS256 path)', async () => {
        const { verify } = await import('hono/jwt');
        vi.mocked(verify).mockRejectedValueOnce(new Error('Invalid signature'));
        const { c, next, jsonFn } = createMockContext({
            authHeader: 'Bearer eyJhbGciOiJSUzI1NiJ9.x.y',
            env: { ENVIRONMENT: 'production', CLERK_PEM_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----' },
        });
        await authMiddleware(c, next);
        expect(jsonFn).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid Token Signature' }), 401);
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next when auth already set (e.g. by apiKey middleware)', async () => {
        const { c, next, setFn } = createMockContext({
            getAuth: { userId: 'system_key', claims: { role: 'api_key' } },
        });
        await authMiddleware(c, next);
        expect(setFn).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
});
