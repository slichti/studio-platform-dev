import type { Permission } from '../services/permissions';

/**
 * Policy helper: if the current context does not have the required permission,
 * returns a 403 JSON response; otherwise returns null (caller should proceed).
 * Use after tenant middleware has set `can`.
 *
 * Example: const res = guard(c, 'view_reports'); if (res) return res;
 */
export function guard(c: any, permission: Permission) {
    const can = c?.get?.('can');
    if (!can || !can(permission)) {
        return c.json({
            error: 'Forbidden',
            message: `You do not have the required permission: ${permission}`,
        }, 403);
    }
    return null;
}
