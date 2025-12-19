import { Hono } from 'hono';

type Bindings = {
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/image', async (c) => {
    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const token = c.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !token) {
        return c.json({ error: 'Missing Cloudflare credentials' }, 500);
    }

    const formData = new FormData();
    // requireSignedURLs: false means we can serve it publicly easily
    formData.append('requireSignedURLs', 'false');

    // Cloudflare Images Direct Upload
    // POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/images/v2/direct_upload
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
    // Returns { result: { uploadURL: "...", id: "..." }, success: true }
    return c.json(data.result);
});

export default app;
