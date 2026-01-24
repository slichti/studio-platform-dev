import { createDb } from '../db';
import { eq, count, and, sql, sum } from 'drizzle-orm';
import { tenants, tenantMembers, classes, purchasedPacks, tenantRoles, uploads, locations, usageLogs } from '@studio/db/src/schema';
import { Resend } from 'resend';

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
        // const { locations, tenantRoles } = await import('@studio/db/src/schema'); // Moved to top-level
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

    async incrementUsage(service: 'sms' | 'email' | 'vod_minutes' | 'vod_storage', amount = 1, metadata: any = {}) {
        const columnMap = {
            sms: 'smsUsage',
            email: 'emailUsage',
            vod_minutes: 'streamingUsage',
            vod_storage: 'storageUsage'
        };
        const column = tenants[columnMap[service] as keyof typeof tenants];

        // 1. Update Counter
        if (column) {
            await this.db.update(tenants)
                .set({ [columnMap[service]]: sql`${column} + ${amount}` })
                .where(eq(tenants.id, this.tenantId))
                .run();
        }

        // 2. Log Event
        try {
            await this.db.insert(usageLogs).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                metric: service,
                value: amount,
                timestamp: new Date(),
                meta: metadata ? JSON.stringify(metadata) : null
            }).run();
        } catch (e) {
            console.error("Failed to insert usage_log", e);
            // Don't fail the operation just because logging failed
        }
    }

    static async checkPlatformHealth(db: any, env: any) {
        // 1. Aggregate Usage for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Sum via SQL query on usage_logs is best for platform-wide stats
        // But for MVP, let's sum tenant counters? No, tenant counters are rolling/lifetime?
        // Actually, if counters are not reset monthly, they are lifetime.
        // Strategy says "Generous Base + Metered Overage" implies monthly reset or tracking.
        // Assuming counters are reset monthly (by the Billing Aggregator).

        // Let's use `usage_logs` for current month platform total.
        const smsTotal = await db.select({ count: sum(usageLogs.value) })
            .from(usageLogs)
            .where(and(
                eq(usageLogs.metric, 'sms'),
                sql`${usageLogs.timestamp} >= ${startOfMonth.getTime() / 1000}`
            ))
            .get();

        const emailTotal = await db.select({ count: sum(usageLogs.value) })
            .from(usageLogs)
            .where(and(
                eq(usageLogs.metric, 'email'),
                sql`${usageLogs.timestamp} >= ${startOfMonth.getTime() / 1000}`
            ))
            .get();

        const platformSms = Number(smsTotal?.count || 0);
        const platformEmail = Number(emailTotal?.count || 0);

        // 2. Check Limits
        const TWILIO_TIER_LIMIT = 10000; // Example
        const RESEND_TIER_LIMIT = 50000; // Example

        if (platformSms > TWILIO_TIER_LIMIT * 0.8) {
            await UsageService.alertAdmin(env, 'Twilio SMS', platformSms, TWILIO_TIER_LIMIT);
        }

        if (platformEmail > RESEND_TIER_LIMIT * 0.8) {
            await UsageService.alertAdmin(env, 'Resend Email', platformEmail, RESEND_TIER_LIMIT);
        }
    }

    private static async alertAdmin(env: any, serviceName: string, usage: number, limit: number) {
        console.warn(`[PLATFORM ALERT] ${serviceName} usage (${usage}) is > 80% of limit (${limit})`);

        if (env.RESEND_API_KEY && env.SYSTEM_EMAIL) {
            const resend = new Resend(env.RESEND_API_KEY);
            await resend.emails.send({
                from: 'system@studio-platform.com',
                to: env.SYSTEM_EMAIL,
                subject: `⚠️ Platform Alert: ${serviceName} Usage High`,
                html: `<p>The platform has used <strong>${usage}</strong> units of ${serviceName} this month.</p>
                       <p>This is over 80% of the assumed tier limit (${limit}).</p>
                       <p>Please upgrade the platform plan or investigate usage.</p>`
            });
        }
    }

    async calculateBillableUsage() {
        const usage = await this.getUsage();
        const tierConfig = PricingService.getTierConfig(usage.tier);

        const costs: any = {};
        let overageTotal = 0;

        // SMS
        const smsLimit = usage.smsLimit === -1 ? Infinity : usage.smsLimit;
        const smsOverage = Math.max(0, usage.smsUsage - smsLimit);
        if (smsOverage > 0) {
            costs.sms = { quantity: smsOverage, amount: smsOverage * UNIT_COSTS.sms };
            overageTotal += costs.sms.amount;
        }

        // Email
        const emailLimit = usage.emailLimit === -1 ? Infinity : usage.emailLimit;
        const emailOverage = Math.max(0, usage.emailUsage - emailLimit);
        if (emailOverage > 0) {
            costs.email = { quantity: emailOverage, amount: emailOverage * UNIT_COSTS.email };
            overageTotal += costs.email.amount;
        }

        // Streaming (VOD Minutes)
        const streamingLimit = usage.streamingLimit === -1 ? Infinity : usage.streamingLimit;
        const streamingOverage = Math.max(0, usage.streamingUsage - streamingLimit);
        if (streamingOverage > 0) {
            costs.streaming = { quantity: streamingOverage, amount: streamingOverage * UNIT_COSTS.streaming };
            overageTotal += costs.streaming.amount;
        }

        // Storage
        const tierStorageLimit = tierConfig.limits.storageGB;
        const storageLimit = tierStorageLimit === -1 ? Infinity : tierStorageLimit;

        const storageOverage = Math.max(0, usage.storageGB - storageLimit);
        if (storageOverage > 0) {
            costs.storage = { quantity: storageOverage, amount: storageOverage * UNIT_COSTS.storage };
            overageTotal += costs.storage.amount;
        }

        const subscription = {
            name: tierConfig.name,
            amount: tierConfig.price / 100 // Convert cents to dollars
        };

        return {
            subscription,
            overages: costs,
            overageTotal,
            totalRevenue: subscription.amount + overageTotal
        };
    }
}

export const UNIT_COSTS = {
    sms: 0.0075, // per message
    email: 0.0006, // per email
    streaming: 0.05, // per minute
    storage: 0.02 // per GB
};
