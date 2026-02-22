import { createDb } from '../db';
import { eq, count, and, sql, sum, gte, lt } from 'drizzle-orm';
import { tenants, tenantMembers, classes, purchasedPacks, tenantRoles, uploads, locations, usageLogs } from '@studio/db/src/schema';
import { Resend } from 'resend';

export type Tier = 'launch' | 'growth' | 'scale';

export const TIERS: Record<Tier, {
    name: string;
    price: number; // Monthly in cents
    applicationFeePercent: number; // Percentage taken from transactions (e.g. 0.05 for 5%)
    limits: {
        students: number; // -1 for unlimited
        instructors: number;
        locations: number;
        classesPerWeek: number;
        storageGB: number;
        sms: number;
        email: number;
        streamingMinutes: number;
    };
    features: string[]; // Enabled feature flags
}> = {
    launch: {
        name: 'Launch',
        price: 0,
        applicationFeePercent: 0.05, // 5% Application Fee
        limits: {
            students: -1, // Unlimited students to reduce friction
            instructors: 5,
            locations: 1,
            classesPerWeek: 5,
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
        applicationFeePercent: 0.02, // 2% Application Fee
        limits: {
            students: -1,
            instructors: 15,
            locations: 3,
            classesPerWeek: 50,
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
            classesPerWeek: -1,
            storageGB: 1000,
            sms: 5000,
            email: 50000,
            streamingMinutes: -1 // Unlimited
        },
        features: ['financials', 'notifications', 'zoom', 'vod', 'automations', 'sms', 'white_label', 'api_access']
    }
};

export class PricingService {
    private static dbCache: Record<string, any> | null = null;

    static async loadTiersFromDb(db: any) {
        if (this.dbCache) return this.dbCache;

        try {
            const { platformPlans } = await import('@studio/db/src/schema');
            const plans = await db.select().from(platformPlans).where(eq(platformPlans.active, true)).all();

            const tiers: Record<string, any> = {};
            plans.forEach((p: any) => {
                tiers[p.slug] = {
                    name: p.name,
                    price: p.monthlyPriceCents,
                    applicationFeePercent: 0, // In transition, placeholder from DB if added
                    limits: {
                        students: -1,
                        instructors: -1,
                        locations: -1,
                        classesPerWeek: -1,
                        storageGB: 1000,
                        sms: 5000,
                        email: 50000,
                        streamingMinutes: -1
                    },
                    features: p.features || []
                };
            });

            this.dbCache = tiers;
            return tiers;
        } catch (e) {
            console.error("Failed to load tiers from DB, using fallback", e);
            return TIERS;
        }
    }

    static getTierConfig(tier: string) {
        // Fallback for non-async callers
        if (this.dbCache && this.dbCache[tier]) return this.dbCache[tier];
        return TIERS[tier as Tier] || TIERS.launch;
    }

    static async getTierConfigAsync(db: any, tier: string) {
        const tiers = await this.loadTiersFromDb(db);
        return (tiers as any)[tier] || this.getTierConfig(tier);
    }

    static isFeatureEnabled(tier: string, feature: string) {
        const config = this.getTierConfig(tier);
        return config.features.includes(feature);
    }
}

export class UsageService {
    private db: any;
    private tenantId: string;
    private static cache = new Map<string, { data: any, timestamp: number }>();
    private static CACHE_TTL = 60 * 1000; // 1 minute

    constructor(db: any, tenantId: string) {
        this.db = db;
        this.tenantId = tenantId;
    }

    private getCachedUsage() {
        const cached = UsageService.cache.get(this.tenantId);
        if (cached && (Date.now() - cached.timestamp) < UsageService.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    private setCachedUsage(data: any) {
        UsageService.cache.set(this.tenantId, {
            data,
            timestamp: Date.now()
        });
    }

    async getUsage() {
        const cached = this.getCachedUsage();
        if (cached) return cached;

        // Use db.batch for performance - reduces 5 round-trips to 1.
        const [memberCountRes, locationCountRes, instructorCountRes, classesThisWeekRes, tenantRes] = await this.db.batch([
            // 1. Count Students (Active Members)
            this.db.select({ count: count() })
                .from(tenantMembers)
                .where(and(eq(tenantMembers.tenantId, this.tenantId), eq(tenantMembers.status, 'active'))),

            // 2. Count Locations
            this.db.select({ count: count() })
                .from(locations)
                .where(eq(locations.tenantId, this.tenantId)),

            // 3. Count Instructors
            this.db.select({ count: count() })
                .from(tenantRoles)
                .innerJoin(tenantMembers, eq(tenantRoles.memberId, tenantMembers.id))
                .where(and(
                    eq(tenantMembers.tenantId, this.tenantId),
                    eq(tenantRoles.role, 'instructor'),
                    eq(tenantMembers.status, 'active')
                )),

            // 4. Count Classes this week
            (() => {
                const now = new Date();
                const startOfWeek = new Date(now);
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1); // Monday
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 7); // Next Monday 00:00

                return this.db.select({ count: count() })
                    .from(classes)
                    .where(and(
                        eq(classes.tenantId, this.tenantId),
                        gte(classes.startTime, startOfWeek),
                        lt(classes.startTime, endOfWeek) // Strictly less than next Monday
                    ));
            })(),

            // 5. SMS, Email, Streaming Usage (from tenants table)
            this.db.select({
                smsUsage: tenants.smsUsage,
                emailUsage: tenants.emailUsage,
                streamingUsage: tenants.streamingUsage,
                smsLimit: tenants.smsLimit,
                emailLimit: tenants.emailLimit,
                streamingLimit: tenants.streamingLimit,
                storageUsage: tenants.storageUsage,
                tier: tenants.tier,
                billingExempt: tenants.billingExempt
            }).from(tenants).where(eq(tenants.id, this.tenantId))
        ]);

        const memberCount = memberCountRes?.[0];
        const locationCount = locationCountRes?.[0];
        const instructorCount = instructorCountRes?.[0];
        const classesThisWeek = classesThisWeekRes?.[0];
        const tenant = tenantRes?.[0];

        const storageBytes = tenant?.storageUsage || 0;
        const storageGB = storageBytes / (1024 * 1024 * 1024);

        const result = {
            students: memberCount?.count || 0,
            instructors: instructorCount?.count || 0,
            locations: locationCount?.count || 0,
            classesPerWeek: classesThisWeek?.count || 0,

            smsUsage: tenant?.smsUsage || 0,
            emailUsage: tenant?.emailUsage || 0,
            streamingUsage: tenant?.streamingUsage || 0,

            tier: tenant?.tier || 'launch',
            smsLimit: tenant?.smsLimit ?? PricingService.getTierConfig(tenant?.tier).limits.sms,
            emailLimit: tenant?.emailLimit ?? PricingService.getTierConfig(tenant?.tier).limits.email,
            streamingLimit: tenant?.streamingLimit ?? PricingService.getTierConfig(tenant?.tier).limits.streamingMinutes,

            storageGB,
            billingExempt: !!tenant?.billingExempt
        };

        this.setCachedUsage(result);
        return result;
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

    async checkLimit(limitKey: 'students' | 'instructors' | 'locations' | 'classesPerWeek' | 'smsUsage' | 'emailUsage' | 'streamingUsage' | 'storageGB', currentTier: string) {
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
        const limit = config.limits[limitKey as 'students' | 'instructors' | 'locations' | 'storageGB'];

        if (limit === -1 || limit === undefined) return true;
        return (usage[limitKey as 'students' | 'instructors' | 'locations' | 'storageGB'] as number) < limit;
    }

    async canSend(service: 'sms' | 'email'): Promise<boolean> {
        // 1. Fetch Tenant Status (via cached getUsage)
        const usage = await this.getUsage();

        // We need billingExempt which isn't in getUsage's return object yet. 
        // Let's add it to getUsage or handle it here? 
        // Better: Add billingExempt to getUsage return.

        // Wait, I'll check if getUsage has it. 
        // getUsage fetches: smsUsage, emailUsage, streamingUsage, smsLimit, emailLimit, streamingLimit, storageUsage, tier.
        // It does NOT fetch billingExempt. I'll update getUsage too.

        if ((usage as any).billingExempt) return true;

        const limit = service === 'sms' ? usage.smsLimit : usage.emailLimit;
        const currentUsage = service === 'sms' ? usage.smsUsage : usage.emailUsage;

        if (limit === -1) return true;
        return currentUsage < limit;
    }

    async incrementUsage(service: 'sms' | 'email' | 'vod_minutes' | 'vod_storage', amount = 1, metadata: any = {}) {
        const columnMap = {
            sms: 'smsUsage',
            email: 'emailUsage',
            vod_minutes: 'streamingUsage',
            vod_storage: 'storageUsage'
        };
        const column = tenants[columnMap[service] as keyof typeof tenants];

        // Combine update and log into a single round-trip
        const batch: any[] = [];

        if (column) {
            batch.push(
                this.db.update(tenants)
                    .set({ [columnMap[service]]: sql`${column} + ${amount}` })
                    .where(eq(tenants.id, this.tenantId))
            );
        }

        batch.push(
            this.db.insert(usageLogs).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                metric: service,
                value: amount,
                timestamp: new Date(),
                meta: metadata ? JSON.stringify(metadata) : null
            })
        );

        try {
            await this.db.batch(batch);
        } catch (e) {
            console.error("Failed to execute usage batch", e);
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
