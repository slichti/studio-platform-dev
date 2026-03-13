
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { apiKeys } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

/** Prefix for keys we issue (Bearer sp_...) */
const API_KEY_PREFIX = 'sp_';
/** Raw key body length after prefix (UUID without dashes = 32 hex chars) */
const API_KEY_BODY_LEN = 32;

function isValidRawKeyFormat(rawKey: string): boolean {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) return false;
    const body = rawKey.slice(API_KEY_PREFIX.length);
    return body.length === API_KEY_BODY_LEN && /^[0-9a-f]+$/.test(body);
}

/**
 * Legacy hash: SHA-256(rawKey) as hex. Used for existing rows and when no pepper is configured.
 */
async function hashApiKeyLegacy(rawKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Peppered hash: HMAC-SHA256(pepper, rawKey) as hex. Mitigates offline brute force if DB leaks.
 * Requires pepper length >= 32 (same bar as EncryptionUtils).
 */
async function hashApiKeyPeppered(rawKey: string, pepper: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pepper),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawKey));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export type ApiKeyVerifyBindings = {
    ENCRYPTION_SECRET?: string;
    API_KEY_PEPPER?: string;
};

export class ApiKeyService {
    constructor(private db: DrizzleD1Database<any>, private tenantId: string) { }

    /**
     * Pepper: prefer API_KEY_PEPPER, else ENCRYPTION_SECRET (>=32 chars).
     * When set, new keys are stored as HMAC-SHA256(pepper, rawKey).
     */
    static getPepper(env: ApiKeyVerifyBindings | undefined): string | undefined {
        if (!env) return undefined;
        const p = env.API_KEY_PEPPER || env.ENCRYPTION_SECRET;
        if (p && p.length >= 32) return p;
        return undefined;
    }

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

    async createKey(name: string, expiresAt?: Date, env?: ApiKeyVerifyBindings) {
        const id = crypto.randomUUID();
        const rawKey = `${API_KEY_PREFIX}${crypto.randomUUID().replace(/-/g, '')}`;
        const prefix = rawKey.substring(0, 7);

        const pepper = ApiKeyService.getPepper(env);
        const keyHash = pepper
            ? await hashApiKeyPeppered(rawKey, pepper)
            : await hashApiKeyLegacy(rawKey);

        if (!pepper) {
            console.warn('[ApiKeyService] Creating API key without pepper; set ENCRYPTION_SECRET (>=32) for HMAC at rest.');
        }

        await this.db.insert(apiKeys).values({
            id,
            tenantId: this.tenantId,
            name,
            keyHash,
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

    /**
     * Verify raw key and return key record. Tries peppered HMAC first, then legacy SHA-256.
     * Rejects malformed keys early to avoid unnecessary work.
     */
    static async verifyKey(db: DrizzleD1Database<any>, rawKey: string, env?: ApiKeyVerifyBindings) {
        if (!isValidRawKeyFormat(rawKey)) return null;

        const pepper = ApiKeyService.getPepper(env);

        // 1) Peppered lookup (new keys)
        if (pepper) {
            const keyHash = await hashApiKeyPeppered(rawKey, pepper);
            const keyRecord = await db.select()
                .from(apiKeys)
                .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
                .get();
            if (keyRecord) return ApiKeyService.finishVerify(db, keyRecord);
        }

        // 2) Legacy SHA-256 lookup (existing rows)
        const legacyHash = await hashApiKeyLegacy(rawKey);
        const keyRecordLegacy = await db.select()
            .from(apiKeys)
            .where(and(eq(apiKeys.keyHash, legacyHash), eq(apiKeys.isActive, true)))
            .get();
        if (keyRecordLegacy) return ApiKeyService.finishVerify(db, keyRecordLegacy);

        return null;
    }

    private static async finishVerify(db: DrizzleD1Database<any>, keyRecord: typeof apiKeys.$inferSelect) {
        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            return null;
        }
        await db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, keyRecord.id))
            .run();
        return keyRecord;
    }
}
