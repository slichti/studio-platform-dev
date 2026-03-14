import { tags } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import type { createDb } from '../db';

/** Default tag definitions to create for every tenant. Tenants can edit or remove them. */
export const DEFAULT_TAG_DEFINITIONS = [
    { name: 'New Member', slug: 'new-member', description: 'New members; use for onboarding and welcome flows.', category: 'access' as const },
    { name: 'VIP', slug: 'vip', description: 'VIP or loyal members.', category: 'access' as const },
    { name: 'Senior', slug: 'senior', description: 'e.g. 65+; use for senior-specific classes.', category: 'access' as const },
    { name: 'Silver Sneakers', slug: 'silver-sneakers', description: 'Silver Sneakers® or similar insurance program.', category: 'access' as const },
    { name: 'Trial', slug: 'trial', description: 'Currently in trial period.', category: 'access' as const },
    { name: 'Instructor', slug: 'instructor', description: 'Staff / instructor.', category: 'internal' as const },
] as const;

type Db = ReturnType<typeof createDb>;

/**
 * Ensures default tags exist for a tenant. Inserts only tags whose slug is not already present.
 * Safe to call on every tenant creation and when listing tags (backfill for existing tenants).
 */
export async function ensureDefaultTagsForTenant(db: Db, tenantId: string): Promise<void> {
    const existing = await db.select({ slug: tags.slug }).from(tags).where(eq(tags.tenantId, tenantId)).all();
    const existingSlugs = new Set(existing.map((r) => r.slug));

    const toInsert = DEFAULT_TAG_DEFINITIONS.filter((d) => !existingSlugs.has(d.slug));
    if (toInsert.length === 0) return;

    const values = toInsert.map((d) => ({
        id: `tag_${crypto.randomUUID()}`,
        tenantId,
        name: d.name,
        slug: d.slug,
        description: d.description ?? null,
        category: d.category ?? null,
        discountType: 'none' as const,
        visibility: 'internal_only' as const,
    }));

    await db.insert(tags).values(values).run();
}
