import { createMiddleware } from 'hono/factory';
import type { HonoContext } from '../types';

export const traceMiddleware = createMiddleware<{ Bindings: HonoContext['Bindings'], Variables: HonoContext['Variables'] }>(async (c, next) => {
    const traceId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('traceId', traceId);
    c.header('x-request-id', traceId);
    await next();

    // Fire-and-forget ping to Metrics DO if authenticated
    const auth = c.get('auth');
    if (auth?.userId && c.env.METRICS) {
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
