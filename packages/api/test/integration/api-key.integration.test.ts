/**
 * API key authentication: valid key sets tenant and auth; invalid key does not.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';
import { ApiKeyService } from '../../src/services/api-keys';
import { createDb } from '../../src/db';

const TENANT_ID = 'tenant_apikey';
const SLUG = 'apikey-studio';

describe('API key integration', () => {
    let rawKey: string;

    beforeAll(async () => {
        const d1 = env.DB;
        await setupTestDb(d1);
        const db = createDb(d1);

        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: SLUG,
            name: 'API Key Studio',
            status: 'active',
        }).run();

        const service = new ApiKeyService(db, TENANT_ID);
        const result = await service.createKey('Test Key');
        rawKey = result.key;
    });

    it('returns 200 for protected route with valid API key (Bearer sp_...)', async () => {
        const res = await SELF.fetch(new Request('http://localhost/tenant/info', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${rawKey}` },
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('id');
        expect(body.id).toBe(TENANT_ID);
    });

    it('returns 401 for protected route with invalid API key', async () => {
        const res = await SELF.fetch(new Request('http://localhost/tenant/info', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer sp_invalidkey1234567890abcdef' },
        }));
        expect(res.status).toBe(401);
    });
});
