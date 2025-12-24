import { Hono } from 'hono';

import { tenants, tenantMembers } from 'db/src/schema'; // Assuming db package access
// Actually better to use the types defined in index.ts or re-define locally if simpler
// But we need the Types for c.get('tenant')

type Bindings = {
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    R2: R2Bucket;
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
    // ... existing ... (lines 10-40)
    // Note: I will keep existing logic but just add new route below it. 
    // Wait, the replacement chunk replaces the whole block.
    // I need to be careful not to delete existing code if I use replace_file_content on a block.
    // The previous tool usage `view_file` showed lines 10-40 contain the `/image` handler.
    // I will append `/file` handler after it.
    // RE-READING: I should just add the new handler.
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
});

// R2 File Upload (Presigned URL)
app.post('/file', async (c) => {
    // Requires tenant text
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { filename, contentType } = await c.req.json();
    if (!filename || !contentType) return c.json({ error: 'Filename and content type required' }, 400);

    // Key Strategy: tenants/<slug>/<uuid>-<filename>
    const objectKey = `tenants/${tenant.slug}/waivers/${crypto.randomUUID()}-${filename}`;

    // R2 Presigned URL
    // Hono doesn't have R2 presign built-in for the binding directly (it's standard S3 compatible usually, but Workers R2 binding has specific API).
    // WORKERS R2 BINDING does NOT support presigning directly easily without `aws-sdk`.
    // BUT we can use `put` directly if we proxy? No, we want direct upload.
    // Actually, Workers R2 Binding `put` method is for backend upload.
    // To upload from Client, we need S3 compatibility + presigned URL.
    // OR we use a worker endpoint to proxy the upload. "Proxying" is easier with binding.
    // "Presigned" required AWS SDK V3 R2.
    // Given I don't want to install new packages if possible...
    // Let's implement a PROXY endpoint: PUT /uploads/file/:key
    // Client POSTs file to API, API puts to R2.
    // LIMIT: Workers size limit (100MB). PDFs are usually small.
    // Let's stick to Proxy for simplicity unless `aws-sdk` is present.
    // I don't see `aws-sdk` in package.json (I haven't checked).
    // I will use PROXY upload for now.

    // WAIT. If I use proxy, I don't need `POST /file` to get a URL.
    // I just need `POST /uploads/file` with FormData.
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

    // We can assume a public domain or just return the key.
    // If bucket is public, we can construct URL.
    // If not, we need a "GET /file/:key" proxy.
    // Let's assume we want to serve it publicly.
    // I don't know the R2 public domain.
    // I will return the KEY and a helper URL construction?
    // Let's just return the key and assume we serve it via a GET endpoint.

    return c.json({ key: objectKey, url: `/uploads/${objectKey}` });
});

app.get('/:key{.+}', async (c) => {
    const key = c.req.param('key');
    const object = await c.env.R2.get(key);

    if (!object) return c.json({ error: "Not found" }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new Response(object.body, {
        headers,
    });
});

export default app;
