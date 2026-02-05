
import { faker } from '@faker-js/faker';
import { eq, inArray } from 'drizzle-orm';
import {
    tenants, users, tenantMembers, tenantRoles, locations,
    membershipPlans, classSeries, classes, bookings,
    products, posOrders, posOrderItems, tenantFeatures
} from '@studio/db/src/schema';
import { FeatureKey } from './features';


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
 * Helper to chunk batch inserts to stay within D1 parameter limits (100 bound variables).
 */
async function batchInsert(db: any, table: any, values: any[], columnsPerRow: number = 8) {
    if (values.length === 0) return;
    const CHUNK_SIZE = Math.floor(100 / columnsPerRow);
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await db.insert(table).values(chunk).onConflictDoNothing().run();
    }
}

export async function seedTenant(db: any, options: SeedOptions = {}) {
    const tenantName = options.tenantName || "Test Studio";
    const tenantSlug = options.tenantSlug || "test-studio";

    // Limits
    const OWNER_COUNT = Math.max(1, options.ownerCount || 1);
    const INSTRUCTOR_COUNT = Math.max(0, options.instructorCount ?? 2);
    const STUDENT_COUNT = Math.max(0, options.studentCount ?? 10);
    const TIER = options.tier || 'growth';

    console.log(`🌱 Seeding Tenant: ${tenantName} (${tenantSlug})...`);
    console.log(`   Owners: ${OWNER_COUNT}, Instructors: ${INSTRUCTOR_COUNT}, Students: ${STUDENT_COUNT}, Tier: ${TIER}`);

    const now = new Date();

    // db.transaction is causing "Failed query: begin params:" on D1 (which doesn't support BEGIN statement)
    // Running sequentially without transaction for now.
    const runSeed = async (tx: any) => {
        // 1. Create Tenant
        let tenant = await tx.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
        if (!tenant) {
            console.log("Creating tenant...");
            tenant = (await tx.insert(tenants).values({
                id: 'tenant_' + faker.string.uuid(),
                slug: tenantSlug,
                name: tenantName,
                status: 'active',
                tier: TIER,
                currency: 'usd',
                settings: { enableStudentRegistration: true },
                branding: { primaryColor: '#000000' },
                createdAt: now
            }).returning().get());
        } else {
            console.log("Tenant already exists.");
        }
        const tenantId = tenant.id;

        // 1b. Assign Features
        if (options.features && options.features.length > 0) {
            console.log(`   Enabling features: ${options.features.join(', ')}`);
            const featureValues = options.features.map(featureKey => ({
                id: 'feat_' + faker.string.uuid(),
                tenantId: tenantId,
                featureKey: featureKey,
                enabled: true,
                source: 'manual'
            }));
            await batchInsert(tx, tenantFeatures, featureValues, 5);
        }

        // 2 & 6 & 8. Create All Users (Owners, Instructors, Students)
        console.log("Creating users & members...");

        const ownerEmails = Array.from({ length: OWNER_COUNT }, (_, i) => `owner${i > 0 ? i : ''}@${tenantSlug}.com`);
        const instructorEmails = Array.from({ length: INSTRUCTOR_COUNT }, (_, i) => `instructor${i}@${tenantSlug}.com`);
        const studentEmails = Array.from({ length: STUDENT_COUNT }, (_, i) => `student${i}@${tenantSlug}.com`);

        const allEmails = [...ownerEmails, ...instructorEmails, ...studentEmails];
        const uniqueEmails = [...new Set(allEmails)];

        // 2a. Upsert Users
        const userValues = uniqueEmails.map(email => ({
            id: 'user_' + faker.string.uuid(),
            email: email,
            profile: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
            role: 'user', // Global role
            createdAt: now
        }));

        // Insert ignoring duplicates
        await batchInsert(tx, users, userValues, 8);

        // 2b. Fetch all users to get IDs
        const existingUsers = await tx.select().from(users).where(inArray(users.email, uniqueEmails));
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
            const memberId = 'member_' + faker.string.uuid();
            memberValues.push({
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Owner" },
                joinedAt: now
            });
            roleValues.push({ memberId, role: 'owner', createdAt: now });
        }

        // Instructors
        for (const email of instructorEmails) {
            const user = userMap.get(email);
            if (!user) continue;
            const memberId = 'member_' + faker.string.uuid();
            const member = {
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Yoga Teacher" },
                joinedAt: now
            };
            memberValues.push(member);
            instructors.push(member);
            roleValues.push({ memberId, role: 'instructor', createdAt: now });
        }

        // Students
        for (const email of studentEmails) {
            const user = userMap.get(email);
            if (!user) continue;
            const memberId = 'member_' + faker.string.uuid();
            const member = {
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                joinedAt: now
            };
            memberValues.push(member);
            students.push(member);
            roleValues.push({ memberId, role: 'student', createdAt: now });
        }

        // Batch Insert Members & Roles
        await batchInsert(tx, tenantMembers, memberValues, 8);
        await batchInsert(tx, tenantRoles, roleValues, 5);

        // 4. Create Locations
        let location = await tx.select().from(locations).where(eq(locations.tenantId, tenantId)).get();
        if (!location) {
            console.log("Creating main location...");
            location = (await tx.insert(locations).values({
                id: 'loc_' + faker.string.uuid(),
                tenantId: tenantId,
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
            id: 'plan_' + faker.string.uuid(),
            tenantId: tenantId,
            name: p.name,
            price: p.price,
            interval: p.interval as any,
            active: true,
            createdAt: now
        }));
        await batchInsert(tx, membershipPlans, planValues, 7);

        // 7. Create Classes (Schedule)
        console.log("Creating schedule...");
        const classTypes = ["Vinyasa Flow", "Power Yoga", "Restorative", "Meditation"];
        const classValues: any[] = [];
        const classesList: any[] = []; // Keep track for bookings

        if (instructors.length > 0) {
            for (let d = 0; d < 7; d++) {
                const date = new Date(now);
                date.setDate(date.getDate() + d);
                date.setHours(9, 0, 0, 0); // 9 AM class

                const title = faker.helpers.arrayElement(classTypes);
                const instructor = faker.helpers.arrayElement(instructors);
                const classId = 'class_' + faker.string.uuid();

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
            await batchInsert(tx, classes, classValues, 10);
        }

        // 9. Create Bookings (Randomly)
        console.log("Creating bookings...");
        const bookingValues: any[] = [];

        // We use the just-created classes. If we needed historical classes we'd query, 
        // but for seeding new ID layout, this is fine.
        for (const cls of classesList) {
            const attendees = faker.helpers.arrayElements(students, faker.number.int({ min: 0, max: Math.min(3, students.length) }));
            for (const student of attendees) {
                bookingValues.push({
                    id: 'booking_' + faker.string.uuid(),
                    classId: cls.id,
                    memberId: student.id,
                    status: 'confirmed',
                    attendanceType: 'in_person',
                    createdAt: now
                });
            }
        }

        if (bookingValues.length > 0) {
            await batchInsert(tx, bookings, bookingValues, 6);
        }

        // 10. Retail Products
        console.log("Creating retail products...");
        const productValues = [
            {
                id: 'prod_' + faker.string.uuid(),
                tenantId: tenantId,
                name: "Yoga Mat",
                price: 8000,
                stockQuantity: 50,
                isActive: true,
                createdAt: now
            },
            {
                id: 'prod_' + faker.string.uuid(),
                tenantId: tenantId,
                name: "Water Bottle",
                price: 2500,
                stockQuantity: 100,
                isActive: true,
                createdAt: now
            }
        ];
        await batchInsert(tx, products, productValues, 7);

        return tenant;
    };

    return await runSeed(db);
}
