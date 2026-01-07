import { createDb } from '../db';
import { eq, count, and, sql, sum } from 'drizzle-orm';
import { tenants, tenantMembers, classes, purchasedPacks, tenantRoles, uploads, locations } from 'db/src/schema';

export type Tier = 'basic' | 'growth' | 'scale';

export const TIERS: Record<Tier, {
    name: string;
    price: number; // Monthly in cents
    applicationFeePercent: number; // Percentage taken from transactions (e.g. 0.05 for 5%)
    limits: {
        students: number; // -1 for unlimited
        instructors: number;
        locations: number;
        storageGB: number;
        sms: number;
        email: number;
        streamingMinutes: number;
    };
    features: string[]; // Enabled feature flags
}> = {
    basic: { // "Launch"
        name: 'Launch',
        price: 0,
        applicationFeePercent: 0.05, // 5% Application Fee
        limits: {
            students: -1, // Unlimited students to reduce friction
            instructors: 5,
            locations: 1,
            storageGB: 5,
            sms: 0,
            email: 1000,
            streamingMinutes: 0 // No VOD
        },
        features: ['financials', 'notifications']
    },
    growth: {
        name: 'Growth',
        price: 4900, // $49/mo
        applicationFeePercent: 0.015, // 1.5% Application Fee
        limits: {
            students: -1,
            instructors: 15,
            locations: 3,
            storageGB: 50,
            sms: 1500,
            email: 10000,
            streamingMinutes: 1000 // ~16 hours
        },
        features: ['financials', 'notifications', 'zoom', 'vod', 'automations', 'sms']
    },
    scale: {
        name: 'Scale',
        price: 12900, // $129/mo
        applicationFeePercent: 0.0, // 0% Application Fee
        limits: {
            students: -1,
            instructors: -1,
            locations: -1,
            storageGB: 1000,
            sms: 5000,
            email: 50000,
            streamingMinutes: -1 // Unlimited
        },
        features: ['financials', 'notifications', 'zoom', 'vod', 'automations', 'sms', 'white_label', 'api_access']
    }
};

export class PricingService {
    static getTierConfig(tier: string) {
        return TIERS[tier as Tier] || TIERS.basic;
    }

    static isFeatureEnabled(tier: string, feature: string) {
        const config = this.getTierConfig(tier);
        return config.features.includes(feature);
    }
}

export class UsageService {
    private db: any;
    private tenantId: string;

    constructor(db: any, tenantId: string) {
        this.db = db;
        this.tenantId = tenantId;
    }

    async getUsage() {
        // 1. Count Students (Members with role 'student')
        // Actually, schema has roles in separate table. 
        // For simplicity, let's count all members as "Users" or specifically query roles.
        // Let's count Total Active Members for now.
        const memberCount = await this.db.select({ count: count() })
            .from(tenantMembers)
            .where(and(eq(tenantMembers.tenantId, this.tenantId), eq(tenantMembers.status, 'active')))
            .get();

        // 2. Count Locations
        // const { locations, tenantRoles } = await import('db/src/schema'); // Moved to top-level
        const locationCount = await this.db.select({ count: count() })
            .from(locations)
            .where(eq(locations.tenantId, this.tenantId))
            .get();

        // Count Instructors
        // We need to join tenantMembers -> tenantRoles
        // But simpler: just count tenantRoles where role='instructor' AND member belongs to tenant
        // Since tenantRoles doesn't have tenantId, we join tenantMembers.
        const instructorCount = await this.db.select({ count: count() })
            .from(tenantRoles)
            .innerJoin(tenantMembers, eq(tenantRoles.memberId, tenantMembers.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantRoles.role, 'instructor'),
                eq(tenantMembers.status, 'active')
            ))
            .get();

        // 4. SMS, Email, Streaming Usage (from tenants table)
        const tenant = await this.db.select({
            smsUsage: tenants.smsUsage,
            emailUsage: tenants.emailUsage,
            streamingUsage: tenants.streamingUsage,

            smsLimit: tenants.smsLimit,
            emailLimit: tenants.emailLimit,
            streamingLimit: tenants.streamingLimit,

            tier: tenants.tier
        }).from(tenants).where(eq(tenants.id, this.tenantId)).get();

        // 5. Storage (From DB Column, updated via Uploads)
        const storageBytes = tenant?.storageUsage || 0;
        const storageGB = storageBytes / (1024 * 1024 * 1024);

        return {
            students: memberCount?.count || 0,
            instructors: instructorCount?.count || 0,
            locations: locationCount?.count || 0,

            smsUsage: tenant?.smsUsage || 0,
            emailUsage: tenant?.emailUsage || 0,
            streamingUsage: tenant?.streamingUsage || 0,

            tier: tenant?.tier || 'basic',
            // Return effective limits (manual override vs tier default)
            smsLimit: tenant?.smsLimit ?? PricingService.getTierConfig(tenant?.tier).limits.sms,
            emailLimit: tenant?.emailLimit ?? PricingService.getTierConfig(tenant?.tier).limits.email,
            streamingLimit: tenant?.streamingLimit ?? PricingService.getTierConfig(tenant?.tier).limits.streamingMinutes,

            storageGB
        };
    }

    // Sync Helper for Admin Dashboard sorting accuracy
    async syncTenantStats() {
        // 1. Members
        const memberCount = await this.db.select({ count: count() })
            .from(tenantMembers)
            .where(and(eq(tenantMembers.tenantId, this.tenantId), eq(tenantMembers.status, 'active')))
            .get();

        // 2. Instructors
        const instructorCount = await this.db.select({ count: count() })
            .from(tenantRoles)
            .innerJoin(tenantMembers, eq(tenantRoles.memberId, tenantMembers.id))
            .where(and(
                eq(tenantMembers.tenantId, this.tenantId),
                eq(tenantRoles.role, 'instructor'),
                eq(tenantMembers.status, 'active')
            ))
            .get();

        // 3. Storage (Sum uploads table)
        const storageSum = await this.db.select({ size: sql`sum(${uploads.sizeBytes})` }) // Drizzle sum() helper sometimes weird, using sql is safer
            .from(uploads)
            .where(eq(uploads.tenantId, this.tenantId))
            .get();

        const totalStorage = Number(storageSum?.size || 0);

        // 4. Streaming (Sum duration of 'ready' classes)
        // Assumption: classes.durationMinutes holds the VOD length
        const streamingSum = await this.db.select({ duration: sql`sum(${classes.durationMinutes})` })
            .from(classes)
            .where(and(
                eq(classes.tenantId, this.tenantId),
                eq(classes.recordingStatus, 'ready')
            ))
            .get();

        const totalStreamingMins = Number(streamingSum?.duration || 0);

        await this.db.update(tenants)
            .set({
                memberCount: memberCount?.count || 0,
                instructorCount: instructorCount?.count || 0,
                storageUsage: totalStorage,
                streamingUsage: totalStreamingMins
            })
            .where(eq(tenants.id, this.tenantId))
            .run();
    }

    async checkLimit(limitKey: 'students' | 'instructors' | 'locations' | 'smsUsage' | 'emailUsage' | 'streamingUsage', currentTier: string) {
        const usage = await this.getUsage();

        // Handle Resource Usage (SMS, Email, Streaming)
        if (limitKey === 'smsUsage' || limitKey === 'emailUsage' || limitKey === 'streamingUsage') {
            let limit: number;
            if (limitKey === 'smsUsage') limit = usage.smsLimit;
            else if (limitKey === 'emailUsage') limit = usage.emailLimit;
            else limit = usage.streamingLimit; // streamingUsage

            if (limit === -1) return true;
            return (usage[limitKey] as number) < limit;
        }

        const config = PricingService.getTierConfig(currentTier);
        const limit = config.limits[limitKey as 'students' | 'instructors' | 'locations'];

        if (limit === -1) return true;
        return (usage[limitKey as 'students' | 'instructors' | 'locations'] as number) < limit;
    }

    async canSend(service: 'sms' | 'email'): Promise<boolean> {
        // 1. Fetch Tenant Status
        const tenant = await this.db.select({
            billingExempt: tenants.billingExempt,
            smsUsage: tenants.smsUsage,
            emailUsage: tenants.emailUsage,
            smsLimit: tenants.smsLimit,
            emailLimit: tenants.emailLimit,
            tier: tenants.tier
        }).from(tenants).where(eq(tenants.id, this.tenantId)).get();

        if (!tenant) return false;
        if (tenant.billingExempt) return true; // Unlimited for friends/VIPs

        // 2. Check Limits
        const limit = tenant[`${service}Limit`] ?? PricingService.getTierConfig(tenant.tier).limits[service];

        if (limit === -1) return true; // Unlimited Tier

        return (tenant[`${service}Usage`] || 0) < limit;
    }

    async incrementUsage(service: 'sms' | 'email', amount = 1) {
        const column = service === 'sms' ? tenants.smsUsage : tenants.emailUsage;
        await this.db.update(tenants)
            .set({ [service === 'sms' ? 'smsUsage' : 'emailUsage']: sql`${column} + ${amount}` })
            .where(eq(tenants.id, this.tenantId))
            .run();
    }
}
