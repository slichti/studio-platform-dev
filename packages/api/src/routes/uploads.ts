import { Hono } from 'hono';
import { createDb } from '../db';

import { tenants, tenantMembers, uploads } from 'db';
import { sql, eq, desc, like, and } from 'drizzle-orm';

type Bindings = {
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    R2: R2Bucket;
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: typeof tenantMembers.$inferSelect;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Cloudflare Images
app.post('/image', async (c) => {
    try {
        const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
        const token = c.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !token) {
            return c.json({ error: 'Missing Cloudflare credentials' }, 500);
        }

        const formData = new FormData();
        formData.append('requireSignedURLs', 'false');

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
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});

// R2 File Upload (Presigned URL)
app.post('/file', async (c) => {
    // Requires tenant text
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { filename, contentType } = await c.req.json();
    if (!filename || !contentType) return c.json({ error: 'Filename and content type required' }, 400);

    return c.json({ error: "Use POST /uploads/pdf with FormData" }, 400);
});

app.post('/pdf', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file) return c.json({ error: 'File required' }, 400);

    if (file.type !== 'application/pdf') {
        return c.json({ error: 'Only PDF allowed' }, 400);
    }

    const objectKey = `tenants/${tenant.slug}/waivers/${crypto.randomUUID()}.pdf`;

    // Put to R2
    await c.env.R2.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: {
            contentType: 'application/pdf',
        }
    });

    // DB Tracking
    const db = createDb(c.env.DB);

    // 1. Record Upload
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

    // 2. Increment Tenant Usage
    await db.update(tenants)
        .set({ storageUsage: sql`${tenants.storageUsage} + ${file.size}` })
        .where(eq(tenants.id, tenant.id))
        .run();

    return c.json({ key: objectKey, url: `/uploads/${objectKey}` });
});

app.get('/:key{.+}', async (c) => {
    const key = c.req.param('key');
    const object = await c.env.R2.get(key);

    if (!object) {
        return c.json({ error: 'File not found' }, 404);
    }

    const tenant = c.get('tenant');
    // const isSystemAdmin = c.get('roles')?.includes('owner'); 

    if (key.startsWith('tenants/') && !key.startsWith(`tenants/${tenant.slug}/`)) {
        return c.json({ error: 'Access Denied: Tenant Isolation Violation' }, 403);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, {
        headers,
    });
});

// Generic Image Upload to R2 (e.g. for membership cards)
app.post('/r2-image', async (c) => {
    try {
        const tenant = c.get('tenant');
        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

        const body = await c.req.parseBody();
        const file = body['file'] as File;

        if (!file) return c.json({ error: 'File required' }, 400);

        if (!file.type.startsWith('image/')) {
            return c.json({ error: 'Only images allowed' }, 400);
        }

        const extension = file.type.split('/')[1];
        const objectKey = `tenants/${tenant.slug}/images/${crypto.randomUUID()}.${extension}`;

        await c.env.R2.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type,
            }
        });

        // DB Insert
        const db = createDb(c.env.DB);

        // Typecast body value to string safely or default to filename
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

        // Update storage usage
        await db.update(tenants)
            .set({ storageUsage: sql`${tenants.storageUsage} + ${file.size}` })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ key: objectKey, url: `/uploads/${objectKey}` });
    } catch (e: any) {
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});

// List Images
app.get('/images', async (c) => {
    try {
        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');

        const results = await db.select()
            .from(uploads)
            .where(and(
                eq(uploads.tenantId, tenant.id),
                like(uploads.mimeType, 'image/%')
            ))
            .orderBy(desc(uploads.createdAt))
            .all();

        return c.json(results);
    } catch (e: any) {
        console.error("GET /uploads/images error", e);
        // SAFETY: Return empty list on crash
        return c.json([]);
    }
});

// Update Image Metadata
app.patch('/images/:id', async (c) => {
    try {
        const db = createDb(c.env.DB);
        const tenant = c.get('tenant');
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
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// --- Logo Upload (Owner/Admin only) ---
// Uploads to Cloudflare Images and saves URL to tenant branding
app.post('/logo', async (c) => {
    try {
        const tenant = c.get('tenant');
        const roles = c.get('roles') || [];
        const db = createDb(c.env.DB);

        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
        if (!roles.includes('owner')) return c.json({ error: 'Owner access required' }, 403);

        const body = await c.req.parseBody();
        const file = body['file'] as File;
        if (!file) return c.json({ error: 'File required' }, 400);
        if (!file.type.startsWith('image/')) return c.json({ error: 'Only images allowed' }, 400);

        // Upload to Cloudflare Images
        const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
        const token = c.env.CLOUDFLARE_API_TOKEN;

        const formData = new FormData();
        formData.append('file', file);
        // Add metadata for resizing - logo max 200x200
        formData.append('metadata', JSON.stringify({ type: 'logo', tenantId: tenant.id }));

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            return c.json({ error: `Upload failed: ${error}` }, 500);
        }

        const data = await response.json() as any;
        const imageId = data.result?.id;
        // Use public variant URL (Cloudflare Images auto-generates variants)
        const logoUrl = `https://imagedelivery.net/${accountId}/${imageId}/logo`;

        // Update tenant branding
        const currentBranding = (tenant.branding as any) || {};
        await db.update(tenants)
            .set({
                branding: { ...currentBranding, logoUrl }
            })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ logoUrl, imageId });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// --- Portrait Upload (Instructor/Member photos) ---
// Uploads to Cloudflare Images and saves URL to member profile
import { users } from 'db';

app.post('/portrait', async (c) => {
    try {
        const tenant = c.get('tenant');
        const member = c.get('member');
        const roles = c.get('roles') || [];
        const db = createDb(c.env.DB);

        if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
        if (!member) return c.json({ error: 'Member context required' }, 403);

        const body = await c.req.parseBody();
        const file = body['file'] as File;
        const targetMemberId = body['memberId'] as string || member.id;

        if (!file) return c.json({ error: 'File required' }, 400);
        if (!file.type.startsWith('image/')) return c.json({ error: 'Only images allowed' }, 400);

        // Permission check: own profile OR owner/instructor can upload for others
        const isOwn = targetMemberId === member.id;
        const canUploadForOthers = roles.includes('owner') || roles.includes('instructor');
        if (!isOwn && !canUploadForOthers) {
            return c.json({ error: 'Permission denied' }, 403);
        }

        // Upload to Cloudflare Images
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

        if (!response.ok) {
            const error = await response.text();
            return c.json({ error: `Upload failed: ${error}` }, 500);
        }

        const data = await response.json() as any;
        const imageId = data.result?.id;
        // Portrait variant - 400x400 fit cover
        const portraitUrl = `https://imagedelivery.net/${accountId}/${imageId}/portrait`;

        // Get target member's userId to update user profile
        const targetMember = await db.select({ userId: tenantMembers.userId })
            .from(tenantMembers)
            .where(and(eq(tenantMembers.id, targetMemberId), eq(tenantMembers.tenantId, tenant.id)))
            .get();

        if (!targetMember) return c.json({ error: 'Target member not found' }, 404);

        // Update user's global profile with portrait
        const user = await db.select({ profile: users.profile })
            .from(users)
            .where(eq(users.id, targetMember.userId))
            .get();

        const currentProfile = (user?.profile as any) || {};
        await db.update(users)
            .set({
                profile: { ...currentProfile, portraitUrl }
            })
            .where(eq(users.id, targetMember.userId))
            .run();

        return c.json({ portraitUrl, imageId });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
