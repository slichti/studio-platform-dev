
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { apiKeys } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

export class ApiKeyService {
    constructor(private db: DrizzleD1Database<any>, private tenantId: string) { }

    async listKeys() {
        return this.db.select({
            id: apiKeys.id,
            name: apiKeys.name,
            prefix: apiKeys.prefix,
            lastUsedAt: apiKeys.lastUsedAt,
            expiresAt: apiKeys.expiresAt,
            isActive: apiKeys.isActive,
            createdAt: apiKeys.createdAt
        })
            .from(apiKeys)
            .where(eq(apiKeys.tenantId, this.tenantId))
            .all();
    }

    async createKey(name: string, expiresAt?: Date) {
        const id = crypto.randomUUID();
        const rawKey = `sp_${crypto.randomUUID().replace(/-/g, '')}`;
        const prefix = rawKey.substring(0, 7); // sp_ + 4 chars

        // Hash the key using SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(rawKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await this.db.insert(apiKeys).values({
            id,
            tenantId: this.tenantId,
            name,
            keyHash: hashHex,
            prefix,
            expiresAt,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).run();

        return { id, key: rawKey };
    }

    async revokeKey(id: string) {
        await this.db.update(apiKeys)
            .set({ isActive: false, updatedAt: new Date() })
            .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, this.tenantId)))
            .run();
    }

    async deleteKey(id: string) {
        await this.db.delete(apiKeys)
            .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, this.tenantId)))
            .run();
    }

    static async verifyKey(db: DrizzleD1Database<any>, rawKey: string) {
        const encoder = new TextEncoder();
        const data = encoder.encode(rawKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const keyRecord = await db.select()
            .from(apiKeys)
            .where(and(eq(apiKeys.keyHash, hashHex), eq(apiKeys.isActive, true)))
            .get();

        if (!keyRecord) return null;

        // Check expiration
        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            return null;
        }

        // Update last used
        await db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, keyRecord.id))
            .run();

        return keyRecord;
    }
}
