import { createMiddleware } from 'hono/factory';
import type { HonoContext } from '../types';
import { LoggerService } from '../services/logger';

export const traceMiddleware = createMiddleware<{ Bindings: HonoContext['Bindings'], Variables: HonoContext['Variables'] }>(async (c, next) => {
    const start = performance.now();
    const traceId = c.req.header('x-request-id') || crypto.randomUUID();

    // Initialize Logger
    const logger = new LoggerService({
        traceId,
        environment: c.env.ENVIRONMENT || 'development'
    });
    c.set('logger', logger);
    c.set('traceId', traceId);
    c.header('x-request-id', traceId);

    await next();

    const duration = performance.now() - start;
    const auth = c.get('auth');
    const tenant = c.get('tenant');

    // Context-aware enrichment after auth/tenant middleware might have run
    const finalLogger = logger.withContext({
        userId: auth?.userId,
        tenantId: tenant?.id
    });

    finalLogger.info(`Request completed: ${c.req.method} ${c.req.path}`, {
        status: c.res.status,
        durationMs: Math.round(duration * 100) / 100
    });

    // Fire-and-forget ping to Metrics DO if authenticated
    if (auth?.userId && c.env.METRICS && !['dev', 'test'].includes((c.env as any).ENVIRONMENT)) {
        try {
            const doId = c.env.METRICS.idFromName('global');
            const stub = c.env.METRICS.get(doId);
            c.executionCtx.waitUntil(stub.fetch('http://do/ping', {
                method: 'POST',
                body: JSON.stringify({ userId: auth.userId })
            }));
        } catch (e) {
            // Ignore metrics errors
        }
    }
});
