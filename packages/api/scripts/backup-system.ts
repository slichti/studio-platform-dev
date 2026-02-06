/**
 * Worker-Compatible Full System Backup
 * 
 * Exports all database tables to JSON and stores in R2.
 * Works within Cloudflare Workers (no Node.js dependencies).
 */

import { createDb } from '../src/db';
import {
    tenants, users, tenantMembers, classes, bookings, posOrders,
    locations, membershipPlans, classPackDefinitions, purchasedPacks,
    subscriptions, waitlist, giftCards, marketingAutomations,
    auditLogs, uploads, customRoles, memberCustomRoles, userRelationships,
    tenantFeatures, backupMetadata, restoreHistory
} from '@studio/db/src/schema';

interface SystemBackupData {
    metadata: {
        version: string;
        exportedAt: string;
        tableCount: number;
        totalRecords: number;
    };
    tables: {
        tenants: any[];
        users: any[];
        tenantMembers: any[];
        classes: any[];
        bookings: any[];
        posOrders: any[];
        locations: any[];
        membershipPlans: any[];
        classPackDefinitions: any[];
        purchasedPacks: any[];
        subscriptions: any[];
        waitlist: any[];
        giftCards: any[];
        marketingAutomations: any[];
        auditLogs: any[];
        uploads: any[];
        customRoles: any[];
        memberCustomRoles: any[];
        userRelationships: any[];
        tenantFeatures: any[];
    };
}

/**
 * Export all database tables to JSON format
 */
export async function exportFullDatabase(env: any): Promise<SystemBackupData> {
    const db = createDb(env.DB);

    console.log('📦 Starting full database export...');

    // Export all tables
    const [
        tenantsData,
        usersData,
        membersData,
        classesData,
        bookingsData,
        ordersData,
        locationsData,
        plansData,
        packsData,
        purchasedData,
        subsData,
        waitlistData,
        giftsData,
        automationsData,
        logsData,
        uploadsData,
        rolesData,
        memberRolesData,
        relationshipsData,
        featuresData
    ] = await Promise.all([
        db.select().from(tenants).all(),
        db.select().from(users).all(),
        db.select().from(tenantMembers).all(),
        db.select().from(classes).all(),
        db.select().from(bookings).all(),
        db.select().from(posOrders).all(),
        db.select().from(locations).all(),
        db.select().from(membershipPlans).all(),
        db.select().from(classPackDefinitions).all(),
        db.select().from(purchasedPacks).all(),
        db.select().from(subscriptions).all(),
        db.select().from(waitlist).all(),
        db.select().from(giftCards).all(),
        db.select().from(marketingAutomations).all(),
        db.select().from(auditLogs).all(),
        db.select().from(uploads).all(),
        db.select().from(customRoles).all(),
        db.select().from(memberCustomRoles).all(),
        db.select().from(userRelationships).all(),
        db.select().from(tenantFeatures).all()
    ]);

    const totalRecords = tenantsData.length + usersData.length + membersData.length +
        classesData.length + bookingsData.length + ordersData.length +
        locationsData.length + plansData.length + packsData.length +
        purchasedData.length + subsData.length + waitlistData.length +
        giftsData.length + automationsData.length + logsData.length +
        uploadsData.length + rolesData.length + memberRolesData.length +
        relationshipsData.length + featuresData.length;

    console.log(`   ✓ Exported ${totalRecords} records from 20 tables`);

    return {
        metadata: {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            tableCount: 20,
            totalRecords
        },
        tables: {
            tenants: tenantsData,
            users: usersData,
            tenantMembers: membersData,
            classes: classesData,
            bookings: bookingsData,
            posOrders: ordersData,
            locations: locationsData,
            membershipPlans: plansData,
            classPackDefinitions: packsData,
            purchasedPacks: purchasedData,
            subscriptions: subsData,
            waitlist: waitlistData,
            giftCards: giftsData,
            marketingAutomations: automationsData,
            auditLogs: logsData,
            uploads: uploadsData,
            customRoles: rolesData,
            memberCustomRoles: memberRolesData,
            userRelationships: relationshipsData,
            tenantFeatures: featuresData
        }
    };
}

/**
 * Create a full system backup and store in R2
 */
export async function createSystemBackup(env: any): Promise<{ key: string; size: number; recordCount: number }> {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `backup-${timestamp}.json`;
    const key = `backups/system/${filename}`;

    console.log(`📦 Creating system backup: ${key}`);

    // Export database
    const data = await exportFullDatabase(env);
    const jsonContent = JSON.stringify(data, null, 2);
    const sizeBytes = new TextEncoder().encode(jsonContent).length;

    // Upload to R2
    await env.R2.put(key, jsonContent, {
        customMetadata: {
            createdAt: new Date().toISOString(),
            recordCount: String(data.metadata.totalRecords),
            tableCount: String(data.metadata.tableCount),
            sizeBytes: String(sizeBytes)
        }
    });

    console.log(`   ✓ Uploaded to R2: ${key} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

    // Clean up old backups (keep 90 days)
    await cleanupOldSystemBackups(env);

    return {
        key,
        size: sizeBytes,
        recordCount: data.metadata.totalRecords
    };
}

/**
 * Clean up system backups older than 90 days
 */
export async function cleanupOldSystemBackups(env: any): Promise<number> {
    const RETENTION_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log('🧹 Cleaning up old system backups...');

    const list = await env.R2.list({ prefix: 'backups/system/' });
    let deletedCount = 0;

    for (const object of list.objects) {
        const uploadDate = new Date(object.uploaded);
        if (uploadDate < cutoffDate) {
            await env.R2.delete(object.key);
            console.log(`   Deleted: ${object.key}`);
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        console.log(`   ✓ Deleted ${deletedCount} old backup(s)`);
    }

    return deletedCount;
}
