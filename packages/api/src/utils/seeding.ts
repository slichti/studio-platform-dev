
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import {
    tenants, users, tenantMembers, tenantRoles, locations,
    membershipPlans, classSeries, classes, bookings,
    products, posOrders, posOrderItems, tenantFeatures
} from 'db/src/schema';
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

    // 1. Create Tenant
    let tenant = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).get();
    if (!tenant) {
        console.log("Creating tenant...");
        tenant = (await db.insert(tenants).values({
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
        for (const featureKey of options.features) {
            await db.insert(tenantFeatures).values({
                id: 'feat_' + faker.string.uuid(),
                tenantId: tenantId,
                featureKey: featureKey,
                enabled: true,
                source: 'manual'
            }).onConflictDoNothing();
        }
    }

    // 2. Create Global Users (Owners)
    for (let i = 0; i < OWNER_COUNT; i++) {
        const ownerEmail = `owner${i > 0 ? i : ''}@${tenantSlug}.com`;
        let ownerUser = await db.select().from(users).where(eq(users.email, ownerEmail)).get();
        if (!ownerUser) {
            ownerUser = (await db.insert(users).values({
                id: 'user_' + faker.string.uuid(),
                email: ownerEmail,
                profile: { firstName: faker.person.firstName(), lastName: 'Owner' },
                role: 'owner',
                createdAt: now
            }).returning().get());
        }

        let ownerMember = await db.select().from(tenantMembers)
            .where(eq(tenantMembers.userId, ownerUser.id))
            .get();

        if (!ownerMember) {
            ownerMember = (await db.insert(tenantMembers).values({
                id: 'member_' + faker.string.uuid(),
                tenantId: tenantId,
                userId: ownerUser.id,
                status: 'active',
                profile: { bio: "I own this place" },
                joinedAt: now
            }).returning().get());

            await db.insert(tenantRoles).values({
                memberId: ownerMember.id,
                role: 'owner',
                createdAt: now
            });
        }
    }

    // 4. Create Locations
    let location = await db.select().from(locations).where(eq(locations.tenantId, tenantId)).get();
    if (!location) {
        console.log("Creating main location...");
        location = (await db.insert(locations).values({
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

    for (const p of plans) {
        await db.insert(membershipPlans).values({
            id: 'plan_' + faker.string.uuid(),
            tenantId: tenantId,
            name: p.name,
            price: p.price,
            interval: p.interval as any,
            active: true,
            createdAt: now
        }).onConflictDoNothing();
    }

    // 6. Create Staff (Instructors)
    const instructors: any[] = [];
    for (let i = 0; i < INSTRUCTOR_COUNT; i++) {
        const email = `instructor${i}@${tenantSlug}.com`;
        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            user = (await db.insert(users).values({
                id: 'user_' + faker.string.uuid(),
                email: email,
                profile: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
                role: 'user', // Global role is user
                createdAt: now
            }).returning().get());
        }

        let member = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).get();
        if (!member) {
            member = (await db.insert(tenantMembers).values({
                id: 'member_' + faker.string.uuid(),
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Yoga Teacher" },
                joinedAt: now
            }).returning().get());

            await db.insert(tenantRoles).values({ memberId: member.id, role: 'instructor', createdAt: now }).onConflictDoNothing();
        }
        instructors.push(member);
    }

    // 7. Create Classes (Schedule)
    console.log("Creating schedule...");
    const classTypes = ["Vinyasa Flow", "Power Yoga", "Restorative", "Meditation"];

    // Generate classes for next 7 days
    if (instructors.length > 0) {
        for (let d = 0; d < 7; d++) {
            const date = new Date(now);
            date.setDate(date.getDate() + d);
            date.setHours(9, 0, 0, 0); // 9 AM class

            const title = faker.helpers.arrayElement(classTypes);
            const instructor = faker.helpers.arrayElement(instructors);

            await db.insert(classes).values({
                id: 'class_' + faker.string.uuid(),
                tenantId: tenantId,
                instructorId: instructor.id,
                locationId: locationId,
                title: title,
                startTime: date,
                durationMinutes: 60,
                capacity: 20,
                status: 'active',
                createdAt: now
            });
        }
    }

    // 8. Create Students
    console.log("Creating students...");
    const students: any[] = [];
    for (let i = 0; i < STUDENT_COUNT; i++) {
        const email = `student${i}@${tenantSlug}.com`;
        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            user = (await db.insert(users).values({
                id: 'user_' + faker.string.uuid(),
                email: email,
                profile: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
                role: 'user',
                createdAt: now
            }).returning().get());
        }

        let member = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).get();
        if (!member) {
            member = (await db.insert(tenantMembers).values({
                id: 'member_' + faker.string.uuid(),
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                joinedAt: now
            }).returning().get());
            await db.insert(tenantRoles).values({ memberId: member.id, role: 'student', createdAt: now }).onConflictDoNothing();
        }
        students.push(member);
    }

    // 9. Create Bookings (Randomly)
    console.log("Creating bookings...");
    const recentClasses = await db.select().from(classes).where(eq(classes.tenantId, tenantId)).limit(20);
    for (const cls of recentClasses) {
        // Book 0-3 random students
        const attendees = faker.helpers.arrayElements(students, faker.number.int({ min: 0, max: Math.min(3, students.length) }));
        for (const student of attendees) {
            await db.insert(bookings).values({
                id: 'booking_' + faker.string.uuid(),
                classId: cls.id,
                memberId: student.id,
                status: 'confirmed',
                attendanceType: 'in_person',
                createdAt: now
            }).onConflictDoNothing();
        }
    }

    // 10. Retail Products
    console.log("Creating retail products...");
    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Yoga Mat",
        price: 8000,
        stockQuantity: 50,
        isActive: true,
        createdAt: now
    }).onConflictDoNothing();
    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Water Bottle",
        price: 2500,
        stockQuantity: 100,
        isActive: true,
        createdAt: now
    }).onConflictDoNothing();

    return tenant;
}
