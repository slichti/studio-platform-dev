/**
 * Sentry Middleware for Hono (Cloudflare Workers)
 * 
 * Captures and reports errors to Sentry.
 * Requires SENTRY_DSN environment variable.
 * 
 * Uses @sentry/cloudflare's honoIntegration for proper Worker support.
 */

import { Context, Next } from 'hono';
import {
    captureException,
    setTag,
    setUser,
    getDefaultIntegrations,
    honoIntegration
} from '@sentry/cloudflare';

// For manual error capture
export {
    captureException,
    setTag,
    setUser
};

/**
 * Simple Hono middleware for Sentry error tracking
 * Captures unhandled errors and adds context
 */
export const sentryMiddleware = () => {
    return async (c: Context, next: Next) => {
        const dsn = c.env?.SENTRY_DSN;

        // Skip if no DSN configured
        if (!dsn) {
            return next();
        }

        // Add context tags
        setTag('worker', 'studio-platform-api');
        setTag('path', c.req.path);
        setTag('method', c.req.method);
        setTag('environment', c.env?.ENVIRONMENT || 'development');

        // Capture user context if available
        const userId = c.get('userId');
        const tenant = c.get('tenant');
        if (userId) {
            setUser({ id: userId });
        }
        if (tenant) {
            setTag('tenant', tenant.slug || tenant.id);
        }

        try {
            await next();
        } catch (error) {
            // Capture the error to Sentry
            captureException(error);

            // Re-throw to let Hono's error handling continue
            throw error;
        }
    };
};
