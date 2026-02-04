import { D1Database } from '@cloudflare/workers-types';
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { progressMetricDefinitions, memberProgressEntries, tenants } from '@studio/db/src/schema';

type Env = {
    DB: D1Database;
    [key: string]: any;
}

function isD1Database(db: any): db is D1Database {
    return db && typeof db === 'object' && 'prepare' in db;
}

export class ProgressService {
    private db: DrizzleD1Database<typeof schema>;
    private tenantId: string;

    constructor(dbOrD1: D1Database | DrizzleD1Database<any>, tenantId: string) {
        if (isD1Database(dbOrD1)) {
            this.db = drizzle(dbOrD1, { schema });
        } else {
            this.db = dbOrD1 as DrizzleD1Database<typeof schema>;
        }
        this.tenantId = tenantId;
    }

    async getMetrics(isStaff: boolean) {
        let query = this.db.select().from(progressMetricDefinitions)
            .where(and(
                eq(progressMetricDefinitions.tenantId, this.tenantId),
                eq(progressMetricDefinitions.active, true)
            ))
            .orderBy(progressMetricDefinitions.displayOrder);

        const metrics = await query;
        if (!isStaff) {
            return metrics.filter(m => m.visibleToStudents);
        }
        return metrics;
    }

    async getMemberStats(memberId: string, filterForStudents: boolean = true) {
        const metrics = await this.db.select().from(progressMetricDefinitions)
            .where(and(
                eq(progressMetricDefinitions.tenantId, this.tenantId),
                eq(progressMetricDefinitions.active, true),
                filterForStudents ? eq(progressMetricDefinitions.visibleToStudents, true) : sql`1=1`
            ));

        return await Promise.all(metrics.map(async (metric) => {
            let value = 0;
            if (metric.aggregation === 'sum') {
                const result = await this.db.select({ total: sql<number>`COALESCE(SUM(${memberProgressEntries.value}), 0)` })
                    .from(memberProgressEntries)
                    .where(and(
                        eq(memberProgressEntries.memberId, memberId),
                        eq(memberProgressEntries.metricDefinitionId, metric.id)
                    ))
                    .get();
                value = result?.total || 0;
            } else if (metric.aggregation === 'max') {
                const result = await this.db.select({ max: sql<number>`COALESCE(MAX(${memberProgressEntries.value}), 0)` })
                    .from(memberProgressEntries)
                    .where(and(
                        eq(memberProgressEntries.memberId, memberId),
                        eq(memberProgressEntries.metricDefinitionId, metric.id)
                    ))
                    .get();
                value = result?.max || 0;
            } else if (metric.aggregation === 'latest') {
                const result = await this.db.select()
                    .from(memberProgressEntries)
                    .where(and(
                        eq(memberProgressEntries.memberId, memberId),
                        eq(memberProgressEntries.metricDefinitionId, metric.id)
                    ))
                    .orderBy(desc(memberProgressEntries.recordedAt))
                    .limit(1)
                    .get();
                value = result?.value || 0;
            }

            return {
                metricId: metric.id,
                name: metric.name,
                category: metric.category,
                unit: metric.unit,
                icon: metric.icon,
                value,
            };
        }));
    }

    async logEntry(data: {
        memberId: string;
        metricDefinitionId: string;
        value: number;
        source?: 'auto' | 'manual' | 'import';
        metadata?: any;
        recordedAt?: Date;
    }) {
        // Verify metric exists and belongs to tenant
        const metric = await this.db.select().from(progressMetricDefinitions)
            .where(and(
                eq(progressMetricDefinitions.id, data.metricDefinitionId),
                eq(progressMetricDefinitions.tenantId, this.tenantId)
            ))
            .get();

        if (!metric) throw new Error('Metric not found');

        return await this.db.insert(memberProgressEntries).values({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            memberId: data.memberId,
            metricDefinitionId: data.metricDefinitionId,
            value: data.value,
            source: data.source || 'manual',
            metadata: data.metadata,
            recordedAt: data.recordedAt || new Date(),
        }).returning().get();
    }

    async updateSettings(body: any) {
        const tenant = await this.db.select().from(tenants).where(eq(tenants.id, this.tenantId)).get();
        if (!tenant) throw new Error('Tenant not found');

        const currentSettings = (tenant.settings as any) || {};
        const updatedSettings = {
            ...currentSettings,
            progressTracking: {
                studioType: body.studioType || 'yoga',
                enabledCategories: body.enabledCategories || ['mindfulness'],
                showLeaderboards: body.showLeaderboards ?? false,
                allowStudentInput: body.allowStudentInput ?? true,
            }
        };

        await this.db.update(tenants)
            .set({ settings: updatedSettings })
            .where(eq(tenants.id, this.tenantId))
            .run();
    }

    async seedDefaults(studioType: string) {
        const defaults: Array<{ name: string; category: 'mindfulness' | 'strength' | 'cardio' | 'custom'; unit: string; icon: string; visibleToStudents: boolean }> = [];

        if (studioType === 'yoga' || studioType === 'hybrid') {
            defaults.push(
                { name: 'Classes Attended', category: 'mindfulness', unit: 'classes', icon: 'Calendar', visibleToStudents: true },
                { name: 'Minutes Practiced', category: 'mindfulness', unit: 'minutes', icon: 'Clock', visibleToStudents: true },
                { name: 'Current Streak', category: 'mindfulness', unit: 'days', icon: 'Flame', visibleToStudents: true },
                { name: 'Longest Streak', category: 'mindfulness', unit: 'days', icon: 'Trophy', visibleToStudents: true },
            );
        }

        if (studioType === 'gym' || studioType === 'hybrid') {
            defaults.push(
                { name: 'Workouts Completed', category: 'cardio', unit: 'workouts', icon: 'Dumbbell', visibleToStudents: true },
                { name: 'Total Weight Lifted', category: 'strength', unit: 'lbs', icon: 'TrendingUp', visibleToStudents: studioType === 'gym' },
                { name: 'Personal Records', category: 'strength', unit: 'PRs', icon: 'Award', visibleToStudents: studioType === 'gym' },
                { name: 'Cardio Minutes', category: 'cardio', unit: 'minutes', icon: 'Heart', visibleToStudents: true },
            );
        }

        const existing = await this.db.select().from(progressMetricDefinitions)
            .where(eq(progressMetricDefinitions.tenantId, this.tenantId));
        const existingNames = new Set(existing.map(m => m.name));

        const toInsert = defaults.filter(d => !existingNames.has(d.name));

        for (let i = 0; i < toInsert.length; i++) {
            const def = toInsert[i];
            await this.db.insert(progressMetricDefinitions).values({
                id: crypto.randomUUID(),
                tenantId: this.tenantId,
                name: def.name,
                category: def.category,
                unit: def.unit,
                icon: def.icon,
                visibleToStudents: def.visibleToStudents,
                displayOrder: i,
            }).run();
        }

        return { seeded: toInsert.length, skipped: defaults.length - toInsert.length };
    }

    async createMetric(data: any) {
        const id = crypto.randomUUID();
        await this.db.insert(progressMetricDefinitions).values({
            id,
            tenantId: this.tenantId,
            name: data.name,
            category: data.category || 'custom',
            unit: data.unit,
            icon: data.icon,
            aggregation: data.aggregation || 'sum',
            visibleToStudents: data.visibleToStudents ?? true,
            active: true,
            displayOrder: 99 // Default to end
        }).run();
        return { id, ...data };
    }

    async updateMetric(id: string, data: any) {
        await this.db.update(progressMetricDefinitions)
            .set(data)
            .where(and(eq(progressMetricDefinitions.id, id), eq(progressMetricDefinitions.tenantId, this.tenantId)))
            .run();
        return { success: true };
    }

    async deleteMetric(id: string) {
        await this.db.delete(progressMetricDefinitions)
            .where(and(eq(progressMetricDefinitions.id, id), eq(progressMetricDefinitions.tenantId, this.tenantId)))
            .run();
        return { success: true };
    }
}
