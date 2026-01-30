import { Hono } from 'hono';
import { createDb } from '../db';

import { tenants, tenantMembers, uploads, users } from '@studio/db/src/schema'; // Consolidated imports
import { sql, eq, desc, like, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// Cloudflare Images
app.post('/image', async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

        // Security: Restrict upload URL generation to privileged users
        if (!c.get('can')('manage_tenant')) {
            return c.json({ error: 'Unauthorized: Upload permission required' }, 403);
        }

        const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
        const token = c.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !token) {
            return c.json({ error: 'Missing Cloudflare credentials' }, 500);
        }

        const formData = new FormData();
        formData.append('requireSignedURLs', 'false');
        formData.append('metadata', JSON.stringify({ tenantId: tenant.id }));

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            return c.json({ error: `Failed to get upload URL: ${error}` }, 500);
        }

        const data = await response.json() as any;
        return c.json(data.result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Generic File Upload (PDF)
app.post('/pdf', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    // Security: RBAC
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized: Upload permission required' }, 403);
    }

    const body = await c.req.parseBody();
    const file = body['file'] as File;

    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(createDb(c.env.DB), tenant.id);
    const canUpload = await usageService.checkLimit('storageGB', tenant.tier || 'launch');

    if (!canUpload) {
        return c.json({
            error: "Storage limit reached. Upgrade to upload more files.",
            code: "LIMIT_REACHED"
        }, 403);
    }

    const objectKey = `tenants/${tenant.slug}/waivers/${crypto.randomUUID()}.pdf`;

    await c.env.R2.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: 'application/pdf' }
    });

    const db = createDb(c.env.DB);
    await db.insert(uploads).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        fileKey: objectKey,
        fileUrl: `/uploads/${objectKey}`,
        sizeBytes: file.size,
        mimeType: 'application/pdf',
        originalName: file.name,
        uploadedBy: c.get('auth')?.userId || 'unknown',
        createdAt: new Date()
    }).run();

    await db.update(tenants)
        .set({ storageUsage: sql`${tenants.storageUsage} + ${file.size}` })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ key: objectKey, url: `/uploads/${objectKey}` });
});

// Generic Image Upload to R2
app.post('/r2-image', async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

        if (!c.get('can')('manage_tenant')) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const body = await c.req.parseBody();
        const file = body['file'] as File;
        if (!file) return c.json({ error: 'File required' }, 400);

        const { UsageService } = await import('../services/pricing');
        const usageService = new UsageService(createDb(c.env.DB), tenant.id);
        const canUpload = await usageService.checkLimit('storageGB', tenant.tier || 'launch');

        if (!canUpload) return c.json({ error: "Storage limit reached", code: "LIMIT_REACHED" }, 403);

        const extension = file.type.split('/')[1];
        const objectKey = `tenants/${tenant.slug}/images/${crypto.randomUUID()}.${extension}`;

        await c.env.R2.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type }
        });

        const db = createDb(c.env.DB);
        const titleVal = body['title'];
        const title = typeof titleVal === 'string' ? titleVal : file.name;

        await db.insert(uploads).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            fileKey: objectKey,
            fileUrl: `/uploads/${objectKey}`,
            sizeBytes: file.size,
            mimeType: file.type,
            originalName: file.name,
            uploadedBy: c.get('auth')?.userId,
            title: title,
            createdAt: new Date()
        }).run();

        await db.update(tenants)
            .set({ storageUsage: sql`${tenants.storageUsage} + ${file.size}` })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ key: objectKey, url: `/uploads/${objectKey}` });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// List Images
app.get('/images', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const results = await db.select()
        .from(uploads)
        .where(and(eq(uploads.tenantId, tenant.id), like(uploads.mimeType, 'image/%')))
        .orderBy(desc(uploads.createdAt))
        .all();

    return c.json(results);
});

// Update Image Metadata
app.patch('/images/:id', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);

    const id = c.req.param('id');
    const { title, description, tags } = await c.req.json();

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;

    await db.update(uploads)
        .set(updateData)
        .where(and(eq(uploads.id, id), eq(uploads.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// Logo Upload
app.post('/logo', async (c) => {
    if (!c.get('can')('manage_tenant')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
    const db = createDb(c.env.DB);

    const body = await c.req.parseBody();
    const file = body['file'] as File;
    if (!file) return c.json({ error: 'File required' }, 400);

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const token = c.env.CLOUDFLARE_API_TOKEN;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify({ type: 'logo', tenantId: tenant.id }));

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!response.ok) return c.json({ error: `Upload failed` }, 500);

    const data = await response.json() as any;
    const imageId = data.result?.id;
    const logoUrl = `https://imagedelivery.net/${accountId}/${imageId}/logo`;

    const currentBranding = (tenant.branding as any) || {};
    await db.update(tenants)
        .set({ branding: { ...currentBranding, logoUrl } })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ logoUrl, imageId });
});

// Portrait Upload
app.post('/portrait', async (c) => {
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: 'Tenant context missing' }, 400);
    if (!member) return c.json({ error: 'Member context required' }, 403);

    const body = await c.req.parseBody();
    const file = body['file'] as File;
    const targetMemberId = body['memberId'] as string || member.id;

    const isOwn = targetMemberId === member.id;
    if (!isOwn && !c.get('can')('manage_members')) {
        return c.json({ error: 'Permission denied' }, 403);
    }

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const token = c.env.CLOUDFLARE_API_TOKEN;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify({ type: 'portrait', memberId: targetMemberId }));

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!response.ok) return c.json({ error: `Upload failed` }, 500);

    const data = await response.json() as any;
    const imageId = data.result?.id;
    const portraitUrl = `https://imagedelivery.net/${accountId}/${imageId}/portrait`;

    const db = createDb(c.env.DB);
    const targetMember = await db.select({ userId: tenantMembers.userId })
        .from(tenantMembers)
        .where(and(eq(tenantMembers.id, targetMemberId), eq(tenantMembers.tenantId, tenant.id)))
        .get();

    if (!targetMember) return c.json({ error: 'Target member not found' }, 404);

    const user = await db.select({ profile: users.profile })
        .from(users)
        .where(eq(users.id, targetMember.userId))
        .get();

    const currentProfile = (user?.profile as any) || {};
    await db.update(users)
        .set({ profile: { ...currentProfile, portraitUrl } })
        .where(eq(users.id, targetMember.userId))
        .run();

    return c.json({ portraitUrl, imageId });
});

export default app;
