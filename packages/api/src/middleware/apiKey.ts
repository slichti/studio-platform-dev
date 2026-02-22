
import { createMiddleware } from 'hono/factory';
import { createDb } from '../db';
import { ApiKeyService } from '../services/api-keys';
import { Bindings, Variables } from '../types';
import { eq } from 'drizzle-orm';
import { tenants } from '@studio/db/src/schema';

export const apiKeyMiddleware = createMiddleware<{ Variables: Variables, Bindings: Bindings }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer sp_')) {
        const token = authHeader.split(' ')[1];
        const db = createDb(c.env.DB);

        try {
            const keyRecord = await ApiKeyService.verifyKey(db, token);
            if (keyRecord) {
                // Resolve tenant immediately
                const tenant = await db.query.tenants.findFirst({
                    where: eq(tenants.id, keyRecord.tenantId),
                });

                if (tenant) {
                    c.set('tenant', tenant);
                    c.set('auth', {
                        userId: `system_key`,
                        claims: {
                            sub: `system_key`,
                            tenantId: tenant.id,
                            role: 'api_key',
                            keyId: keyRecord.id,
                            name: keyRecord.name
                        }
                    });
                    c.set('isImpersonating', false); // API keys are not impersonations
                    return await next();
                }
            }
        } catch (e) {
            console.error("API Key Verification Error:", e);
        }
    }

    await next();
});
