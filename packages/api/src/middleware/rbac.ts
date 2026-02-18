import { MiddlewareHandler } from 'hono';
import { Variables, Bindings } from '../types';
import { Permission } from '../services/permissions';

/**
 * Middleware to require a specific permission.
 * Depends on tenantMiddleware having already run and set 'can'.
 */
export const requirePermission = (permission: Permission): MiddlewareHandler<{ Variables: Variables, Bindings: Bindings }> => {
    return async (c, next) => {
        const can = c.get('can');
        if (!can || !can(permission)) {
            console.warn(`[RBAC] Access Denied: User ${c.get('auth')?.userId} lacks permission '${permission}' for tenant ${c.get('tenant')?.id}`);
            return c.json({
                error: 'Forbidden',
                message: `You do not have the required permission: ${permission}`
            }, 403);
        }
        await next();
    };
};

/**
 * Middleware to require at least one of the specified roles.
 * Depends on tenantMiddleware having already run and set 'roles'.
 */
export const requireRole = (allowedRoles: string[]): MiddlewareHandler<{ Variables: Variables, Bindings: Bindings }> => {
    return async (c, next) => {
        const roles = c.get('roles') || [];
        const hasRole = allowedRoles.some(r => roles.includes(r));

        if (!hasRole) {
            console.warn(`[RBAC] Access Denied: User ${c.get('auth')?.userId} lacks one of the required roles: [${allowedRoles.join(', ')}]`);
            return c.json({
                error: 'Forbidden',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
            }, 403);
        }
        await next();
    };
};
