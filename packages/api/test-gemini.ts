import { Hono } from 'hono';
import { createDb } from './src/db';
import { platformConfig } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import { GeminiService } from './src/services/gemini';

const app = new Hono<{ Bindings: { DB: any, GEMINI_API_KEY: string } }>();

app.get('/test-db', async (c) => {
    try {
        const aiConfigRow = await createDb(c.env.DB).query.platformConfig.findFirst({
            where: eq(platformConfig.key, 'config_ai')
        });
        return c.json({ config: aiConfigRow?.value });
    } catch (e: any) {
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});

app.get('/test-ai', async (c) => {
    try {
        const apiKey = c.env.GEMINI_API_KEY;
        const aiConfigRow = await createDb(c.env.DB).query.platformConfig.findFirst({
            where: eq(platformConfig.key, 'config_ai')
        });
        const gemini = new GeminiService(apiKey, aiConfigRow?.value as any);
        const res = await gemini.generateEmailCopy("hello");
        return c.json({ res });
    } catch (e: any) {
        return c.json({ error: e.message, stack: e.stack }, 500);
    }
});
export default app;
