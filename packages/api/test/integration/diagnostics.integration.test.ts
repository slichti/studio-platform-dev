import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Diagnostics Integration', () => {
    let db: any;
    const ADMIN_ID = 'platform_admin';

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // Seed Platform Admin
        await db.insert(schema.users).values({
            id: ADMIN_ID,
            email: 'admin@studio.com',
            isPlatformAdmin: 1,
            role: 'user'
        }).run();
    });

    it('should return 200 OK and database status', async () => {
        const response = await SELF.fetch('https://api.studio.local/diagnostics', {
            method: 'GET',
            headers: {
                'TEST-AUTH': ADMIN_ID
            }
        });

        if (response.status !== 200) {
            console.log('Diagnostics Error:', await response.clone().text());
        }

        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data.status).toBe('ok');
        expect(data.latency).toBeDefined();
    });
});
