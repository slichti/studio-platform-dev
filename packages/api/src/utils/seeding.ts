

import { eq, inArray, sql } from 'drizzle-orm';
import {
    tenants, users, tenantMembers, tenantRoles, locations,
    membershipPlans, classSeries, classes, bookings,
    products, posOrders, posOrderItems, tenantFeatures,
    platformConfig, subscriptions
} from '@studio/db/src/schema';
import { FeatureKey } from './features';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

export interface SeedOptions {
    tenantName?: string;
    tenantSlug?: string;
    ownerCount?: number;
    instructorCount?: number;
    studentCount?: number;
    tier?: 'basic' | 'growth' | 'scale';
    features?: FeatureKey[];
}


/**
 * Helper to chunk batch inserts to stay within D1 parameter limits.
 */
async function batchInsert(db: any, table: any, values: any[], onConflict: boolean = true, maxChunk?: number) {
    if (values.length === 0) return;

    const tableConfig = getTableConfig(table);
    const columnsPerRow = tableConfig.columns.length;

    // D1 hard limit: 100 bound parameters per query; use 99 to stay safe.
    const CHUNK_SIZE = maxChunk ?? Math.max(1, Math.floor(99 / columnsPerRow));

    console.log(`[batchInsert] Table: ${tableConfig.name}, Rows: ${values.length}, Cols/Row: ${columnsPerRow}, ChunkSize: ${CHUNK_SIZE}, onConflict: ${onConflict}`);

    const totalBatches = Math.ceil(values.length / CHUNK_SIZE);
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = values.slice(i, i + CHUNK_SIZE);

        console.log(`   --> Batch ${batchNum}/${totalBatches} (${chunk.length} rows, ${chunk.length * columnsPerRow} total params)`);

        try {
            const query = db.insert(table).values(chunk);
            if (onConflict) {
                await query.onConflictDoNothing().run();
            } else {
                await query.run();
            }
        } catch (e: any) {
            console.error(`[batchInsert ERROR] Failed in Batch ${batchNum}/${totalBatches} for table '${tableConfig.name}':`, e.message);
            // Re-throw with more context
            throw new Error(`Batch insert failed for '${tableConfig.name}' (Batch ${batchNum}/${totalBatches}): ${e.message}`);
        }
    }
}

export async function seedTenant(db: any, options: SeedOptions = {}) {
    const randomName = () => {
        const adjectives = ['Spark', 'Flow', 'Spirit', 'Vital', 'Zen', 'Inner', 'Radiant', 'Core'];
        const nouns = ['Studio', 'Collective', 'Space', 'Center', 'Sanctuary', 'Gym', 'Hub'];
        return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${Math.floor(Math.random() * 1000)}`;
    };

    const tenantName = options.tenantName || randomName();
    const rawSlug = options.tenantSlug || tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    // Auto-prefix all seeded slugs with 'test-' to distinguish from production tenants
    const tenantSlug = rawSlug.startsWith('test-') ? rawSlug : `test-${rawSlug}`;

    // Limits
    const OWNER_COUNT = Math.max(1, options.ownerCount || 1);
    const INSTRUCTOR_COUNT = Math.max(0, options.instructorCount ?? 2);
    const STUDENT_COUNT = Math.max(0, options.studentCount ?? 10);
    const TIER = options.tier || 'growth';

    console.log(`🌱 Seeding Tenant: ${tenantName} (${tenantSlug})...`);
    console.log(`   Owners: ${OWNER_COUNT}, Instructors: ${INSTRUCTOR_COUNT}, Students: ${STUDENT_COUNT}, Tier: ${TIER}`);

    const now = new Date();

    const runSeed = async (tx: any) => {
        // 1. Create Tenant
        let tenant = await tx.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
        if (tenant) {
            // Reject duplicate slug seeding
            throw new Error(`A tenant with slug '${tenantSlug}' already exists. Choose a different name or slug.`);
        }
        console.log("Creating tenant...");
        tenant = (await tx.insert(tenants).values({
            id: 'tenant_' + crypto.randomUUID(),
            slug: tenantSlug,
            name: tenantName,
            status: 'active',
            tier: TIER,
            currency: 'usd',
            isTest: true,
            settings: { enableStudentRegistration: true },
            branding: { primaryColor: '#000000' },
            createdAt: now
        }).returning().get());
        const tenantId = tenant.id;

        // 1b. Assign Features
        if (options.features && options.features.length > 0) {
            console.log(`   Enabling features: ${options.features.join(', ')}`);
            const featureValues = options.features.map(featureKey => ({
                id: 'feat_' + crypto.randomUUID(),
                tenantId: tenantId,
                featureKey: featureKey,
                enabled: true,
                source: 'manual' as const,
                updatedAt: now
            }));
            await batchInsert(tx, tenantFeatures, featureValues, true);

            // 1c. Also enable globally in platformConfig for UI visibility
            const platformConfigValues = options.features.map(f => ({
                key: `feature_${f}`,
                enabled: true,
                value: 'true',
                description: `Enabled via seeding for ${f}`,
                updatedAt: now
            }));
            await batchInsert(tx, platformConfig, platformConfigValues, true);
        }

        // 2 & 6 & 8. Create All Users (Owners, Instructors, Students)
        console.log("Creating users & members...");

        const ownerEmails = Array.from({ length: OWNER_COUNT }, (_, i) => `owner${i > 0 ? i : ''}@${tenantSlug}.com`);
        const instructorEmails = Array.from({ length: INSTRUCTOR_COUNT }, (_, i) => `instructor${i}@${tenantSlug}.com`);
        const studentEmails = Array.from({ length: STUDENT_COUNT }, (_, i) => `student${i}@${tenantSlug}.com`);

        const allEmails = [...ownerEmails, ...instructorEmails, ...studentEmails];
        const uniqueEmails = [...new Set(allEmails)];

        // 2a. Upsert Users
        const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'Elizabeth', 'William'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

        const userValues = uniqueEmails.map(email => ({
            id: 'user_' + crypto.randomUUID(),
            email: email,
            profile: {
                firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
                lastName: lastNames[Math.floor(Math.random() * lastNames.length)]
            },
            role: 'user', // Global role
            createdAt: now
        }));

        // Insert ignoring duplicates
        await batchInsert(tx, users, userValues);

        // 2b. Fetch all users to get IDs
        // 2b. Fetch all users to get IDs (chunked to avoid SQLite limits)
        const existingUsers: any[] = [];
        const CHUNK_SIZE = 100; // Conservative chunk size for SELECT IN (...)
        for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
            const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE);
            const batch = await tx.select().from(users).where(inArray(users.email, chunk));
            existingUsers.push(...batch);
        }
        const userMap = new Map<string, any>(existingUsers.map((u: any) => [u.email, u]));

        // 2c. Prepare Members & Roles
        const memberValues: any[] = [];
        const roleValues: any[] = [];
        const students: any[] = [];
        const instructors: any[] = [];

        // Owners
        for (const email of ownerEmails) {
            const user = userMap.get(email);
            if (!user) continue;
            const memberId = 'member_' + crypto.randomUUID();
            memberValues.push({
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Owner" },
                joinedAt: now,
                churnScore: 100,
                churnStatus: 'safe',
                engagementScore: 50,
                smsConsent: false
            });
            roleValues.push({ id: 'role_' + crypto.randomUUID(), memberId, role: 'owner', createdAt: now });
        }

        // Instructors
        for (const email of instructorEmails) {
            const user = userMap.get(email);
            if (!user) continue;
            const memberId = 'member_' + crypto.randomUUID();
            const member = {
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Yoga Teacher" },
                joinedAt: now,
                churnScore: 100,
                churnStatus: 'safe',
                engagementScore: 50,
                smsConsent: false
            };
            memberValues.push(member);
            instructors.push(member);
            roleValues.push({ id: 'role_' + crypto.randomUUID(), memberId, role: 'instructor', createdAt: now });
        }

        // Students
        for (const email of studentEmails) {
            const user = userMap.get(email);
            if (!user) continue;
            const memberId = 'member_' + crypto.randomUUID();
            const member = {
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                joinedAt: now,
                churnScore: 100,
                churnStatus: 'safe',
                engagementScore: 50,
                smsConsent: false
            };
            memberValues.push(member);
            students.push(member);
            roleValues.push({ id: 'role_' + crypto.randomUUID(), memberId, role: 'student', createdAt: now });
        }

        // Batch Insert Members & Roles
        await batchInsert(tx, tenantMembers, memberValues);
        await batchInsert(tx, tenantRoles, roleValues);

        // 4. Create Locations
        let location = await tx.select().from(locations).where(eq(locations.tenantId, tenantId)).get();
        if (!location) {
            console.log("Creating main location...");
            location = (await tx.insert(locations).values({
                id: 'loc_' + crypto.randomUUID(),
                tenantId: tenantId,
                slug: 'main-studio',
                name: "Main Studio",
                address: "123 Yoga Lane",
                isPrimary: true,
                isActive: true,
                createdAt: now
            }).returning().get());
        }
        const locationId = location.id;

        // 5. Create Membership Plans
        const plans = [
            { name: "Unlimited Month", price: 15000, interval: 'month' },
            { name: "10 Class Pack", price: 12000, interval: 'one_time' },
            { name: "Drop In", price: 2500, interval: 'one_time' }
        ];

        const planValues = plans.map(p => ({
            id: 'plan_' + crypto.randomUUID(),
            tenantId: tenantId,
            name: p.name,
            price: p.price,
            interval: p.interval as any,
            active: true,
            createdAt: now
        }));
        await batchInsert(tx, membershipPlans, planValues);

        // 6. Create Student Subscriptions (to show up in CUST count)
        console.log("Creating student subscriptions...");
        const planId = planValues[0].id;
        for (const student of students) {
            await tx.insert(subscriptions).values({
                id: 'sub_' + crypto.randomUUID(),
                userId: student.userId,
                tenantId: tenantId,
                memberId: student.id,
                planId: planId,
                status: 'active' as const,
                createdAt: now
            }).run();
        }

        // 7. Create Classes (Schedule)
        console.log("Creating schedule...");
        const classTypes = ["Vinyasa Flow", "Power Yoga", "Restorative", "Meditation"];
        const classValues: any[] = [];
        const classesList: any[] = []; // Keep track for bookings

        if (instructors.length > 0) {
            for (let d = 0; d < 7; d++) {
                const date = new Date(now);
                date.setDate(date.getDate() + d);
                // Set to 14:00 UTC (9:00 AM EST) to ensure visibility in standard calendar views
                date.setUTCHours(14, 0, 0, 0);

                const title = classTypes[Math.floor(Math.random() * classTypes.length)];
                const instructor = instructors[Math.floor(Math.random() * instructors.length)];
                const classId = 'class_' + crypto.randomUUID();

                const cls = {
                    id: classId,
                    tenantId: tenantId,
                    instructorId: instructor.id,
                    locationId: locationId,
                    title: title,
                    startTime: date,
                    durationMinutes: 60,
                    capacity: 20,
                    status: 'active',
                    createdAt: now
                };
                classValues.push(cls);
                classesList.push(cls);
            }
        }

        if (classValues.length > 0) {
            await batchInsert(tx, classes, classValues, true); // Changed to true for re-run resilience
        }

        // 9. Create Bookings (Randomly)
        console.log("Creating bookings...");
        const bookingValues: any[] = [];

        for (const cls of classesList) {
            const count = Math.min(3, students.length);
            const attendees = students.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * (count + 1)));
            for (const student of attendees) {
                bookingValues.push({
                    id: 'booking_' + crypto.randomUUID(),
                    classId: cls.id,
                    memberId: student.id,
                    status: 'confirmed',
                    attendanceType: 'in_person',
                    createdAt: now
                });
            }
        }

        if (bookingValues.length > 0) {
            await batchInsert(tx, bookings, bookingValues);
        }

        // 10. Retail Products
        console.log("Creating retail products...");
        const productValues = [
            {
                id: 'prod_' + crypto.randomUUID(),
                tenantId: tenantId,
                name: "Yoga Mat",
                price: 8000,
                stockQuantity: 50,
                isActive: true,
                createdAt: now
            },
            {
                id: 'prod_' + crypto.randomUUID(),
                tenantId: tenantId,
                name: "Water Bottle",
                price: 2500,
                stockQuantity: 100,
                isActive: true,
                createdAt: now
            }
        ];
        await batchInsert(tx, products, productValues);

        return tenant;
    };

    // Run seeding with cleanup on failure
    let createdTenantId: string | null = null;
    try {
        const result = await runSeed(db);
        return result;
    } catch (e: any) {
        // If we created a tenant but something failed after, clean it up
        // so we don't leave an orphan tenant with 0 data
        console.error(`[seedTenant] Seeding failed, attempting cleanup...`);
        try {
            // Try to find and delete the partially-created tenant
            const partialTenant = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
            if (partialTenant) {
                createdTenantId = partialTenant.id;
                console.log(`[seedTenant] Cleaning up partial tenant ${createdTenantId}...`);

                // Collect user IDs for this tenant before member deletion
                const tenantUserIds = await db
                    .select({ userId: tenantMembers.userId })
                    .from(tenantMembers)
                    .where(eq(tenantMembers.tenantId, createdTenantId!))
                    .all();
                const userIdsToCheck = tenantUserIds.map((r: any) => r.userId);

                // Delete in dependency order
                const cleanupOps = [
                    () => db.delete(bookings).where(sql`class_id IN (SELECT id FROM classes WHERE tenant_id = ${createdTenantId})`).run(),
                    () => db.delete(classes).where(eq(classes.tenantId, createdTenantId!)).run(),
                    () => db.delete(subscriptions).where(eq(subscriptions.tenantId, createdTenantId!)).run(),
                    () => db.delete(tenantRoles).where(sql`member_id IN (SELECT id FROM tenant_members WHERE tenant_id = ${createdTenantId})`).run(),
                    () => db.delete(tenantMembers).where(eq(tenantMembers.tenantId, createdTenantId!)).run(),
                    () => db.delete(products).where(eq(products.tenantId, createdTenantId!)).run(),
                    () => db.delete(membershipPlans).where(eq(membershipPlans.tenantId, createdTenantId!)).run(),
                    () => db.delete(locations).where(eq(locations.tenantId, createdTenantId!)).run(),
                    () => db.delete(tenantFeatures).where(eq(tenantFeatures.tenantId, createdTenantId!)).run(),
                    () => db.delete(tenants).where(eq(tenants.id, createdTenantId!)).run(),
                ];
                for (const op of cleanupOps) {
                    try { await op(); } catch { /* ignore cleanup errors */ }
                }

                // Cleanup orphaned users
                if (userIdsToCheck.length > 0) {
                    for (const uid of userIdsToCheck) {
                        const otherMems = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.userId, uid)).get();
                        const user = await db.select({ isPlatformAdmin: users.isPlatformAdmin, role: users.role }).from(users).where(eq(users.id, uid)).get();

                        // Delete if no other memberships AND not an admin
                        if (!otherMems && user && !user.isPlatformAdmin && user.role !== 'admin') {
                            await db.delete(users).where(eq(users.id, uid)).run().catch(() => { });
                        }
                    }
                }

                console.log(`[seedTenant] Cleanup complete for ${createdTenantId}`);
            }
        } catch (cleanupErr) {
            console.error(`[seedTenant] Cleanup also failed:`, cleanupErr);
        }
        // Re-throw the original error
        throw e;
    }
}
