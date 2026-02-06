import { createDb } from '../src/db';
import {
    tenants, tenantMembers, users, classes, bookings, posOrders,
    locations, membershipPlans, classPackDefinitions,
    purchasedPacks, subscriptions, waitlist, giftCards,
    marketingAutomations
} from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

const BACKUP_RETENTION_DAYS = 90;

interface Env {
    DB: any;
    R2: any;
}

interface TenantBackupData {
    metadata: {
        version: string;
        tenantId: string;
        tenantSlug: string;
        tenantName: string;
        exportedAt: string;
        tableCount: number;
        recordCount: number;
    };
    tenant: any;
    members: any[];
    classes: any[];
    orders: any[];
    locations: any[];
    membershipPlans: any[];
    classPacks: any[];
    purchasedPacks: any[];
    subscriptions: any[];
    waitlist: any[];
    giftCards: any[];
    automations: any[];
}

/**
 * Export a single tenant's data to JSON
 */
export async function exportTenantData(db: any, tenantId: string): Promise<TenantBackupData> {
    // Fetch tenant
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Fetch all tenant-related data (only tables with tenantId)
    const members = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId)).all();
    const tenantClasses = await db.select().from(classes).where(eq(classes.tenantId, tenantId)).all();
    const orders = await db.select().from(posOrders).where(eq(posOrders.tenantId, tenantId)).all();
    const tenantLocations = await db.select().from(locations).where(eq(locations.tenantId, tenantId)).all();
    const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.tenantId, tenantId)).all();
    const packs = await db.select().from(classPackDefinitions).where(eq(classPackDefinitions.tenantId, tenantId)).all();
    const purchased = await db.select().from(purchasedPacks).where(eq(purchasedPacks.tenantId, tenantId)).all();
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).all();
    const waits = await db.select().from(waitlist).where(eq(waitlist.tenantId, tenantId)).all();
    const gifts = await db.select().from(giftCards).where(eq(giftCards.tenantId, tenantId)).all();
    const autos = await db.select().from(marketingAutomations).where(eq(marketingAutomations.tenantId, tenantId)).all();

    // Calculate record count
    const recordCount = members.length + tenantClasses.length + orders.length +
        tenantLocations.length + plans.length + packs.length +
        purchased.length + subs.length + waits.length + gifts.length + autos.length;

    return {
        metadata: {
            version: '2.0',
            tenantId,
            tenantSlug: tenant.slug,
            tenantName: tenant.name,
            exportedAt: new Date().toISOString(),
            tableCount: 11,
            recordCount
        },
        tenant,
        members,
        classes: tenantClasses,
        orders,
        locations: tenantLocations,
        membershipPlans: plans,
        classPacks: packs,
        purchasedPacks: purchased,
        subscriptions: subs,
        waitlist: waits,
        giftCards: gifts,
        automations: autos
    };
}

/**
 * Backup a single tenant to R2
 */
export async function backupTenant(env: Env, tenantId: string): Promise<{ key: string; size: number }> {
    const db = createDb(env.DB);
    const timestamp = new Date().toISOString().split('T')[0];

    console.log(`  📦 Backing up tenant: ${tenantId}`);

    const data = await exportTenantData(db, tenantId);
    const jsonContent = JSON.stringify(data, null, 2);
    const sizeBytes = new Blob([jsonContent]).size;

    const key = `backups/tenants/${tenantId}/backup-${timestamp}.json`;

    await env.R2.put(key, jsonContent, {
        customMetadata: {
            type: 'tenant',
            tenantId,
            tenantSlug: data.metadata.tenantSlug,
            createdAt: new Date().toISOString(),
            sizeBytes: String(sizeBytes),
            recordCount: String(data.metadata.recordCount)
        }
    });

    console.log(`     ✓ Uploaded: ${key} (${(sizeBytes / 1024).toFixed(2)} KB, ${data.metadata.recordCount} records)`);

    return { key, size: sizeBytes };
}

/**
 * Backup all active tenants
 */
export async function backupAllTenants(env: Env): Promise<{ success: number; failed: number }> {
    const db = createDb(env.DB);

    console.log('🏢 Starting per-tenant backups...');

    // Get all active tenants
    const activeTenants = await db.select({ id: tenants.id, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.status, 'active'))
        .all();

    console.log(`   Found ${activeTenants.length} active tenants`);

    let success = 0;
    let failed = 0;

    for (const tenant of activeTenants) {
        try {
            await backupTenant(env, tenant.id);
            success++;
        } catch (error: any) {
            console.error(`   ❌ Failed to backup tenant ${tenant.slug}: ${error.message}`);
            failed++;
        }
    }

    console.log(`✅ Per-tenant backups complete: ${success} succeeded, ${failed} failed`);

    // Clean up old tenant backups
    await cleanupOldTenantBackups(env);

    return { success, failed };
}

/**
 * Clean up tenant backups older than retention period
 */
async function cleanupOldTenantBackups(env: Env): Promise<number> {
    console.log('🧹 Cleaning up old tenant backups...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    const list = await env.R2.list({ prefix: 'backups/tenants/' });
    let deletedCount = 0;

    for (const object of list.objects) {
        const uploadDate = new Date(object.uploaded);
        if (uploadDate < cutoffDate) {
            await env.R2.delete(object.key);
            console.log(`   Deleted: ${object.key}`);
            deletedCount++;
        }
    }

    if (deletedCount === 0) {
        console.log('   No old tenant backups to delete');
    } else {
        console.log(`   ✓ Deleted ${deletedCount} old tenant backup(s)`);
    }

    return deletedCount;
}

/**
 * List all backups for a specific tenant
 */
export async function listTenantBackups(env: Env, tenantId: string): Promise<any[]> {
    const prefix = `backups/tenants/${tenantId}/`;
    const list = await env.R2.list({ prefix });

    return list.objects.map((obj: any) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        customMetadata: obj.customMetadata
    }));
}

/**
 * Download a specific tenant backup
 */
export async function downloadTenantBackup(env: Env, key: string): Promise<TenantBackupData | null> {
    const object = await env.R2.get(key);
    if (!object) return null;

    const text = await object.text();
    return JSON.parse(text);
}
