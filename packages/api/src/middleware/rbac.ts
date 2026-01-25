
import { Context, Next } from 'hono';
import { createDb } from '../db';
import { memberCustomRoles, customRoles } from '@studio/db/src/schema'; // Ensure exported
import { eq, inArray } from 'drizzle-orm';
import { Permission } from '../const/permissions';

export const requirePermission = (requiredPermission: Permission) => {
    return async (c: Context, next: Next) => {
        const member = c.get('member');
        const roles = c.get('roles') || []; // System roles from tenantMiddleware

        // 1. Super-User Bypass
        if (roles.includes('owner') || roles.includes('admin')) {
            return next();
        }

        if (!member) {
            return c.json({ error: "Unauthorized: No member context" }, 401);
        }

        // 2. Fetch Custom Permissions
        // Optimization: We could cache this in the member object in tenantMiddleware if used frequently
        const db = createDb(c.env.DB);

        const assignedRoles = await db.select({
            permissions: customRoles.permissions
        })
            .from(memberCustomRoles)
            .innerJoin(customRoles, eq(memberCustomRoles.customRoleId, customRoles.id))
            .where(eq(memberCustomRoles.memberId, member.id))
            .all();

        // Flatten permissions
        const userPermissions = new Set<string>();
        assignedRoles.forEach(role => {
            if (Array.isArray(role.permissions)) {
                role.permissions.forEach((p: string) => userPermissions.add(p));
            }
        });

        // 3. Check Requirement
        if (userPermissions.has(requiredPermission)) {
            return next();
        }

        return c.json({ error: `Forbidden: Missing permission '${requiredPermission}'` }, 403);
    };
};
