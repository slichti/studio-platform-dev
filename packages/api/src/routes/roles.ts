
import { Hono } from 'hono';
import { createDb } from '../db';
import { customRoles, memberCustomRoles } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import type { Bindings, Variables } from '../types';
import { PERMISSIONS } from '../const/permissions';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /roles - List all custom roles for tenant
app.get('/', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    const db = createDb(c.env.DB);

    const roles = await db.select().from(customRoles).where(eq(customRoles.tenantId, tenant.id)).all();
    return c.json(roles);
});

// POST /roles - Create new Role
app.post('/', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    const userRoles = c.get('roles') || [];

    // Only Owners/Admins (or those with MANAGE_ROLES)
    // For now strict owners/admins for defining roles
    if (!userRoles.includes('owner') && !userRoles.includes('admin')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const { name, description, permissions } = await c.req.json();

    // Validate Permissions
    const validPermissions = Object.values(PERMISSIONS);
    const safePermissions = (permissions || []).filter((p: string) => validPermissions.includes(p as any));

    const db = createDb(c.env.DB);
    const id = crypto.randomUUID();

    await db.insert(customRoles).values({
        id,
        tenantId: tenant.id,
        name,
        description,
        permissions: safePermissions
    }).run();

    return c.json({ success: true, id });
});

// PUT /roles/:id - Update Role
app.put('/:id', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    const id = c.req.param('id');
    const userRoles = c.get('roles') || [];

    if (!userRoles.includes('owner') && !userRoles.includes('admin')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const { name, description, permissions } = await c.req.json();
    const db = createDb(c.env.DB);

    // Verify ownership
    const role = await db.select().from(customRoles).where(and(eq(customRoles.id, id), eq(customRoles.tenantId, tenant.id))).get();
    if (!role) return c.json({ error: "Role not found" }, 404);

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions) {
        const validPermissions = Object.values(PERMISSIONS);
        updateData.permissions = permissions.filter((p: string) => validPermissions.includes(p as any));
    }

    await db.update(customRoles).set(updateData).where(eq(customRoles.id, id)).run();
    return c.json({ success: true });
});

// DELETE /roles/:id
app.delete('/:id', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);
    const id = c.req.param('id');
    const userRoles = c.get('roles') || [];

    if (!userRoles.includes('owner') && !userRoles.includes('admin')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const db = createDb(c.env.DB);

    // Verify ownership
    const role = await db.select().from(customRoles).where(and(eq(customRoles.id, id), eq(customRoles.tenantId, tenant.id))).get();
    if (!role) return c.json({ error: "Role not found" }, 404);

    // Clean up assignments
    await db.delete(memberCustomRoles).where(eq(memberCustomRoles.customRoleId, id)).run();
    await db.delete(customRoles).where(eq(customRoles.id, id)).run();

    return c.json({ success: true });
});

export default app;
