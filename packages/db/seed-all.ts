
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

const DB_URL = process.env.DB_URL;
if (!DB_URL) {
    console.error("DB_URL is required");
    process.exit(1);
}

const client = createClient({ url: DB_URL });
const db = drizzle(client);

async function seedTenant(slug: string, name: string) {
    console.log(`🌱 Seeding Tenant: ${name} (${slug})...`);

    // 1. Create Tenant
    let tenant = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    if (!tenant) {
        console.log(`Creating tenant ${slug}...`);
        tenant = (await db.insert(tenants).values({
            id: `tenant_${slug}_id`,
            slug: slug,
            name: name,
            status: 'active',
            tier: 'growth',
            currency: 'usd',
            settings: { enableStudentRegistration: true },
            branding: { primaryColor: '#000000' }
        }).returning().get());
    } else {
        console.log(`Tenant ${slug} already exists.`);
    }
    const tenantId = tenant.id;

    // 2. Create Global User (Owner)
    const ownerEmail = `owner@${slug}.com`;
    let ownerUser = await db.select().from(users).where(eq(users.email, ownerEmail)).get();
    if (!ownerUser) {
        console.log(`Creating owner user for ${slug}...`);
        ownerUser = (await db.insert(users).values({
            id: `user_owner_${slug}_id`,
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
        console.log(`Linking owner to tenant ${slug}...`);
        ownerMember = (await db.insert(tenantMembers).values({
            id: 'member_' + faker.string.uuid(),
            tenantId: tenantId,
            userId: ownerUser.id,
            status: 'active',
            profile: { bio: "I own this place" }
        }).returning().get());

        await db.insert(tenantRoles).values({
            id: 'role_' + faker.string.uuid(),
            memberId: ownerMember.id,
            role: 'owner'
        });
    }

    // 4. Create Locations
    let location = await db.select().from(locations).where(eq(locations.tenantId, tenantId)).get();
    if (!location) {
        console.log(`Creating main location for ${slug}...`);
        location = (await db.insert(locations).values({
            id: 'loc_' + faker.string.uuid(),
            tenantId: tenantId,
            name: "Main Studio",
            slug: "main-studio",
            address: "123 Yoga Lane",
            isPrimary: true,
            isActive: true
        }).returning().get());
    }
    const locationId = location.id;

    // 6. Create Staff (Instructors)
    const instructors: any[] = [];
    for (let i = 0; i < 2; i++) {
        const email = `instructor${i}@${slug}.com`;
        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            user = (await db.insert(users).values({
                id: 'user_' + faker.string.uuid(),
                email: email,
                profile: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
                role: 'user'
            }).returning().get());
        }

        let member = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).get();
        if (!member) {
            member = (await db.insert(tenantMembers).values({
                id: 'member_' + faker.string.uuid(),
                tenantId: tenantId,
                userId: user.id,
                status: 'active',
                profile: { bio: "Yoga Teacher" }
            }).returning().get());

            await db.insert(tenantRoles).values({ id: 'role_' + faker.string.uuid(), memberId: member.id, role: 'instructor' }).onConflictDoNothing();
        }
        instructors.push(member);
    }

    // 7. Create Classes (Schedule)
    console.log(`Creating schedule for ${slug}...`);
    const classTypes = ["Vinyasa Flow", "Power Yoga", "Restorative", "Meditation"];
    const now = new Date();
    // Generate classes for next 30 days to ensure plenty of data
    for (let d = -7; d < 30; d++) {
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
        const evDate = new Date(date);
        evDate.setHours(18, 0, 0, 0);
        await db.insert(classes).values({
            id: 'class_' + faker.string.uuid(),
            tenantId: tenantId,
            instructorId: instructor.id,
            locationId: locationId,
            title: title,
            startTime: evDate,
            durationMinutes: 60,
            capacity: 20,
            status: 'active'
        });
    }
}

async function main() {
    await seedTenant("test-studio", "Test Studio");
    await seedTenant("garden-yoga", "Garden Yoga");
    console.log("✅ All tenants seeded!");
}

main().catch(console.error);
