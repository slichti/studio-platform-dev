
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import {
    tenants, users, tenantMembers, tenantRoles, locations,
    membershipPlans, classSeries, classes, bookings,
    products, posOrders, posOrderItems,
    coupons, classPackDefinitions, giftCards
} from './src/schema';

dotenv.config();

const DB_URL = process.env.DB_URL || 'file:local.db';

const client = createClient({ url: DB_URL });
const db = drizzle(client);

const TENANT_NAME = "Test Studio";
const TENANT_SLUG = "test-studio";

async function main() {
    console.log(`🌱 Seeding Tenant: ${TENANT_NAME} (${TENANT_SLUG})...`);

    // 1. Create Tenant
    let tenant = await db.select().from(tenants).where(eq(tenants.slug, TENANT_SLUG)).get();
    if (!tenant) {
        console.log("Creating tenant...");
        tenant = (await db.insert(tenants).values({
            id: 'tenant_test_fixed_id', // Fixed ID for E2E
            slug: TENANT_SLUG,
            name: TENANT_NAME,
            status: 'active',
            tier: 'growth',
            currency: 'usd',
            settings: { enableStudentRegistration: true },
            branding: { primaryColor: '#000000' }
        }).returning().get());
    } else {
        console.log("Tenant already exists.");
    }
    const tenantId = tenant.id;

    // 2. Create Global User (Owner)
    const ownerEmail = `owner@${TENANT_SLUG}.com`;
    let ownerUser = await db.select().from(users).where(eq(users.email, ownerEmail)).get();
    if (!ownerUser) {
        console.log("Creating owner user...");
        ownerUser = (await db.insert(users).values({
            id: 'user_owner_fixed_id', // Fixed ID for E2E
            email: ownerEmail,
            profile: { firstName: 'Otis', lastName: 'Owner' },
            role: 'owner'
        }).returning().get());
    }

    // 3. Link Owner to Tenant
    let ownerMember = await db.select().from(tenantMembers)
        .where(eq(tenantMembers.userId, ownerUser.id))
        .get();

    if (!ownerMember) {
        console.log("Linking owner to tenant...");
        ownerMember = (await db.insert(tenantMembers).values({
            id: 'member_' + faker.string.uuid(),
            tenantId: tenantId,
            userId: ownerUser.id,
            status: 'active',
            profile: { bio: "I own this place" }
        }).returning().get());

        await db.insert(tenantRoles).values({
            memberId: ownerMember.id,
            role: 'owner'
        });
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
            isActive: true
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
            active: true
        }).onConflictDoNothing();
    }

    // 5b. Create Class Packs
    const packs = [
        { name: "5 Class Pack", price: 6000, credits: 5, expirationDays: 90 },
        { name: "20 Class Pack", price: 22000, credits: 20, expirationDays: 180 }
    ];

    for (const p of packs) {
        await db.insert(classPackDefinitions).values({
            id: 'pack_' + faker.string.uuid(),
            tenantId: tenantId,
            name: p.name,
            price: p.price,
            credits: p.credits,
            expirationDays: p.expirationDays,
            active: true
        }).onConflictDoNothing();
    }

    // 6. Create Staff (Instructors)
    const instructors: any[] = [];
    for (let i = 0; i < 2; i++) {
        const email = `instructor${i}@${TENANT_SLUG}.com`;
        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            // FIXED ID for first instructor for E2E
            const userId = i === 0 ? 'user_instructor_fixed_id' : 'user_' + faker.string.uuid();
            user = (await db.insert(users).values({
                id: userId,
                email: email,
                profile: { firstName: i === 0 ? 'Ian' : faker.person.firstName(), lastName: i === 0 ? 'Instructor' : faker.person.lastName() },
                role: 'user' // Global role is user
            }).returning().get());
        }

        let member = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).get();
        if (!member) {
            const memberId = i === 0 ? 'member_instructor_fixed_id' : 'member_' + faker.string.uuid();
            member = (await db.insert(tenantMembers).values({
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Yoga Teacher" }
            }).returning().get());

            await db.insert(tenantRoles).values({ memberId: member.id, role: 'instructor' }).onConflictDoNothing();
        }
        instructors.push(member);
    }

    // 7. Create Classes (Schedule)
    console.log("Creating schedule...");
    const classTypes = ["Vinyasa Flow", "Power Yoga", "Restorative", "Meditation"];
    const now = new Date();
    // Generate classes for next 14 days
    for (let d = 0; d < 14; d++) {
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
            status: 'active'
        });

        // Evening class
        date.setHours(18, 0, 0, 0);
        await db.insert(classes).values({
            id: 'class_' + faker.string.uuid(),
            tenantId: tenantId,
            instructorId: instructor.id,
            locationId: locationId,
            title: title,
            startTime: date,
            durationMinutes: 60,
            capacity: 20,
            status: 'active'
        });
    }

    // 8. Create Students
    console.log("Creating students...");
    const students: any[] = [];
    for (let i = 0; i < 10; i++) {
        const email = `student${i}@${TENANT_SLUG}.com`;
        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            // FIXED ID for first student for E2E
            const userId = i === 0 ? 'user_student_fixed_id' : 'user_' + faker.string.uuid();
            user = (await db.insert(users).values({
                id: userId,
                email: email,
                profile: { firstName: i === 0 ? 'Sam' : faker.person.firstName(), lastName: i === 0 ? 'Student' : faker.person.lastName() },
                role: 'user'
            }).returning().get());
        }

        let member = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).get();
        if (!member) {
            const memberId = i === 0 ? 'member_student_fixed_id' : 'member_' + faker.string.uuid();
            member = (await db.insert(tenantMembers).values({
                id: memberId,
                tenantId: tenantId,
                userId: user.id,
                status: 'active'
            }).returning().get());
            await db.insert(tenantRoles).values({ memberId: member.id, role: 'student' }).onConflictDoNothing();
        }
        students.push(member);
    }

    // 9. Create Bookings (Randomly)
    console.log("Creating bookings...");
    const recentClasses = await db.select().from(classes).where(eq(classes.tenantId, tenantId)).limit(20);
    for (const cls of recentClasses) {
        // Book 0-5 random students
        const attendees = faker.helpers.arrayElements(students, faker.number.int({ min: 0, max: 5 }));
        for (const student of attendees) {
            await db.insert(bookings).values({
                id: 'booking_' + faker.string.uuid(),
                classId: cls.id,
                memberId: student.id,
                status: 'confirmed',
                attendanceType: 'in_person'
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
        isActive: true
    }).onConflictDoNothing();

    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Yoga Block",
        price: 1500,
        stockQuantity: 30,
        isActive: true
    }).onConflictDoNothing();

    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Studio T-Shirt",
        price: 3500,
        stockQuantity: 100,
        isActive: true
    }).onConflictDoNothing();

    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Essential Oil",
        price: 2000,
        stockQuantity: 50,
        isActive: true
    }).onConflictDoNothing();

    // 11. Create Coupons
    console.log("Creating coupons...");
    await db.insert(coupons).values({
        id: 'coupon_' + faker.string.uuid(),
        tenantId: tenantId,
        code: "WELCOME20",
        type: 'percent',
        value: 20,
        active: true
    }).onConflictDoNothing();

    await db.insert(coupons).values({
        id: 'coupon_' + faker.string.uuid(),
        tenantId: tenantId,
        code: "SAVE10",
        type: 'amount',
        value: 1000, // $10.00
        active: true
    }).onConflictDoNothing();

    // 12. Create Gift Cards
    console.log("Creating gift cards...");
    for (let i = 0; i < 5; i++) {
        await db.insert(giftCards).values({
            id: 'gc_' + faker.string.uuid(),
            tenantId: tenantId,
            code: faker.string.alphanumeric({ length: 12, casing: 'upper' }),
            initialValue: 5000, // $50
            currentBalance: 5000,
            status: 'active',
            recipientEmail: faker.internet.email(),
            notes: "Seeded gift card"
        });
    }
    await db.insert(products).values({
        id: 'prod_' + faker.string.uuid(),
        tenantId: tenantId,
        name: "Water Bottle",
        price: 2500,
        stockQuantity: 100,
        isActive: true
    }).onConflictDoNothing();

    console.log("✅ Seed complete! Tenant: " + TENANT_NAME);
}

main().catch(console.error);
