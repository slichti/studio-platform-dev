import { Context } from 'hono';

export function requireRole(c: Context, allowedRoles: string[]) {
    const user = c.get('user');
    if (!user) {
        // If user wasn't set by tenantMiddleware, maybe it didn't run or auth failed earlier
        // But if tenantMiddleware ran, it ensures user is set if auth is present.
        return false;
    }

    // Super Admins bypass everything
    if (user.isSuperAdmin) return true;

    if (allowedRoles.includes(user.role)) {
        return true;
    }
    return false;
}

export function assertRole(c: Context, allowedRoles: string[]) {
    if (!requireRole(c, allowedRoles)) {
        throw new Error('Access Denied: Insufficient permissions');
    }
}
