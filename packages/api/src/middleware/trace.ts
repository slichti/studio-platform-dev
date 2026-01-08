import { createMiddleware } from 'hono/factory';

export const traceMiddleware = createMiddleware(async (c, next) => {
    const traceId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('traceId', traceId);
    c.header('x-request-id', traceId);
    await next();
});
